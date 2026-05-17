-- ─── Wakeel — Migration 005: Profile Privacy + Pinned Posts ──────────────────
-- 1) users.forum_activity_public — boolean. Controls whether a user's forum
--    posts/likes/comments show up on their public profile (Activity tab).
--    Default behavior:
--      • Lawyers   → true   (their forum activity is content marketing)
--      • Clients   → false  (their forum questions can be sensitive)
--    Clients can opt-in via account settings.
--
-- 2) forum_questions.is_pinned — boolean. Lawyer can pin up to 2 of their
--    own posts to the top of their public profile (LinkedIn "Featured"
--    pattern). Enforcement of "max 2 pinned" lives in the backend route.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Privacy toggle on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS forum_activity_public BOOLEAN DEFAULT NULL;

-- Backfill: lawyers default to public, clients default to private.
-- Existing rows where the column is NULL get filled in based on their role.
UPDATE users
   SET forum_activity_public = (role = 'lawyer')
 WHERE forum_activity_public IS NULL;

-- After backfill, set a sensible default for new rows. NEW client signups
-- get FALSE; new lawyer signups can be set to TRUE in the registration
-- handler (or relied on the user's role-aware default below in queries).
ALTER TABLE users
  ALTER COLUMN forum_activity_public SET DEFAULT false;

-- 2) Pinned posts on forum_questions
ALTER TABLE forum_questions
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_forum_questions_pinned
  ON forum_questions(user_id, is_pinned)
  WHERE is_pinned = true;
