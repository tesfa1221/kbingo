const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const db     = require('../db/connection');
const {
  localRegister,
  localLogin,
  telegramLogin,
  requireAuth,
  sanitizeUser,
} = require('../middleware/auth');

// ── Local auth ────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', localRegister);

// POST /api/auth/login
router.post('/login', localLogin);

// ── Telegram auth ─────────────────────────────────────────
// POST /api/auth/telegram
router.post('/telegram', telegramLogin);

// ── Session ───────────────────────────────────────────────
// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// POST /api/auth/logout  (client just drops the token, but this is a clean endpoint)
router.post('/logout', requireAuth, (req, res) => {
  res.json({ message: 'Logged out' });
});

// ── Dev-only seed admin ───────────────────────────────────
// POST /api/auth/dev-login  (disabled in production)
router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  try {
    const bcrypt = require('bcryptjs');
    const hash   = await bcrypt.hash('admin123', 12);

    await db.query(
      `INSERT INTO users (username, first_name, is_admin, balance, password_hash)
       VALUES ('admin', 'Admin', 1, 1000.00, ?)
       ON DUPLICATE KEY UPDATE
         is_admin      = 1,
         balance       = IF(balance < 50, 1000.00, balance),
         password_hash = IF(password_hash IS NULL, VALUES(password_hash), password_hash)`,
      [hash]
    );

    const [rows] = await db.query("SELECT * FROM users WHERE username = 'admin'");
    const user   = rows[0];
    const token  = jwt.sign(
      { userId: user.id, telegramId: null },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('dev-login error:', err);
    return res.status(500).json({ error: 'Dev login failed: ' + err.message });
  }
});

// ── Admin: reset any user's password ─────────────────────
// POST /api/auth/admin/reset-password  (admin only)
router.post('/admin/reset-password', requireAuth, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'userId and newPassword (min 6 chars) required' });
  }
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash=? WHERE id=?', [hash, userId]);
  res.json({ message: 'Password reset successfully' });
});

// ── Change own password ───────────────────────────────────
// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'currentPassword and newPassword (min 6) required' });
  }
  const bcrypt = require('bcryptjs');
  const [rows] = await db.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
  const user = rows[0];
  if (!user.password_hash) return res.status(400).json({ error: 'No password set on this account' });
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
  const hash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.user.id]);
  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
