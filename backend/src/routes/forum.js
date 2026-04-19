const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { emitForum }  = require('../utils/socket');

// ── Auto-migration: add comment-like columns if not present
(async () => {
  try {
    await pool.query(`
      ALTER TABLE forum_answers
        ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS liked_by    JSONB DEFAULT '[]'::jsonb
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forum_saved (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        question_id INT REFERENCES forum_questions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, question_id)
      );
    `);
  } catch (e) { console.warn('forum_answers migration skipped:', e.message); }
})();

// GET  /api/forum/questions
router.get('/questions', async (req, res, next) => {
  try {
    const { cat, search, tag } = req.query;
    let q = `SELECT fq.*, u.name as asked_by, u.avatar_url as user_avatar_url, u.role as user_role,
              CASE 
                WHEN u.role = 'lawyer' AND u.is_verified THEN 'محامٍ موثوق ✔️'
                WHEN u.role = 'lawyer' THEN 'مستشار قانوني ⚖️'
                ELSE NULL 
              END as user_flair,
              (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id AND fa.parent_answer_id IS NULL) as answer_count
              FROM forum_questions fq
              LEFT JOIN users u ON u.id=fq.user_id
              WHERE fq.is_visible=true`;
    const params = [];
    if (cat)    { params.push(cat);    q += ` AND fq.category=$${params.length}`; }
    if (search) { params.push('%'+search+'%'); q += ` AND (fq.question ILIKE $${params.length} OR fq.category ILIKE $${params.length})`; }
    if (tag)    { params.push(JSON.stringify([tag.toLowerCase()])); q += ` AND fq.tags @> $${params.length}::jsonb`; }
    q += ' ORDER BY fq.created_at DESC LIMIT 50';
    const { rows } = await pool.query(q, params);
    res.json({ questions: rows });
  } catch (err) { next(err); }
});

// GET /api/forum/questions/:id  — single post for deep-link
router.get('/questions/:id', async (req, res, next) => {
  try {
    const { rows: [row] } = await pool.query(
      `SELECT fq.*, u.name as asked_by, u.avatar_url as user_avatar_url, u.role as user_role,
              CASE 
                WHEN u.role = 'lawyer' AND u.is_verified THEN 'محامٍ موثوق ✔️'
                WHEN u.role = 'lawyer' THEN 'مستشار قانوني ⚖️'
                ELSE NULL 
              END as user_flair,
              (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id) as answer_count
       FROM forum_questions fq
       LEFT JOIN users u ON u.id=fq.user_id
       WHERE fq.id=$1 AND fq.is_visible=true`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ message: 'Post not found' });
    res.json({ question: row });
  } catch (err) { next(err); }
});

// GET /api/forum/questions/:id/likers — who liked this post
router.get('/questions/:id/likers', async (req, res, next) => {
  try {
    const { rows: [post] } = await pool.query(
      `SELECT liked_by FROM forum_questions WHERE id=$1`, [req.params.id]
    );
    if (!post || !post.liked_by || !post.liked_by.length) return res.json({ likers: [] });
    // liked_by is JSONB array of user-id strings
    const ids = post.liked_by.map(Number).filter(Boolean);
    if (!ids.length) return res.json({ likers: [] });
    const { rows } = await pool.query(
      `SELECT id, name, avatar_url, role FROM users WHERE id = ANY($1::int[])`, [ids]
    );
    res.json({ likers: rows });
  } catch (err) { next(err); }
});

// GET /api/forum/questions/:id/reposts — who reposted this post
router.get('/questions/:id/reposts', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT fq.id, fq.question, fq.created_at, u.name, u.avatar_url, u.role
       FROM forum_questions fq
       LEFT JOIN users u ON u.id = fq.user_id
       WHERE fq.original_post_id=$1 AND fq.is_visible=true
       ORDER BY fq.created_at DESC`,
      [req.params.id]
    );
    res.json({ reposts: rows });
  } catch (err) { next(err); }
});

// GET /api/forum/questions/:id/repost-by/:userId
// Find the repost of post :id that was created by :userId
// Used by notification tap handler to correctly deep-link to the reposter's post
router.get('/questions/:id/repost-by/:userId', async (req, res, next) => {
  try {
    const { rows: [repost] } = await pool.query(
      `SELECT id FROM forum_questions
       WHERE original_post_id=$1 AND user_id=$2 AND is_visible=true
       ORDER BY created_at DESC LIMIT 1`,
      [req.params.id, req.params.userId]
    );
    if (!repost) return res.status(404).json({ message: 'Repost not found' });
    res.json({ repost_id: repost.id });
  } catch (err) { next(err); }
});





// POST /api/forum/questions
router.post('/questions', requireAuth, async (req, res, next) => {
  try {
    const { question, category, anonymous, image_url, original_post_id, original_post_data } = req.body;
    if (!question || !category) return res.status(400).json({ message: 'question and category required' });
    // Extract hashtags from question text (supports Arabic + Latin + underscore)
    const tags = (question.match(/#[\w\u0600-\u06FF_]+/g) || []).map(t => t.toLowerCase());
    const { rows: [row] } = await pool.query(
      `INSERT INTO forum_questions (user_id, question, category, anonymous, is_visible, image_url, original_post_id, original_post_data, tags)
       VALUES ($1,$2,$3,$4,true,$5,$6,$7::jsonb,$8::jsonb) RETURNING *`,
      [req.user.id, question, category, anonymous !== false, image_url || null,
       original_post_id || null, original_post_data ? JSON.stringify(original_post_data) : null,
       JSON.stringify(tags)]
    );
    const newPost = {
      ...row,
      asked_by: anonymous ? 'Anonymous' : req.user.name,
      user_avatar_url: anonymous ? null : req.user.avatar_url,
      user_role: req.user.role,
      answer_count: 0, views: 1,
    };
    // Emit real-time event so other users see the new post immediately
    emitForum('forum:new_post', { post: newPost });
    res.status(201).json({ question: newPost });
  } catch (err) { next(err); }
});

// POST /api/forum/questions/:id/like — TOGGLE (like OR unlike)
router.post('/questions/:id/like', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id.toString();

    const { rows: [pre] } = await pool.query(
      `SELECT liked_by @> $2::jsonb AS already_liked, user_id, question
       FROM forum_questions WHERE id=$1`,
      [req.params.id, JSON.stringify([userId])]
    );
    if (!pre) return res.status(404).json({ message: 'Post not found' });
    const wasAlreadyLiked = !!pre.already_liked;

    let row;
    if (wasAlreadyLiked) {
      // ── UNLIKE — remove from array, decrement
      const { rows } = await pool.query(
        `UPDATE forum_questions
           SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1),
               liked_by = (
                 SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
                 FROM jsonb_array_elements(COALESCE(liked_by, '[]'::jsonb)) AS x
                 WHERE x != to_jsonb($2::text)
               )
         WHERE id=$1 RETURNING *`,
        [req.params.id, userId]
      );
      row = rows[0];
      return res.json({ question: row, liked: false });
    }

    // ── LIKE — add to array, increment
    const { rows } = await pool.query(
      `UPDATE forum_questions
         SET likes_count = COALESCE(likes_count, 0) + 1,
             liked_by = COALESCE(liked_by, '[]'::jsonb) || $2::jsonb
       WHERE id=$1 RETURNING *`,
      [req.params.id, JSON.stringify([userId])]
    );
    row = rows[0];

    // ── Notify on like (only when liking, not unliking)
    if (pre.user_id && pre.user_id.toString() !== req.user.id.toString()) {
      const actor   = req.user;
      const rawSnip = (pre.question || '').trim();
      const snippet = (rawSnip && rawSnip !== 'مشاركة') ? rawSnip.substring(0, 80) : 'منشورك الأصلي';
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link, data)
         VALUES ($1,'forum_like',$2,$3,$4,$5::jsonb)`,
        [
          pre.user_id,
          `👍 ${actor.name} أعجبه منشورك`,
          `"${snippet}${rawSnip.length >= 80 ? '…' : ''}"`,
          `/post/${req.params.id}`,
          JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: parseInt(req.params.id), postSnippet: snippet, action: 'like' }),
        ]
      ).catch(console.error);
    }
    // ── Emit real-time like event so all clients update the count
    emitForum('forum:like', { postId: parseInt(req.params.id), likes_count: row.likes_count, liked: true });
    res.json({ question: row, liked: true });
  } catch (err) { next(err); }
});

// DELETE /api/forum/questions/:id — soft-delete own post (reposts stay visible)
router.delete('/questions/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE forum_questions SET is_visible=false WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!row) return res.status(403).json({ message: 'Not found or not authorized' });
    res.json({ success: true, id: parseInt(req.params.id) });
  } catch (err) { next(err); }
});

// PATCH /api/forum/questions/:id — edit own post text
router.patch('/questions/:id', requireAuth, async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ message: 'question required' });
    const { rows: [row] } = await pool.query(
      `UPDATE forum_questions SET question=$2 WHERE id=$1 AND user_id=$3 AND is_visible=true RETURNING *`,
      [req.params.id, question, req.user.id]
    );
    if (!row) return res.status(403).json({ message: 'Not found or not authorized' });
    res.json({ question: row });
  } catch (err) { next(err); }
});

// POST /api/forum/answers/:id/like — toggle like on a comment
router.post('/answers/:id/like', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id.toString();
    const { rows: [pre] } = await pool.query(
      `SELECT liked_by @> $2::jsonb AS already_liked FROM forum_answers WHERE id=$1`,
      [req.params.id, JSON.stringify([userId])]
    );
    if (!pre) return res.status(404).json({ message: 'Answer not found' });

    if (pre.already_liked) {
      const { rows: [row] } = await pool.query(
        `UPDATE forum_answers
           SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1),
               liked_by = (
                 SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
                 FROM jsonb_array_elements(COALESCE(liked_by, '[]'::jsonb)) AS x
                 WHERE x != to_jsonb($2::text)
               )
         WHERE id=$1 RETURNING id, likes_count, liked_by`,
        [req.params.id, userId]
      );
      return res.json({ answer: row, liked: false });
    }

    const { rows: [row] } = await pool.query(
      `UPDATE forum_answers
         SET likes_count = COALESCE(likes_count, 0) + 1,
             liked_by = COALESCE(liked_by, '[]'::jsonb) || $2::jsonb
       WHERE id=$1 RETURNING id, likes_count, liked_by`,
      [req.params.id, JSON.stringify([userId])]
    );
    res.json({ answer: row, liked: true });
  } catch (err) { next(err); }
});

// GET /api/forum/questions/:id/answers — top-level comments only
router.get('/questions/:id/answers', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT fa.*,
              u.name as lawyer_name, u.avatar_url as lawyer_avatar, u.role as lawyer_role,
              lp.specialization,
              (SELECT COUNT(*) FROM forum_answers r WHERE r.parent_answer_id=fa.id) AS reply_count,
              CASE 
                WHEN u.role = 'lawyer' AND fa.likes_count >= 5 THEN 'خبير مجتمعي 🌟'
                WHEN u.role = 'lawyer' AND u.is_verified THEN 'محامٍ موثوق ✔️'
                WHEN u.role = 'lawyer' THEN 'مستشار قانوني ⚖️'
                ELSE NULL 
              END as flair
       FROM forum_answers fa
       JOIN users u ON u.id=fa.lawyer_id
       LEFT JOIN lawyer_profiles lp ON lp.user_id=fa.lawyer_id
       WHERE fa.question_id=$1 AND fa.parent_answer_id IS NULL
       ORDER BY fa.is_accepted DESC, fa.upvotes DESC, fa.created_at ASC`,
      [req.params.id]
    );
    res.json({ answers: rows });
  } catch (err) { next(err); }
});

// GET /api/forum/answers/:id/replies — replies to a specific comment
router.get('/answers/:id/replies', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT fa.*, u.name as lawyer_name, u.avatar_url as lawyer_avatar, u.role as lawyer_role, u.is_verified,
              CASE 
                WHEN u.role = 'lawyer' AND fa.likes_count >= 5 THEN 'خبير مجتمعي 🌟'
                WHEN u.role = 'lawyer' AND u.is_verified THEN 'محامٍ موثوق ✔️'
                WHEN u.role = 'lawyer' THEN 'مستشار قانوني ⚖️'
                ELSE NULL 
              END as flair
       FROM forum_answers fa
       JOIN users u ON u.id=fa.lawyer_id
       WHERE fa.parent_answer_id=$1
       ORDER BY fa.created_at ASC`,
      [req.params.id]
    );
    res.json({ replies: rows });
  } catch (err) { next(err); }
});

// POST /api/forum/questions/:id/answers
router.post('/questions/:id/answers', requireAuth, async (req, res, next) => {
  try {
    const { answer, parent_answer_id } = req.body;
    if (!answer) return res.status(400).json({ message: 'answer required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO forum_answers (question_id, lawyer_id, answer, parent_answer_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, req.user.id, answer, parent_answer_id || null]
    );

    // Notify post author (only for top-level comments, not replies)
    const { rows: [post] } = await pool.query(
      `SELECT user_id, question FROM forum_questions WHERE id=$1`, [req.params.id]
    ).catch(() => ({ rows: [] }));

    if (!parent_answer_id && post && post.user_id && post.user_id.toString() !== req.user.id.toString()) {
      const actor        = req.user;
      const snippet      = (post.question || '').substring(0, 80);
      const answerSnip   = (answer || '').substring(0, 60);
      const postId       = req.params.id;
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link, data)
         VALUES ($1,'forum_comment',$2,$3,$4,$5::jsonb)`,
        [
          post.user_id,
          `💬 ${actor.name} علّق على منشورك`,
          `"${answerSnip}${answerSnip.length >= 60 ? '…' : ''}"`,
          `/post/${postId}`,
          JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: parseInt(postId), postSnippet: snippet, commentSnippet: answerSnip, action: 'comment' }),
        ]
      ).catch(console.error);
    } else if (parent_answer_id) {
      // Notify parent comment author
      const { rows: [parentComment] } = await pool.query(
        `SELECT lawyer_id, answer FROM forum_answers WHERE id=$1`, [parent_answer_id]
      ).catch(() => ({ rows: [] }));
      
      if (parentComment && parentComment.lawyer_id && parentComment.lawyer_id.toString() !== req.user.id.toString()) {
        const actor = req.user;
        const answerSnip = (answer || '').substring(0, 60);
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, link, data)
           VALUES ($1,'forum_reply',$2,$3,$4,$5::jsonb)`,
          [
            parentComment.lawyer_id,
            `↩️ ${actor.name} رد على تعليقك`,
            `"${answerSnip}${answerSnip.length >= 60 ? '…' : ''}"`,
            `/post/${req.params.id}`,
            JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: parseInt(req.params.id), commentSnippet: answerSnip, action: 'reply' }),
          ]
        ).catch(console.error);
      }
    }

    // Emit real-time comment event
    emitForum('forum:comment', { postId: parseInt(req.params.id), answer: { ...row, lawyer_name: req.user.name, lawyer_role: req.user.role }, isReply: !!parent_answer_id });
    res.status(201).json({ answer: row });
  } catch (err) { next(err); }
});

// POST /api/forum/questions/:id/share — called when user reposts
router.post('/questions/:id/share', requireAuth, async (req, res, next) => {
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE forum_questions SET shares_count = COALESCE(shares_count,0)+1 WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ message: 'Post not found' });

    if (row.user_id && row.user_id.toString() !== req.user.id.toString()) {
      const actor    = req.user;
      // Use the original post's question as snippet; hide the 'مشاركة' placeholder
      const rawSnippet = (row.question || '').trim();
      const snippet    = (rawSnippet && rawSnippet !== 'مشاركة')
        ? rawSnippet.substring(0, 80)
        : 'منشورك الأصلي';
      // repost_id = the NEW post lawyer 1 created; link goes there so lawyer 2 sees lawyer 1's repost
      const repostId = req.body && req.body.repost_id ? req.body.repost_id : null;
      const link     = repostId ? `/post/${repostId}` : `/post/${req.params.id}`;
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link, data)
         VALUES ($1,'forum_share',$2,$3,$4,$5::jsonb)`,
        [
          row.user_id,
          `🔁 ${actor.name} أعاد نشر منشورك`,
          `"${snippet}${rawSnippet.length >= 80 ? '…' : ''}"`,
          link,
          JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: repostId ? parseInt(repostId) : parseInt(req.params.id), originalPostId: parseInt(req.params.id), postSnippet: snippet, action: 'share' }),
        ]
      ).catch(console.error);
    }

    res.json({ question: row });
    // Emit real-time share event
    emitForum('forum:share', { postId: parseInt(req.params.id), shares_count: row.shares_count });
  } catch (err) { next(err); }
});

// POST /api/forum/questions/:id/save — toggle save
router.post('/questions/:id/save', requireAuth, async (req, res, next) => {
  try {
    const { rows: [existing] } = await pool.query(
      `SELECT * FROM forum_saved WHERE user_id=$1 AND question_id=$2`,
      [req.user.id, req.params.id]
    );
    if (existing) {
      await pool.query(`DELETE FROM forum_saved WHERE user_id=$1 AND question_id=$2`, [req.user.id, req.params.id]);
      return res.json({ saved: false });
    }
    await pool.query(`INSERT INTO forum_saved (user_id, question_id) VALUES ($1, $2)`, [req.user.id, req.params.id]);
    res.json({ saved: true });
  } catch (err) { next(err); }
});

// GET /api/forum/saved — get user's saved posts feed
router.get('/saved', requireAuth, async (req, res, next) => {
  try {
    let q = `SELECT fq.*, u.name as asked_by, u.avatar_url as user_avatar_url, u.role as user_role,
              CASE 
                WHEN u.role = 'lawyer' AND u.is_verified THEN 'محامٍ موثوق ✔️'
                WHEN u.role = 'lawyer' THEN 'مستشار قانوني ⚖️'
                ELSE NULL 
              END as user_flair,
              fs.created_at as saved_at,
              (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id AND fa.parent_answer_id IS NULL) as answer_count
              FROM forum_saved fs
              JOIN forum_questions fq ON fs.question_id = fq.id
              LEFT JOIN users u ON u.id=fq.user_id
              WHERE fs.user_id=$1 AND fq.is_visible=true
              ORDER BY fs.created_at DESC`;
    const { rows } = await pool.query(q, [req.user.id]);
    res.json({ questions: rows });
  } catch (err) { next(err); }
});

module.exports = router;
