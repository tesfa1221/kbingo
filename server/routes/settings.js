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

// GET /api/settings/bot-win-chance — get bot win chance 0-100 (admin)
router.get('/bot-win-chance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT value FROM settings WHERE key_name='bot_win_chance'");
    res.json({ chance: rows.length ? parseInt(rows[0].value) : 40 });
  } catch { res.json({ chance: 40 }); }
});

// PUT /api/settings/bot-win-chance — set bot win chance 0-100 (admin)
router.put('/bot-win-chance', requireAuth, requireAdmin, async (req, res) => {
  const chance = Math.max(0, Math.min(100, parseInt(req.body.chance) || 40));
  try {
    await db.query(
      "INSERT INTO settings (key_name, value) VALUES ('bot_win_chance', ?) ON DUPLICATE KEY UPDATE value=VALUES(value)",
      [String(chance)]
    );
    res.json({ message: `Bot win chance set to ${chance}%`, chance });
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

// ─── Promotion Routes ─────────────────────────────────────

// GET /api/settings/promos — list all promos (admin)
router.get('/promos', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM promotions ORDER BY id ASC');
    res.json({ promos: rows });
  } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// POST /api/settings/promos — add new promo (admin)
router.post('/promos', requireAuth, requireAdmin, async (req, res) => {
  const text = (req.body.text_body || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Text required' });
  try {
    const [result] = await db.query('INSERT INTO promotions (text_body) VALUES (?)', [text]);
    const [rows]   = await db.query('SELECT * FROM promotions WHERE id=?', [result.insertId]);
    res.status(201).json({ message: 'Promo added', promo: rows[0] });
  } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// PUT /api/settings/promos/:id — edit promo (admin)
router.put('/promos/:id', requireAuth, requireAdmin, async (req, res) => {
  const id       = parseInt(req.params.id);
  const text     = (req.body.text_body || '').toString().trim();
  const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : undefined;

  if (!text) return res.status(400).json({ error: 'Text required' });
  try {
    const updates = ['text_body=?'];
    const values  = [text];
    if (isActive !== undefined) { updates.push('is_active=?'); values.push(isActive); }
    values.push(id);
    await db.query(`UPDATE promotions SET ${updates.join(',')} WHERE id=?`, values);
    res.json({ message: 'Promo updated' });
  } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// DELETE /api/settings/promos/:id — delete promo (admin)
router.delete('/promos/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.query('DELETE FROM promotions WHERE id=?', [id]);
    res.json({ message: 'Promo deleted' });
  } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// POST /api/settings/promos/send-now — send a specific promo immediately (admin)
router.post('/promos/send-now', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.body.id);
  try {
    const [rows] = await db.query('SELECT * FROM promotions WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Promo not found' });

    const { sendMessage } = require('../telegram/bot');
    const MINI_APP_URL = process.env.MINI_APP_URL || 'https://negattech.com/kbingo';
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 K Bingo ጫወት', web_app: { url: MINI_APP_URL } }
        ]]
      }
    };

    const [users] = await db.query(
      `SELECT DISTINCT u.telegram_id FROM users u
       JOIN tickets t ON t.user_id=u.id
       JOIN games g ON g.id=t.game_id
       WHERE u.telegram_id IS NOT NULL AND u.is_bot=0
         AND g.finished_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       LIMIT 500`
    );

    let sent = 0;
    for (const user of users) {
      try {
        await sendMessage(user.telegram_id, rows[0].text_body, keyboard);
        sent++;
        await new Promise(r => setTimeout(r, 100));
      } catch { /* user blocked bot */ }
    }

    res.json({ message: `Sent to ${sent} users` });
  } catch (err) { res.status(500).json({ error: 'DB error: ' + err.message }); }
});
