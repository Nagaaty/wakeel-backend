const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { emitForum, emitToUser }  = require('../utils/socket');

// GET  /api/forum/questions  — supports ?sort=hot|new|top|rising  ?cat= ?search= ?tag=
router.get('/questions', async (req, res, next) => {
  try {
    const { cat, search, tag, sort = 'new', user_id, before, limit } = req.query;
    // Cursor pagination — `before` is the timestamp of the last loaded post.
    // For the 'new' sort this is straightforward; for other sorts we use the
    // post id as a stable secondary cursor to avoid duplicates.
    const pageSize = Math.min(Math.max(parseInt(limit) || 20, 5), 50);

    const flairExpr = `
      CASE
        WHEN u.role = 'lawyer' AND u.is_verified THEN 'محامٍ موثوق ✔️'
        WHEN u.role = 'lawyer' THEN 'مستشار قانوني ⚖️'
        ELSE NULL
      END`;
    const karmaExpr = `(
      COALESCE(fq.likes_count,0) +
      COALESCE((SELECT SUM(fa2.likes_count)*2 FROM forum_answers fa2 WHERE fa2.question_id=fq.id),0)
    )`;
    let q = `SELECT fq.*, u.name as asked_by, u.avatar_url as user_avatar_url, u.role as user_role,
              ${flairExpr} as user_flair,
              ${karmaExpr} as user_karma,
              (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id AND fa.parent_answer_id IS NULL) as answer_count
              FROM forum_questions fq
              LEFT JOIN users u ON u.id=fq.user_id
              WHERE fq.is_visible=true`;
    const params = [];
    if (user_id) { params.push(user_id); q += ` AND fq.user_id=$${params.length}`; }
    if (cat)     { params.push(cat);     q += ` AND fq.category=$${params.length}`; }
    if (search)  { params.push('%'+search+'%'); q += ` AND (fq.question ILIKE $${params.length} OR fq.category ILIKE $${params.length})`; }
    if (tag)     { params.push(JSON.stringify([tag.toLowerCase()])); q += ` AND fq.tags @> $${params.length}::jsonb`; }

    // Cursor — only applied to 'new' sort because other sorts are score-based
    // and the score can shift mid-pagination (a like elsewhere changes ranking).
    // For 'hot' / 'top' / 'rising' we rely on offset = posts already loaded by
    // the client.
    if (before && sort === 'new') {
      params.push(before);
      q += ` AND fq.created_at < $${params.length}`;
    }

    if (sort === 'hot') {
      q += ` ORDER BY (
        3 * COALESCE((SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id AND fa.created_at > NOW()-INTERVAL '24 hours'),0)
        + 3 * COALESCE((SELECT COUNT(*) FROM forum_questions fq2 WHERE fq2.original_post_id=fq.id AND fq2.created_at > NOW()-INTERVAL '24 hours'),0)
        + COALESCE(fq.likes_count,0)
      ) DESC LIMIT ${pageSize}`;
    } else if (sort === 'top') {
      q += ` ORDER BY COALESCE(fq.likes_count,0) DESC LIMIT ${pageSize}`;
    } else if (sort === 'rising') {
      q += ` ORDER BY (
        COALESCE((SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id AND fa.created_at > NOW()-INTERVAL '2 hours'),0)
        + COALESCE(fq.likes_count,0)
      ) DESC, fq.created_at DESC LIMIT ${pageSize}`;
    } else {
      q += ` ORDER BY fq.created_at DESC LIMIT ${pageSize}`;
    }
    const { rows } = await pool.query(q, params);
    // Return next cursor so client knows if more pages exist
    const nextCursor = rows.length === pageSize && rows.length > 0
      ? rows[rows.length - 1].created_at
      : null;
    res.json({ questions: rows, next_cursor: nextCursor, has_more: nextCursor !== null });
  } catch (err) { next(err); }
});

// GET /api/forum/feed — MERGED endpoint (questions + stats + trending in 1 request)
// Replaces 3 separate calls on app mount. Facebook/LinkedIn pattern: one
// waterfall-free payload that hydrates the full feed screen in a single RTT.
router.get('/feed', async (req, res, next) => {
  try {
    const { cat, search, sort = 'hot', limit } = req.query;
    const pageSize = Math.min(Math.max(parseInt(limit) || 20, 5), 50);

    const flairExpr = `
      CASE
        WHEN u.role = 'lawyer' AND u.is_verified THEN 'محامٍ موثوق ✔️'
        WHEN u.role = 'lawyer' THEN 'مستشار قانوني ⚖️'
        ELSE NULL
      END`;
    const karmaExpr = `(
      COALESCE(fq.likes_count,0) +
      COALESCE((SELECT SUM(fa2.likes_count)*2 FROM forum_answers fa2 WHERE fa2.question_id=fq.id),0)
    )`;

    let q = `SELECT fq.*, u.name as asked_by, u.avatar_url as user_avatar_url, u.role as user_role,
              ${flairExpr} as user_flair,
              ${karmaExpr} as user_karma,
              (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id AND fa.parent_answer_id IS NULL) as answer_count
              FROM forum_questions fq
              LEFT JOIN users u ON u.id=fq.user_id
              WHERE fq.is_visible=true`;
    const params = [];
    if (cat)    { params.push(cat);          q += ` AND fq.category=$${params.length}`; }
    if (search) { params.push('%'+search+'%'); q += ` AND (fq.question ILIKE $${params.length} OR fq.category ILIKE $${params.length})`; }

    if (sort === 'hot') {
      q += ` ORDER BY (
        3 * COALESCE((SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id AND fa.created_at > NOW()-INTERVAL '24 hours'),0)
        + 3 * COALESCE((SELECT COUNT(*) FROM forum_questions fq2 WHERE fq2.original_post_id=fq.id AND fq2.created_at > NOW()-INTERVAL '24 hours'),0)
        + COALESCE(fq.likes_count,0)
      ) DESC LIMIT ${pageSize}`;
    } else if (sort === 'top') {
      q += ` ORDER BY COALESCE(fq.likes_count,0) DESC LIMIT ${pageSize}`;
    } else if (sort === 'rising') {
      q += ` ORDER BY (
        COALESCE((SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id AND fa.created_at > NOW()-INTERVAL '2 hours'),0)
        + COALESCE(fq.likes_count,0)
      ) DESC, fq.created_at DESC LIMIT ${pageSize}`;
    } else {
      q += ` ORDER BY fq.created_at DESC LIMIT ${pageSize}`;
    }

    // Run all 3 queries in parallel — single DB connection, zero waterfalling
    const [questionsRes, statsRes, trendingRes] = await Promise.all([
      pool.query(q, params),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM forum_questions WHERE created_at > NOW()-INTERVAL '24 hours' AND is_visible=true) as posts_today,
          (SELECT COUNT(DISTINCT user_id) FROM forum_questions WHERE created_at > NOW()-INTERVAL '7 days' AND is_visible=true) as active_this_week,
          (SELECT COUNT(*) FROM users WHERE role='lawyer' AND is_verified=true) as verified_lawyers,
          (SELECT COUNT(*) FROM forum_questions WHERE is_visible=true) as total_posts
      `),
      pool.query(`
        SELECT tag, COUNT(*) as count
        FROM forum_questions,
             jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS tag
        WHERE created_at > NOW()-INTERVAL '7 days' AND is_visible=true
          AND tag != ''
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 12
      `),
    ]);

    const questions = questionsRes.rows;
    const nextCursor = questions.length === pageSize && questions.length > 0
      ? questions[questions.length - 1].created_at
      : null;

    res.json({
      questions,
      next_cursor: nextCursor,
      has_more: nextCursor !== null,
      stats: statsRes.rows[0] || null,
      trending: trendingRes.rows || [],
    });
  } catch (err) { next(err); }
});



// GET /api/forum/stats — community stats widget
router.get('/stats', async (req, res, next) => {
  try {
    const { rows: [stats] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM forum_questions WHERE created_at > NOW()-INTERVAL '24 hours' AND is_visible=true) as posts_today,
        (SELECT COUNT(DISTINCT user_id) FROM forum_questions WHERE created_at > NOW()-INTERVAL '7 days' AND is_visible=true) as active_this_week,
        (SELECT COUNT(*) FROM users WHERE role='lawyer' AND is_verified=true) as verified_lawyers,
        (SELECT COUNT(*) FROM forum_questions WHERE is_visible=true) as total_posts
    `);
    res.json({ stats });
  } catch (err) { next(err); }
});

// GET /api/forum/trending — top hashtags used in last 7 days
router.get('/trending', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT tag, COUNT(*) as count
      FROM forum_questions,
           jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS tag
      WHERE created_at > NOW()-INTERVAL '7 days' AND is_visible=true
        AND tag != ''
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 12
    `);
    res.json({ trending: rows });
  } catch (err) { next(err); }
});

// GET /api/forum/mentionable-users?q=search — @mention autocomplete
router.get('/mentionable-users', requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const { rows } = await pool.query(
      `SELECT id, name, role,
              CASE
                WHEN role = 'lawyer' AND is_verified THEN 'محامٍ موثوق ✔️'
                WHEN role = 'lawyer' THEN 'مستشار قانوني ⚖️'
                ELSE NULL
              END as flair
       FROM users
       WHERE ($1 = '' OR name ILIKE $2) AND id != $3
       ORDER BY
         CASE WHEN role='lawyer' AND is_verified THEN 0 WHEN role='lawyer' THEN 1 ELSE 2 END, name
       LIMIT 8`,
      [q, '%' + q + '%', req.user.id]
    );
    res.json({ users: rows });
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
    // Allow image-only posts — question text is optional when an image is provided
    if ((!question || !question.trim()) && !image_url) return res.status(400).json({ message: 'question text or image required' });
    if (!category) return res.status(400).json({ message: 'category required' });
    // Use a single space as placeholder for image-only posts so DB NOT NULL constraint is satisfied
    const questionText = (question && question.trim()) ? question.trim() : '';
    // Extract hashtags from question text (supports Arabic + Latin + underscore)
    const tags = (questionText.match(/#[\w\u0600-\u06FF_]+/g) || []).map(t => t.toLowerCase());
    const { rows: [row] } = await pool.query(
      `INSERT INTO forum_questions (user_id, question, category, anonymous, is_visible, image_url, original_post_id, original_post_data, tags)
       VALUES ($1,$2,$3,$4,true,$5,$6,$7::jsonb,$8::jsonb) RETURNING *`,
      [req.user.id, questionText || ' ', category, anonymous !== false, image_url || null,
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

// POST /api/forum/questions/:id/dislike — TOGGLE dislike
router.post('/questions/:id/dislike', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id.toString();
    const { rows: [pre] } = await pool.query(
      `SELECT
         COALESCE(disliked_by,'[]'::jsonb) @> $2::jsonb AS already_disliked,
         COALESCE(liked_by,'[]'::jsonb)    @> $2::jsonb AS already_liked
       FROM forum_questions WHERE id=$1`,
      [req.params.id, JSON.stringify([userId])]
    );
    if (!pre) return res.status(404).json({ message: 'Post not found' });

    // If currently liked, remove that like first
    if (pre.already_liked) {
      await pool.query(
        `UPDATE forum_questions
           SET likes_count = GREATEST(0,COALESCE(likes_count,0)-1),
               liked_by = (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(liked_by,'[]'::jsonb)) AS x WHERE x != to_jsonb($2::text))
         WHERE id=$1`,
        [req.params.id, userId]
      );
    }

    if (pre.already_disliked) {
      // Un-dislike
      const { rows: [row] } = await pool.query(
        `UPDATE forum_questions
           SET dislikes_count = GREATEST(0,COALESCE(dislikes_count,0)-1),
               disliked_by = (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(disliked_by,'[]'::jsonb)) AS x WHERE x != to_jsonb($2::text))
         WHERE id=$1 RETURNING *`,
        [req.params.id, userId]
      );
      return res.json({ question: row, disliked: false });
    }

    const { rows: [row] } = await pool.query(
      `UPDATE forum_questions
         SET dislikes_count = COALESCE(dislikes_count,0)+1,
             disliked_by = COALESCE(disliked_by,'[]'::jsonb) || $2::jsonb
       WHERE id=$1 RETURNING *`,
      [req.params.id, JSON.stringify([userId])]
    );
    res.json({ question: row, disliked: true });
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
      // Emit live badge update to the post author's bell
      emitToUser(pre.user_id, 'notification:new', { type: 'forum_like', postId: parseInt(req.params.id) });
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
    // Re-extract hashtags from the new text (same regex as on create) so an
    // edited post that adds/removes #tags is reflected in the hashtag feed.
    const tags = (question.match(/#[\w\u0600-\u06FF_]+/g) || [])
      .map(t => t.toLowerCase());
    const { rows: [row] } = await pool.query(
      `UPDATE forum_questions
          SET question = $2,
              tags     = $4::jsonb
        WHERE id      = $1
          AND user_id = $3
          AND is_visible = true
        RETURNING *`,
      [req.params.id, question, req.user.id, JSON.stringify(tags)]
    );
    if (!row) return res.status(403).json({ message: 'Not found or not authorized' });
    res.json({ question: row });
  } catch (err) { next(err); }
});

// POST /api/forum/answers/:id/like — toggle like on a comment (mutually exclusive with dislike)
router.post('/answers/:id/like', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id.toString();
    const { rows: [pre] } = await pool.query(
      `SELECT liked_by @> $2::jsonb AS already_liked,
              disliked_by @> $2::jsonb AS already_disliked,
              lawyer_id 
       FROM forum_answers WHERE id=$1`,
      [req.params.id, JSON.stringify([userId])]
    );
    if (!pre) return res.status(404).json({ message: 'Answer not found' });

    const { updateLawyerKarma } = require('../utils/reputation');

    // If disliked, remove the dislike
    if (pre.already_disliked) {
      await pool.query(
        `UPDATE forum_answers
         SET dislikes_count = GREATEST(0, COALESCE(dislikes_count, 0) - 1),
             disliked_by = (
               SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
               FROM jsonb_array_elements(COALESCE(disliked_by, '[]'::jsonb)) AS x
               WHERE x != to_jsonb($2::text)
             )
         WHERE id=$1`,
        [req.params.id, userId]
      );
    }

    if (pre.already_liked) {
      const { rows: [row] } = await pool.query(
        `UPDATE forum_answers
           SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1),
               liked_by = (
                 SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
                 FROM jsonb_array_elements(COALESCE(liked_by, '[]'::jsonb)) AS x
                 WHERE x != to_jsonb($2::text)
               )
         WHERE id=$1 RETURNING id, likes_count, dislikes_count`,
        [req.params.id, userId]
      );
      if (pre.lawyer_id) updateLawyerKarma(pre.lawyer_id);
      return res.json({ answer: row, liked: false });
    }

    const { rows: [row] } = await pool.query(
      `UPDATE forum_answers
         SET likes_count = COALESCE(likes_count, 0) + 1,
             liked_by = COALESCE(liked_by, '[]'::jsonb) || $2::jsonb
       WHERE id=$1 RETURNING id, likes_count, dislikes_count`,
      [req.params.id, JSON.stringify([userId])]
    );
    if (pre.lawyer_id) updateLawyerKarma(pre.lawyer_id);
    res.json({ answer: row, liked: true });
  } catch (err) { next(err); }
});

// POST /api/forum/answers/:id/dislike — toggle dislike on a comment (mutually exclusive with like)
router.post('/answers/:id/dislike', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id.toString();
    const { rows: [pre] } = await pool.query(
      `SELECT liked_by @> $2::jsonb AS already_liked,
              disliked_by @> $2::jsonb AS already_disliked,
              lawyer_id 
       FROM forum_answers WHERE id=$1`,
      [req.params.id, JSON.stringify([userId])]
    );
    if (!pre) return res.status(404).json({ message: 'Answer not found' });

    const { updateLawyerKarma } = require('../utils/reputation');

    // If liked, remove the like
    if (pre.already_liked) {
      await pool.query(
        `UPDATE forum_answers
         SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1),
             liked_by = (
               SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
               FROM jsonb_array_elements(COALESCE(liked_by, '[]'::jsonb)) AS x
               WHERE x != to_jsonb($2::text)
             )
         WHERE id=$1`,
        [req.params.id, userId]
      );
      if (pre.lawyer_id) updateLawyerKarma(pre.lawyer_id); // Since they lost a like
    }

    if (pre.already_disliked) {
      const { rows: [row] } = await pool.query(
        `UPDATE forum_answers
           SET dislikes_count = GREATEST(0, COALESCE(dislikes_count, 0) - 1),
               disliked_by = (
                 SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
                 FROM jsonb_array_elements(COALESCE(disliked_by, '[]'::jsonb)) AS x
                 WHERE x != to_jsonb($2::text)
               )
         WHERE id=$1 RETURNING id, likes_count, dislikes_count`,
        [req.params.id, userId]
      );
      return res.json({ answer: row, disliked: false });
    }

    const { rows: [row] } = await pool.query(
      `UPDATE forum_answers
         SET dislikes_count = COALESCE(dislikes_count, 0) + 1,
             disliked_by = COALESCE(disliked_by, '[]'::jsonb) || $2::jsonb
       WHERE id=$1 RETURNING id, likes_count, dislikes_count`,
      [req.params.id, JSON.stringify([userId])]
    );
    res.json({ answer: row, disliked: true });
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
          `/post/${postId}?commentId=${row?.id || ''}`,
          JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: parseInt(postId), commentId: row?.id, postSnippet: snippet, commentSnippet: answerSnip, action: 'comment' }),
        ]
      ).catch(console.error);
      emitToUser(post.user_id, 'notification:new', { type: 'forum_comment', postId: parseInt(postId), commentId: row?.id });
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
            `/post/${req.params.id}?commentId=${row?.id || ''}`,
            JSON.stringify({ actorId: actor.id, actorName: actor.name, actorAvatar: actor.avatar_url || null, actorRole: actor.role, postId: parseInt(req.params.id), commentId: row?.id, commentSnippet: answerSnip, action: 'reply' }),
          ]
        ).catch(console.error);
        emitToUser(parentComment.lawyer_id, 'notification:new', { type: 'forum_reply', postId: parseInt(req.params.id), commentId: row?.id });
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
      emitToUser(row.user_id, 'notification:new', { type: 'forum_share', postId: repostId ? parseInt(repostId) : parseInt(req.params.id) });
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
