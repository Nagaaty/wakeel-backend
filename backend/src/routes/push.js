const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { saveToken, removeToken } = require('../utils/push');

// POST /api/push/register — save device push token
router.post('/register', requireAuth, async (req, res, next) => {
  try {
    const { token, platform = 'web' } = req.body;
    if (!token) return res.status(400).json({ message: 'token required' });
    await saveToken(req.user.id, token, platform);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/push/register — remove push token on logout
router.delete('/register', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (token) await removeToken(req.user.id, token);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
