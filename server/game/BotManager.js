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

const TARGET_PLAYERS = 4;   // fill up to this many total players
const BOT_JOIN_AT    = 25;  // second in registration phase to join
const MIN_BALLS_BEFORE_CLAIM = 15;  // bots wait at least this many balls
const MAX_BALLS_BEFORE_CLAIM = 30;  // bots claim by this ball at latest

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
      const targetBall = MIN_BALLS_BEFORE_CLAIM + Math.floor(Math.random() * (MAX_BALLS_BEFORE_CLAIM - MIN_BALLS_BEFORE_CLAIM));
      this._scheduleBotClaim(targetBall);
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

    const engine       = this.engine;
    const realPlayers  = Object.keys(engine.tickets).length;
    const botsNeeded   = Math.max(0, TARGET_PLAYERS - realPlayers);

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
        console.log(`🤖 [${engine.roomId}] Bot ${bot.first_name} failed to join: ${result.reason}`);
      }
    }
  }

  // ── Schedule a bot BINGO claim at a specific ball count ──
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

    // Shuffle bots and try each until one has a valid line
    const shuffled = [...this.botsThisRound].sort(() => Math.random() - 0.5);
    const drawnSet = new Set(engine.balls);

    for (const botId of shuffled) {
      const ticket = engine.tickets[botId];
      if (!ticket) continue;

      const { valid, pattern } = validateBingo(ticket.grid, drawnSet);
      if (valid) {
        console.log(`🤖 [${engine.roomId}] Bot ${botId} has valid BINGO (${pattern}) — claiming`);
        await engine.claimBingo(botId);
        return;
      }
    }

    // No bot has a valid line yet — try again after 3 more balls
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
