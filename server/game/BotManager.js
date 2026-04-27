/**
 * BotManager — fills empty seats with bot players.
 *
 * Rules:
 *  - Bots join at second 25 of registration (halfway through 45s)
 *  - Only join if real player count < TARGET_PLAYERS
 *  - Bots pick random available cards
 *  - During ACTIVE phase, bots attempt BINGO at a random ball (20-40)
 *    using real server-side validation — they only win if they genuinely have a line
 *  - Bot wins are treated exactly like real wins (money stays in house)
 *  - Bot balance auto-refills from house earnings when < 100 ETB
 */
const db = require('../db/connection');
const { validateBingo } = require('../utils/bingoValidator');

const TARGET_MIN_PLAYERS = 3;   // minimum total players
const TARGET_MAX_PLAYERS = 6;   // maximum total players
const BOT_JOIN_AT        = 25;  // second in registration phase to join
const MIN_BALLS_BEFORE_CLAIM = 22;  // bots wait — real players get first shot
const MAX_BALLS_BEFORE_CLAIM = 32;  // bots claim by this ball at latest

class BotManager {
  constructor(engine) {
    this.engine   = engine;
    this.bots     = [];      // [{ id, username, firstName }]
    this.botsThisRound = []; // bot userIds that joined this round
    this._loaded  = false;
    this._claimScheduled = false;
  }

  // ── Load bot accounts from DB once ───────────────────────
  async loadBots() {
    if (this._loaded) return;
    try {
      const [rows] = await db.query(
        'SELECT id, username, first_name FROM users WHERE is_bot=1 ORDER BY id'
      );
      this.bots = rows;
      this._loaded = true;
      console.log(`🤖 BotManager loaded ${this.bots.length} bots`);
    } catch(e) {
      console.error('BotManager loadBots error:', e.message);
    }
  }

  // ── Called each tick from GameEngine ─────────────────────
  async onTick(elapsed) {
    const engine = this.engine;

    // Join bots at BOT_JOIN_AT seconds into registration
    if (engine.state === 'REGISTRATION' && elapsed === BOT_JOIN_AT) {
      await this._joinBots();
    }

    // Schedule a random BINGO claim attempt during ACTIVE phase
    if (engine.state === 'ACTIVE' && !this._claimScheduled && this.botsThisRound.length > 0) {
      this._claimScheduled = true;
      this._scheduleBotClaimWithChance();
    }
  }

  // ── Reset each round ──────────────────────────────────────
  reset() {
    this.botsThisRound   = [];
    this._claimScheduled = false;
  }

  // ── Join bots to fill empty seats ────────────────────────
  async _joinBots() {
    await this.loadBots();
    if (!this.bots.length) return;

    // Check if bots are enabled in settings
    try {
      const [rows] = await db.query("SELECT value FROM settings WHERE key_name='bots_enabled'");
      if (rows.length > 0 && rows[0].value === '0') {
        console.log(`🤖 [${this.engine.roomId}] Bots disabled by admin`);
        return;
      }
    } catch { /* default to enabled */ }

    const engine       = this.engine;
    const realPlayers  = Object.keys(engine.tickets).length;
    // Random target between 3 and 6
    const target       = TARGET_MIN_PLAYERS + Math.floor(Math.random() * (TARGET_MAX_PLAYERS - TARGET_MIN_PLAYERS + 1));
    const botsNeeded   = Math.max(0, target - realPlayers);

    if (botsNeeded === 0) {
      console.log(`🤖 [${engine.roomId}] No bots needed (${realPlayers} real players)`);
      return;
    }

    // Shuffle bots and pick needed amount
    const shuffled = [...this.bots].sort(() => Math.random() - 0.5);
    const toJoin   = shuffled.slice(0, botsNeeded);

    for (const bot of toJoin) {
      // Pick a random free card
      const takenNums = new Set(Object.keys(engine.takenCards).map(Number));
      const freeCards = [];
      for (let i = 1; i <= 100; i++) if (!takenNums.has(i)) freeCards.push(i);
      if (!freeCards.length) break;

      const cardNumber = freeCards[Math.floor(Math.random() * freeCards.length)];
      const result     = await engine.selectCard(bot.id, cardNumber);

      if (result.ok) {
        this.botsThisRound.push(bot.id);
        console.log(`🤖 [${engine.roomId}] Bot ${bot.first_name} joined card #${cardNumber}`);
      } else {
        console.log(`🤖 [${engine.roomId}] Bot ${bot.first_name} failed: ${result.reason}`);
      }
    }
  }

  // ── Schedule a random BINGO claim attempt during ACTIVE phase
  async _scheduleBotClaimWithChance() {
    // Read bot win chance from settings (0-100, default 40)
    let chance = 40;
    try {
      const [rows] = await db.query("SELECT value FROM settings WHERE key_name='bot_win_chance'");
      if (rows.length) chance = Math.max(0, Math.min(100, parseInt(rows[0].value) || 40));
    } catch { /* use default */ }

    if (chance === 0) {
      console.log(`🤖 [${this.engine.roomId}] Bot win chance=0%, bots won't claim`);
      return;
    }

    // Map chance (0-100) to ball range:
    // 100% = claim at ball 10-15 (very early)
    // 50%  = claim at ball 20-28 (balanced)
    // 0%   = never claim
    const minBall = Math.round(10 + (100 - chance) * 0.25); // 10 at 100%, 35 at 0%
    const maxBall = Math.round(15 + (100 - chance) * 0.25); // 15 at 100%, 40 at 0%
    const targetBall = minBall + Math.floor(Math.random() * (maxBall - minBall + 1));

    console.log(`🤖 [${this.engine.roomId}] Bot win chance=${chance}%, will try at ball ${targetBall}`);
    this._scheduleBotClaim(targetBall);
  }
  _scheduleBotClaim(targetBall) {
    const engine    = this.engine;
    const checkFn  = () => {
      if (engine.roundFinished || engine.state !== 'ACTIVE') return;
      if (engine.balls.length < targetBall) {
        // Check again in 2 seconds
        setTimeout(checkFn, 2000);
        return;
      }
      this._attemptBotBingo();
    };
    setTimeout(checkFn, 2000);
  }

  // ── One random bot tries to claim BINGO ──────────────────
  async _attemptBotBingo() {
    const engine = this.engine;
    if (engine.roundFinished || engine.state !== 'ACTIVE') return;
    if (!this.botsThisRound.length) return;

    const shuffled = [...this.botsThisRound].sort(() => Math.random() - 0.5);
    const drawnSet = new Set(engine.balls);

    for (const botId of shuffled) {
      // Find all tickets for this bot (new key format: userId_cardNumber)
      const botTickets = Object.entries(engine.tickets)
        .filter(([key]) => key.startsWith(`${botId}_`))
        .map(([, t]) => t);

      for (const ticket of botTickets) {
        const { valid, pattern } = validateBingo(ticket.grid, drawnSet);
        if (valid) {
          console.log(`🤖 [${engine.roomId}] Bot ${botId} has valid BINGO (${pattern}) — claiming`);
          await engine.claimBingo(botId);
          return;
        }
      }
    }

    const nextTarget = engine.balls.length + 3 + Math.floor(Math.random() * 4);
    this._scheduleBotClaim(nextTarget);
  }

  // ── Auto-refill bot balances from house earnings ──────────
  static async refillBotBalances(houseEarnings) {
    // Always refill bots regardless of house earnings amount
    try {
      const [bots] = await db.query('SELECT id, balance FROM users WHERE is_bot=1 AND balance < 200');
      for (const bot of bots) {
        await db.query('UPDATE users SET balance=500 WHERE id=?', [bot.id]);
        console.log(`🤖 Bot ${bot.id} refilled to 500 ETB`);
      }
    } catch(e) {
      console.error('Bot refill error:', e.message);
    }
  }
}

module.exports = BotManager;
