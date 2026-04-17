const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET  /api/forum/questions
router.get('/questions', async (req, res, next) => {
  try {
    const { cat, search } = req.query;
    let q = `SELECT fq.*, u.name as asked_by, u.avatar_url as user_avatar_url, u.role as user_role,
              (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id) as answer_count
              FROM forum_questions fq
              LEFT JOIN users u ON u.id=fq.user_id
              WHERE fq.is_visible=true`;
    const params = [];
    if (cat)    { params.push(cat);    q += ` AND fq.category=$${params.length}`; }
    if (search) { params.push('%'+search+'%'); q += ` AND (fq.question ILIKE $${params.length} OR fq.category ILIKE $${params.length})`; }
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



// POST /api/forum/questions
router.post('/questions', requireAuth, async (req, res, next) => {
  try {
    const { question, category, anonymous, image_url, original_post_id, original_post_data } = req.body;
    if (!question || !category) return res.status(400).json({ message: 'question and category required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO forum_questions (user_id, question, category, anonymous, is_visible, image_url, original_post_id, original_post_data)
       VALUES ($1,$2,$3,$4,true,$5,$6,$7::jsonb) RETURNING *`,
      [req.user.id, question, category, anonymous !== false, image_url || null,
       original_post_id || null, original_post_data ? JSON.stringify(original_post_data) : null]
    );
    res.status(201).json({
      question: {
        ...row,
        asked_by: anonymous ? 'Anonymous' : req.user.name,
        user_avatar_url: anonymous ? null : req.user.avatar_url,
        user_role: req.user.role,
        answer_count: 0, views: 1,
      }
    });
  } catch (err) { next(err); }
});

// POST /api/forum/questions/:id/like  — idempotent, fixed notification bug
router.post('/questions/:id/like', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id.toString();

    // ── PRE-CHECK (before UPDATE) because RETURNING evaluates post-mutation
    const { rows: [pre] } = await pool.query(
      `SELECT liked_by @> $2::jsonb AS already_liked, user_id, question
       FROM forum_questions WHERE id=$1`,
      [req.params.id, JSON.stringify([userId])]
    );
    if (!pre) return res.status(404).json({ message: 'Post not found' });

    const wasAlreadyLiked = !!pre.already_liked;

    // ── UPDATE
    const { rows: [row] } = await pool.query(
      `UPDATE forum_questions
         SET likes_count = CASE
               WHEN liked_by @> $2::jsonb THEN likes_count
               ELSE COALESCE(likes_count, 0) + 1
             END,
             liked_by = COALESCE(
               CASE WHEN liked_by @> $2::jsonb THEN liked_by
                    ELSE liked_by || $2::jsonb END,
               $2::jsonb)
       WHERE id=$1 RETURNING *`,
      [req.params.id, JSON.stringify([userId])]
    );

    // ── NOTIFY only on first like
    if (!wasAlreadyLiked && pre.user_id && pre.user_id.toString() !== req.user.id.toString()) {
      const actor   = req.user;
      const snippet = (pre.question || '').substring(0, 80);
      const postId  = req.params.id;
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link, data)
         VALUES ($1,'forum_like',$2,$3,$4,$5::jsonb)`,
        [
          pre.user_id,
          `👍 ${actor.name} أعجبه منشورك`,
          `"${snippet}${snippet.length >= 80 ? '…' : ''}"`,
          `/post/${postId}`,
          JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: parseInt(postId), postSnippet: snippet, action: 'like' }),
        ]
      ).catch(console.error);
    }

    res.json({ question: row, already_liked: wasAlreadyLiked });
  } catch (err) {
    // Fallback if liked_by column doesn't exist yet
    try {
      const { rows: [pre] } = await pool.query(
        `SELECT user_id, question FROM forum_questions WHERE id=$1`, [req.params.id]
      ).catch(() => ({ rows: [null] }));
      const { rows: [row] } = await pool.query(
        `UPDATE forum_questions SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id=$1 RETURNING *`,
        [req.params.id]
      );
      if (!row) return res.status(404).json({ message: 'Post not found' });
      if (pre && pre.user_id && pre.user_id.toString() !== req.user.id.toString()) {
        const actor   = req.user;
        const snippet = (pre.question || '').substring(0, 80);
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, link, data)
           VALUES ($1,'forum_like',$2,$3,$4,$5::jsonb)`,
          [
            pre.user_id,
            `👍 ${actor.name} أعجبه منشورك`,
            `"${snippet}${snippet.length >= 80 ? '…' : ''}"`,
            `/post/${row.id}`,
            JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: row.id, postSnippet: snippet, action: 'like' }),
          ]
        ).catch(console.error);
      }
      res.json({ question: row });
    } catch (e2) { next(e2); }
  }
});

// GET /api/forum/questions/:id/answers
router.get('/questions/:id/answers', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT fa.*, u.name as lawyer_name, u.avatar_url as lawyer_avatar, u.role as lawyer_role, lp.specialization
       FROM forum_answers fa
       JOIN users u ON u.id=fa.lawyer_id
       LEFT JOIN lawyer_profiles lp ON lp.user_id=fa.lawyer_id
       WHERE fa.question_id=$1 ORDER BY fa.is_accepted DESC, fa.upvotes DESC`,
      [req.params.id]
    );
    res.json({ answers: rows });
  } catch (err) { next(err); }
});

// POST /api/forum/questions/:id/answers
router.post('/questions/:id/answers', requireAuth, async (req, res, next) => {
  try {
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ message: 'answer required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO forum_answers (question_id, lawyer_id, answer) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.user.id, answer]
    );

    // Notify post author
    const { rows: [post] } = await pool.query(
      `SELECT user_id, question FROM forum_questions WHERE id=$1`, [req.params.id]
    ).catch(() => ({ rows: [] }));

    if (post && post.user_id && post.user_id.toString() !== req.user.id.toString()) {
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
    }

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
      const actor   = req.user;
      const snippet = (row.question || '').substring(0, 80);
      const postId  = req.params.id;
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link, data)
         VALUES ($1,'forum_share',$2,$3,$4,$5::jsonb)`,
        [
          row.user_id,
          `🔁 ${actor.name} أعاد نشر منشورك`,
          `"${snippet}${snippet.length >= 80 ? '…' : ''}"`,
          `/post/${postId}`,
          JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: parseInt(postId), postSnippet: snippet, action: 'share' }),
        ]
      ).catch(console.error);
    }

    res.json({ question: row });
  } catch (err) { next(err); }
});

module.exports = router;
