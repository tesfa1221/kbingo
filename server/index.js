require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
const db         = require('./db/connection');
const { GameEngine, ROOM_PRESETS } = require('./game/GameEngine');
const { postWinnerToTelegram, startDailySummaryCron } = require('./cron/telegramPost');

const authRoutes                        = require('./routes/auth');
const { router: gameRoutes, setEngines } = require('./routes/game');
const walletRoutes                      = require('./routes/wallet');

process.on('uncaughtException',  (err)    => console.error('❌ Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled Rejection:', reason?.message || reason));

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout:       30000,
  pingInterval:      10000,
  perMessageDeflate: true,
  httpCompression:   true,
});

const compression = require('compression');

// ... (existing requires above)

app.use(compression());  // gzip all responses
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Rate limiters ────────────────────────────────────────
const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } });
const authLimiter    = rateLimit({ windowMs: 15*60*1000, max: 10,  standardHeaders: true, legacyHeaders: false, message: { error: 'Too many auth attempts.' } });
app.use('/api/', generalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Routes ──────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/game',   gameRoutes);
app.use('/api/wallet', walletRoutes);
app.get('/health', (_, res) => res.json({ status: 'ok', rooms: Object.keys(engines) }));

// ─── Game Engines (one per room) ─────────────────────────
const engines = {
  standard: new GameEngine(io, 'standard'),
  premium:  new GameEngine(io, 'premium'),
};
setEngines(engines);

// Hook Telegram post into each engine
Object.values(engines).forEach(engine => {
  const _orig = engine._finalizeWinners.bind(engine);
  engine._finalizeWinners = async function () {
    await _orig();
    const winnerDetails = await Promise.all(
      this.winners.map(async w => {
        const [rows] = await db.query('SELECT first_name, username FROM users WHERE id=?', [w.userId]);
        return { ...w, ...rows[0] };
      })
    );
    postWinnerToTelegram({
      gameCode:   this.gameCode,
      winners:    winnerDetails,
      prizeShare: this.netPrize / Math.max(this.winners.length, 1),
      netPrize:   this.netPrize,
    });
  };
});

// ─── Socket.io ───────────────────────────────────────────
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const [rows] = await db.query('SELECT * FROM users WHERE id=?', [payload.userId]);
      if (rows.length) {
        socket.user = rows[0];
        socket.join(`user:${rows[0].id}`);
      }
    } catch { /* anonymous */ }
  }
  next();
});

io.on('connection', (socket) => {
  const userId = socket.user?.id;
  console.log(`🔌 Socket connected: ${socket.id} (user: ${userId || 'anon'})`);

  // Client must join a room — default to 'standard'
  const joinRoom = (roomId) => {
    const engine = engines[roomId] || engines.standard;
    // Leave other game rooms first
    Object.keys(engines).forEach(r => socket.leave(r));
    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.emit('game:snapshot', engine.getSnapshot());
    console.log(`🚪 ${socket.id} joined room: ${roomId}`);
  };

  // Auto-join standard on connect
  joinRoom('standard');

  socket.on('room:join', ({ roomId }) => {
    if (engines[roomId]) joinRoom(roomId);
    else socket.emit('error', { message: 'Room not found' });
  });

  // Send all room snapshots for the room selector UI
  socket.on('rooms:list', () => {
    socket.emit('rooms:data', Object.entries(engines).map(([id, e]) => e.getSnapshot()));
  });

  socket.on('card:preview', ({ cardNumber }) => {
    const { generateCard } = require('./utils/cardGenerator');
    const num = parseInt(cardNumber);
    if (num >= 1 && num <= 100) socket.emit('card:preview_data', { cardNumber: num, grid: generateCard(num) });
  });

  socket.on('card:select', async ({ cardNumber }) => {
    if (!socket.user) return socket.emit('error', { message: 'Authentication required' });
    const engine = engines[socket.currentRoom] || engines.standard;
    const result = await engine.selectCard(socket.user.id, parseInt(cardNumber));
    socket.emit('card:select_result', result);
  });

  socket.on('bingo:claim', async () => {
    if (!socket.user) return socket.emit('error', { message: 'Authentication required' });
    const engine = engines[socket.currentRoom] || engines.standard;
    const result = await engine.claimBingo(socket.user.id);
    socket.emit('bingo:result', result);
    // No disconnect on failed claim — just inform the user
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ─── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Keep Render free tier awake (pings itself every 14 min) ─
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
  const https = require('https');
  setInterval(() => {
    https.get(`${process.env.RENDER_EXTERNAL_URL}/health`, () => {
      console.log('🏓 Self-ping to stay awake');
    }).on('error', () => {});
  }, 14 * 60 * 1000);
}

// ─── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  Object.values(engines).forEach(e => e.start());
  startDailySummaryCron();
});
