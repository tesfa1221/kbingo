const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../db/connection');

// GET /api/settings/bots — get bots enabled status (admin)
router.get('/bots-enabled', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT value FROM settings WHERE key_name='bots_enabled'");
    res.json({ enabled: rows.length === 0 || rows[0].value !== '0' });
  } catch { res.json({ enabled: true }); }
});

// PUT /api/settings/bots-enabled — toggle bots on/off (admin)
router.put('/bots-enabled', requireAuth, requireAdmin, async (req, res) => {
  const enabled = req.body.enabled !== false && req.body.enabled !== 'false';
  try {
    await db.query(
      "INSERT INTO settings (key_name, value) VALUES ('bots_enabled', ?) ON DUPLICATE KEY UPDATE value=VALUES(value)",
      [enabled ? '1' : '0']
    );
    res.json({ message: `Bots ${enabled ? 'enabled' : 'disabled'}`, enabled });
  } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

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
