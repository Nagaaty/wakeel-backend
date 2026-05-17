const pool = require('../config/db');

/**
 * Real-Time Reputation Agent
 * Instantly recalculates the Karma Score for a specific lawyer bridging their total impact 
 * safely without locking the database or risking sync issues.
 */
async function updateLawyerKarma(lawyerId) {
  if (!lawyerId) return;
  try {
    const rawSql = `
      UPDATE lawyer_profiles lp 
      SET karma_score = (
        (COALESCE(lp.accepted_answers, 0) * 10) +
        (COALESCE((SELECT SUM(likes_count) FROM forum_answers WHERE lawyer_id = lp.user_id), 0) * 2) +
        (COALESCE((SELECT COUNT(*) FROM reviews WHERE lawyer_id = lp.user_id AND rating = 5), 0) * 5)
      )
      WHERE user_id = $1
    `;
    await pool.query(rawSql, [lawyerId]);
  } catch (err) {
    console.error('[Reputation Agent] Failed to update karma for lawyer', lawyerId, err.message);
  }
}

module.exports = { updateLawyerKarma };
