const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { generateCard } = require('../utils/cardGenerator');
const { ROOM_PRESETS } = require('../game/GameEngine');

let engines = {};
function setEngines(e) { engines = e; }
function getEngine(roomId) { return engines[roomId] || engines.standard; }

// GET /api/game/rooms — All room snapshots
router.get('/rooms', (req, res) => {
  res.json({ rooms: Object.values(engines).map(e => e.getSnapshot()) });
});

// GET /api/game/state — Current game snapshot (default room or ?room=)
router.get('/state', (req, res) => {
  const engine = getEngine(req.query.room || 'standard');
  if (!engine) return res.status(503).json({ error: 'Engine not ready' });
  res.json(engine.getSnapshot());
});

// POST /api/game/set-entry-fee — Admin sets next round entry fee
router.post('/set-entry-fee', requireAuth, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  const fee    = parseFloat(req.body.entryFee);
  const roomId = req.body.roomId || 'standard';
  const allowed = [5, 10, 25, 50, 100];
  if (!allowed.includes(fee)) return res.status(400).json({ error: `Fee must be one of: ${allowed.join(', ')} ETB` });
  const engine = getEngine(roomId);
  engine.entryFee = fee;
  engine.preset.entryFee = fee;
  res.json({ message: `Entry fee set to ${fee} ETB for room ${roomId}` });
});

// POST /api/game/set-min-prize — Admin sets minimum prize guarantee
router.post('/set-min-prize', requireAuth, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  const minPrize = parseFloat(req.body.minPrize);
  const roomId   = req.body.roomId || 'standard';
  if (isNaN(minPrize) || minPrize < 0) return res.status(400).json({ error: 'Invalid minPrize' });
  const engine = getEngine(roomId);
  engine.minPrize = minPrize;
  engine.preset.minPrize = minPrize;
  res.json({ message: `Min prize set to ${minPrize} ETB for room ${roomId}` });
});

// GET /api/game/card/:number — Preview a card
router.get('/card/:number', (req, res) => {
  const num = parseInt(req.params.number);
  if (isNaN(num) || num < 1 || num > 100) return res.status(400).json({ error: 'Card number must be 1-100' });
  res.json({ cardNumber: num, grid: generateCard(num) });
});

// POST /api/game/select — Select a card
router.post('/select', requireAuth, async (req, res) => {
  const { cardNumber, roomId } = req.body;
  if (!cardNumber) return res.status(400).json({ error: 'cardNumber required' });
  const engine = getEngine(roomId || 'standard');
  const result = await engine.selectCard(req.user.id, parseInt(cardNumber));
  if (!result.ok) return res.status(400).json({ error: result.reason });
  res.json(result);
});

// POST /api/game/bingo — Claim BINGO
router.post('/bingo', requireAuth, async (req, res) => {
  const engine = getEngine(req.body.roomId || 'standard');
  const result = await engine.claimBingo(req.user.id);
  if (!result.ok) return res.status(result.penalty ? 403 : 400).json({ error: result.reason, penalty: result.penalty });
  res.json(result);
});

// GET /api/game/leaderboard — real players only, no bots
router.get('/leaderboard', async (req, res) => {
  const db = require('../db/connection');
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.first_name, u.username, u.photo_url,
             COUNT(w.id)        AS wins_this_week,
             SUM(w.prize_share) AS earnings_this_week
      FROM users u
      JOIN winners w ON w.user_id = u.id
      WHERE w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND u.is_bot = 0
      GROUP BY u.id
      ORDER BY earnings_this_week DESC
      LIMIT 20
    `);
    res.json({ leaderboard: rows });
  } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// GET /api/game/history — show real winners only (hide bots)
router.get('/history', async (req, res) => {
  const db = require('../db/connection');
  try {
    const [games] = await db.query(
      `SELECT g.id, g.game_code, g.room_id, g.prize_pool, g.net_prize, g.winning_pattern,
              g.finished_at, g.entry_fee,
              COUNT(DISTINCT CASE WHEN u.is_bot=0 THEN t.user_id END) as player_count
       FROM games g
       LEFT JOIN tickets t ON t.game_id=g.id
       LEFT JOIN users u ON u.id=t.user_id
       WHERE g.state='FINISHED'
       GROUP BY g.id ORDER BY g.finished_at DESC LIMIT 20`
    );
    const history = await Promise.all(games.map(async (g) => {
      // Only show real player winners
      const [winners] = await db.query(
        `SELECT w.prize_share, w.pattern, w.winning_ball, u.first_name, u.username, u.id as user_id
         FROM winners w
         JOIN users u ON u.id=w.user_id
         WHERE w.game_id=? AND u.is_bot=0`, [g.id]
      );
      return { ...g, winners };
    }));
    res.json({ history });
  } catch (err) { console.error('History error:', err); res.status(500).json({ error: 'DB error' }); }
});

module.exports = { router, setEngines };
