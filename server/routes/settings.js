const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../db/connection');

// GET /api/settings/payment — public, used by wallet deposit screen
router.get('/payment', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT key_name, value FROM settings WHERE key_name IN ('telebirr_number','telebirr_name','cbe_number','cbe_name')"
    );
    const s = {};
    rows.forEach(r => { s[r.key_name] = r.value; });
    res.json({
      telebirr: { number: s.telebirr_number || '', name: s.telebirr_name || '' },
      cbe:      { number: s.cbe_number      || '', name: s.cbe_name      || '' },
    });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// PUT /api/settings/payment — admin only
router.put('/payment', requireAuth, requireAdmin, async (req, res) => {
  const { telebirr_number, telebirr_name, cbe_number, cbe_name } = req.body;

  const updates = [
    ['telebirr_number', (telebirr_number || '').toString().trim()],
    ['telebirr_name',   (telebirr_name   || '').toString().trim()],
    ['cbe_number',      (cbe_number      || '').toString().trim()],
    ['cbe_name',        (cbe_name        || '').toString().trim()],
  ].filter(([, v]) => v.length > 0);

  if (!updates.length) return res.status(400).json({ error: 'No valid fields provided' });

  try {
    for (const [k, v] of updates) {
      await db.query(
        'INSERT INTO settings (key_name, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',
        [k, v]
      );
    }
    res.json({ message: 'Payment settings updated' });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
