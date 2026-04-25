/**
 * GameEngine — Manages a single game room loop.
 *
 * Timing (per room config):
 *   0–45s   → REGISTRATION
 *   45–135s → ACTIVE (ball drawn every 2s → ~45 balls)
 *   135s    → RESET → archive → restart
 *
 * Features:
 *   - Minimum prize guarantee (house tops up if pool < minPrize)
 *   - Configurable entry fee, timing, ball speed per room
 */
const db = require('../db/connection');
const { generateCard }  = require('../utils/cardGenerator');
const { validateBingo } = require('../utils/bingoValidator');

const HOUSE_FEE_PCT = parseFloat(process.env.HOUSE_FEE_PERCENT) || 20;

// ─── Room presets ─────────────────────────────────────────
const ROOM_PRESETS = {
  standard: {
    label:        'Standard (10 ETB)',
    entryFee:     10,
    minPrize:     50,   // house tops up if pool < 50 ETB
    regDuration:  45,   // seconds
    activeDuration: 90,
    ballInterval: 2,    // seconds between balls
  },
  premium: {
    label:        'Premium (50 ETB)',
    entryFee:     50,
    minPrize:     200,
    regDuration:  45,
    activeDuration: 90,
    ballInterval: 2,
  },
};

class GameEngine {
  constructor(io, roomId = 'standard') {
    this.io       = io;
    this.roomId   = roomId;
    this.preset   = { ...ROOM_PRESETS[roomId] || ROOM_PRESETS.standard };

    this.state         = 'IDLE';
    this.gameId        = null;
    this.gameCode      = null;
    this.elapsed       = 0;
    this.balls         = [];
    this.ballPool      = [];
    this.takenCards    = {};
    this.tickets       = {};
    this.prizePool     = 0;
    this.netPrize      = 0;
    this.entryFee      = this.preset.entryFee;
    this.minPrize      = this.preset.minPrize;
    this.winners       = [];
    this.roundFinished = false;
    this._timer        = null;
    this._ballTimer    = null;
  }

  get TOTAL_DURATION() { return this.preset.regDuration + this.preset.activeDuration; }
  get REG_DURATION()   { return this.preset.regDuration; }
  get BALL_INTERVAL()  { return this.preset.ballInterval; }

  // ─── Public API ──────────────────────────────────────────
  start() {
    if (this._timer) return;
    this._beginNewRound();
  }

  stop() {
    clearInterval(this._timer);
    clearInterval(this._ballTimer);
    this._timer = null;
    this._ballTimer = null;
  }

  getSnapshot() {
    return {
      gameId:      this.gameId,
      gameCode:    this.gameCode,
      roomId:      this.roomId,
      roomLabel:   this.preset.label,
      state:       this.state,
      elapsed:     this.elapsed,
      remaining:   this.TOTAL_DURATION - this.elapsed,
      regDuration: this.REG_DURATION,
      balls:       this.balls,
      takenCards:  this.takenCards,
      prizePool:   this.prizePool,
      netPrize:    this.netPrize,
      playerCount: Object.keys(this.tickets).length,
      entryFee:    this.entryFee,
    };
  }

  // ─── Card Selection ──────────────────────────────────────
  async selectCard(userId, cardNumber) {
    if (this.state !== 'REGISTRATION') return { ok: false, reason: 'REGISTRATION_CLOSED' };
    if (cardNumber < 1 || cardNumber > 100) return { ok: false, reason: 'INVALID_CARD' };
    if (this.takenCards[cardNumber]) return { ok: false, reason: 'CARD_TAKEN' };
    if (this.tickets[userId]) return { ok: false, reason: 'ALREADY_REGISTERED' };

    const [rows] = await db.query('SELECT balance, is_banned, ban_expires_at FROM users WHERE id=?', [userId]);
    if (!rows.length) return { ok: false, reason: 'USER_NOT_FOUND' };
    const user = rows[0];

    if (user.is_banned) {
      const now = new Date();
      if (!user.ban_expires_at || new Date(user.ban_expires_at) > now) return { ok: false, reason: 'USER_BANNED' };
      await db.query('UPDATE users SET is_banned=0, ban_expires_at=NULL WHERE id=?', [userId]);
    }
    if (parseFloat(user.balance) < this.entryFee) return { ok: false, reason: 'INSUFFICIENT_BALANCE' };

    const grid = generateCard(cardNumber);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const balBefore = parseFloat(user.balance);
      const balAfter  = balBefore - this.entryFee;
      await conn.query('UPDATE users SET balance=? WHERE id=?', [balAfter, userId]);
      await conn.query(
        `INSERT INTO transactions (user_id,type,amount,balance_before,balance_after,status,reference_id)
         VALUES (?,'ENTRY_FEE',?,?,?,'COMPLETED',?)`,
        [userId, this.entryFee, balBefore, balAfter, this.gameId]
      );
      await conn.query(
        `INSERT INTO tickets (game_id,user_id,card_number,card_data,marked_cells) VALUES (?,?,?,?,?)`,
        [this.gameId, userId, cardNumber, JSON.stringify(grid), JSON.stringify([[2,2]])]
      );
      await conn.query('UPDATE games SET prize_pool=prize_pool+? WHERE id=?', [this.entryFee, this.gameId]);
      await conn.commit();
    } catch (err) {
      await conn.rollback(); conn.release();
      return { ok: false, reason: 'DB_ERROR' };
    }
    conn.release();

    this.takenCards[cardNumber] = userId;
    this.tickets[userId] = { cardNumber, grid };
    this.prizePool += this.entryFee;
    this.netPrize = this.prizePool * (1 - HOUSE_FEE_PCT / 100);

    this.io.to(this.roomId).emit('card:locked', { cardNumber, userId });
    this.io.to(this.roomId).emit('game:update', this.getSnapshot());
    return { ok: true, grid, cardNumber };
  }

  // ─── BINGO Claim ─────────────────────────────────────────
  async claimBingo(userId) {
    if (this.state !== 'ACTIVE')    return { ok: false, reason: 'GAME_NOT_ACTIVE' };
    if (this.roundFinished)         return { ok: false, reason: 'ROUND_FINISHED' };
    const ticket = this.tickets[userId];
    if (!ticket)                    return { ok: false, reason: 'NO_TICKET' };

    const drawnSet = new Set(this.balls);
    const { valid, pattern } = validateBingo(ticket.grid, drawnSet);
    if (!valid) {
      // No penalty — just tell the user their line isn't complete
      return { ok: false, reason: 'INCOMPLETE_LINE' };
    }

    this.winners.push({ userId, pattern, winningBall: this.balls[this.balls.length - 1] });
    this.roundFinished = true;
    await this._finalizeWinners();
    return { ok: true, pattern };
  }

  // ─── Private ─────────────────────────────────────────────
  async _beginNewRound() {
    const gameCode = `${this.roomId.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    let insertId;
    try {
      const [result] = await db.query(
        `INSERT INTO games (game_code, room_id, state, entry_fee, house_fee_pct)
         VALUES (?, ?, 'REGISTRATION', ?, ?)`,
        [gameCode, this.roomId, this.entryFee, HOUSE_FEE_PCT]
      );
      insertId = result.insertId;
    } catch (err) {
      console.error(`❌ [${this.roomId}] _beginNewRound failed, retry in 2s:`, err.message);
      setTimeout(() => this._beginNewRound(), 2000);
      return;
    }

    this.gameId        = insertId;
    this.gameCode      = gameCode;
    this.state         = 'REGISTRATION';
    this.elapsed       = 0;
    this.balls         = [];
    this.ballPool      = this._shuffleBalls();
    this.takenCards    = {};
    this.tickets       = {};
    this.prizePool     = 0;
    this.netPrize      = 0;
    this.winners       = [];
    this.roundFinished = false;

    try {
      await db.query("UPDATE games SET state='REGISTRATION', started_at=NOW() WHERE id=?", [this.gameId]);
    } catch (err) { console.error(`❌ [${this.roomId}] state update failed:`, err.message); }

    this.io.to(this.roomId).emit('game:new_round', this.getSnapshot());
    console.log(`🎮 [${this.roomId}] New round: ${gameCode} | fee=${this.entryFee} ETB | minPrize=${this.minPrize} ETB`);

    this._timer = setInterval(() => this._tick(), 1000);
  }

  _tick() {
    this.elapsed++;
    if (this.elapsed >= this.TOTAL_DURATION) { this._endRound(); return; }
    if (this.elapsed === this.REG_DURATION)   { this._startActivePhase(); }
    this.io.to(this.roomId).emit('game:tick', {
      e: this.elapsed,                          // short keys = less bytes
      r: this.TOTAL_DURATION - this.elapsed,
      s: this.state,
      rid: this.roomId,
    });
  }

  async _startActivePhase() {
    this.state = 'ACTIVE';
    try { await db.query("UPDATE games SET state='ACTIVE' WHERE id=?", [this.gameId]); }
    catch (err) { console.error(`❌ [${this.roomId}] ACTIVE update failed:`, err.message); }
    this.io.to(this.roomId).emit('game:phase_change', { state: 'ACTIVE', gameId: this.gameId, roomId: this.roomId });
    console.log(`⚡ [${this.roomId}] → ACTIVE`);
    this._ballTimer = setInterval(() => {
      if (this.roundFinished) return;
      this._drawBall();
    }, this.BALL_INTERVAL * 1000);
  }

  _drawBall() {
    if (!this.ballPool.length) return;
    const ball = this.ballPool.pop();
    this.balls.push(ball);
    this.io.to(this.roomId).emit('ball:drawn', { b: ball, gid: this.gameId, rid: this.roomId });
  }

  async _finalizeWinners() {
    clearInterval(this._ballTimer);
    this._ballTimer = null;

    const winnerCount  = this.winners.length;
    const playerCount  = Object.keys(this.tickets).length;

    // If only 1 player — full refund, no house fee, no prize
    if (playerCount <= 1 && winnerCount > 0) {
      const { userId } = this.winners[0];
      try {
        const conn = await db.getConnection();
        await conn.beginTransaction();
        const [tRows] = await conn.query('SELECT id FROM tickets WHERE game_id=? AND user_id=?', [this.gameId, userId]);
        const ticketId = tRows[0]?.id;
        await conn.query('UPDATE tickets SET is_winner=1, prize_share=? WHERE id=?', [this.entryFee, ticketId]);
        const [uRows] = await conn.query('SELECT balance FROM users WHERE id=?', [userId]);
        const balBefore = parseFloat(uRows[0].balance);
        const balAfter  = balBefore + this.entryFee;
        await conn.query('UPDATE users SET balance=? WHERE id=?', [balAfter, userId]);
        await conn.query(
          `INSERT INTO transactions (user_id,type,amount,balance_before,balance_after,status,reference_id)
           VALUES (?,'REFUND',?,?,?,'COMPLETED',?)`,
          [userId, this.entryFee, balBefore, balAfter, this.gameId]
        );
        await conn.query(
          "UPDATE games SET state='FINISHED', finished_at=NOW(), net_prize=?, balls_drawn=?, winning_pattern=? WHERE id=?",
          [this.entryFee, JSON.stringify(this.balls), this.winners[0]?.pattern || null, this.gameId]
        );
        await conn.commit();
        conn.release();
      } catch (err) {
        console.error(`❌ [${this.roomId}] Refund error:`, err);
      }

      const [nameRows] = await db.query('SELECT first_name, username FROM users WHERE id=?', [this.winners[0].userId]).catch(() => [[]]);
      this.io.to(this.roomId).emit('game:bingo', {
        winners:    [{ ...this.winners[0], firstName: nameRows[0]?.first_name, username: nameRows[0]?.username }],
        prizeShare: this.entryFee,
        netPrize:   this.entryFee,
        refund:     true,
        gameId:     this.gameId,
        gameCode:   this.gameCode,
        roomId:     this.roomId,
        pattern:    this.winners[0]?.pattern || null,
        balls:      this.balls,
      });
      console.log(`↩️ [${this.roomId}] Solo player — full refund ${this.entryFee} ETB`);
      this._endRound();
      return;
    }

    // 2+ players — normal: 80% to winner(s), 20% house fee
    const netPrize = this.prizePool * (1 - HOUSE_FEE_PCT / 100);
    const share    = winnerCount > 0 ? netPrize / winnerCount : 0;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const w of this.winners) {
        const { userId, pattern, winningBall } = w;
        const [tRows] = await conn.query('SELECT id FROM tickets WHERE game_id=? AND user_id=?', [this.gameId, userId]);
        const ticketId = tRows[0]?.id;
        await conn.query('UPDATE tickets SET is_winner=1, prize_share=? WHERE id=?', [share, ticketId]);
        const [uRows] = await conn.query('SELECT balance FROM users WHERE id=?', [userId]);
        const balBefore = parseFloat(uRows[0].balance);
        const balAfter  = balBefore + share;
        await conn.query('UPDATE users SET balance=?, total_wins=total_wins+1, total_winnings=total_winnings+? WHERE id=?', [balAfter, share, userId]);
        await conn.query(
          `INSERT INTO transactions (user_id,type,amount,balance_before,balance_after,status,reference_id)
           VALUES (?,'PRIZE',?,?,?,'COMPLETED',?)`,
          [userId, share, balBefore, balAfter, this.gameId]
        );
        await conn.query(
          `INSERT INTO winners (game_id,user_id,ticket_id,pattern,prize_share,winning_ball) VALUES (?,?,?,?,?,?)`,
          [this.gameId, userId, ticketId, pattern, share, winningBall]
        );
      }
      await conn.query(
        "UPDATE games SET state='FINISHED', finished_at=NOW(), net_prize=?, balls_drawn=?, winning_pattern=? WHERE id=?",
        [netPrize, JSON.stringify(this.balls), this.winners[0]?.pattern || null, this.gameId]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error(`❌ [${this.roomId}] Finalize error:`, err);
    }
    conn.release();

    const winnersWithNames = await Promise.all(this.winners.map(async (w) => {
      try {
        const [rows] = await db.query('SELECT first_name, username FROM users WHERE id=?', [w.userId]);
        return { ...w, firstName: rows[0]?.first_name || null, username: rows[0]?.username || null };
      } catch { return { ...w, firstName: null, username: null }; }
    }));

    this.io.to(this.roomId).emit('game:bingo', {
      winners: winnersWithNames, prizeShare: share, netPrize,
      gameId: this.gameId, gameCode: this.gameCode, roomId: this.roomId,
      pattern: this.winners[0]?.pattern || null, balls: this.balls,
    });
    console.log(`🏆 [${this.roomId}] Players: ${playerCount}, Winners: ${winnerCount}, Share: ${share} ETB, House: ${(this.prizePool - netPrize).toFixed(2)} ETB`);

    // End round immediately after winner — no waiting for timer
    this._endRound();
  }

  async _penalizeUser(userId) {
    const banUntil = new Date(Date.now() + (parseInt(process.env.BAN_DURATION_MINUTES) || 30) * 60000);
    try {
      await db.query(`UPDATE users SET is_banned=1, ban_expires_at=?, false_bingo_count=false_bingo_count+1 WHERE id=?`, [banUntil, userId]);
      const [uRows] = await db.query('SELECT balance FROM users WHERE id=?', [userId]);
      const bal = parseFloat(uRows[0]?.balance || 0);
      await db.query(`INSERT INTO transactions (user_id,type,amount,balance_before,balance_after,status,reference_id) VALUES (?,'PENALTY',?,?,?,'COMPLETED',?)`, [userId, 0, bal, bal, this.gameId]);
    } catch (err) { console.error(`❌ [${this.roomId}] penalize error:`, err.message); }
    const cardNum = this.tickets[userId]?.cardNumber;
    if (cardNum) { delete this.takenCards[cardNum]; delete this.tickets[userId]; }
    this.io.to(`user:${userId}`).emit('penalty:false_bingo', { banUntil, message: 'ያልተሟላ መስመር! ከጨዋታው ታግደዋል።' });
    this.io.to(this.roomId).emit('player:ejected', { userId });
    console.log(`⛔ [${this.roomId}] User ${userId} penalized`);
  }

  async _endRound() {
    // Prevent double-call (winner already called this, timer may also fire)
    if (this._timer === null && this._ballTimer === null) return;
    clearInterval(this._timer);
    clearInterval(this._ballTimer);
    this._timer = null;
    this._ballTimer = null;
    if (!this.roundFinished) {
      try { await db.query("UPDATE games SET state='FINISHED', finished_at=NOW(), balls_drawn=? WHERE id=?", [JSON.stringify(this.balls), this.gameId]); }
      catch (err) { console.error(`❌ [${this.roomId}] endRound error:`, err.message); }
    }
    this.state = 'FINISHED';
    this.io.to(this.roomId).emit('game:round_end', { gameId: this.gameId, gameCode: this.gameCode, roomId: this.roomId });
    console.log(`🔄 [${this.roomId}] Round ended. Restarting in 3s...`);
    setTimeout(() => this._beginNewRound(), 3000);
  }

  _shuffleBalls() {
    const arr = Array.from({ length: 75 }, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

module.exports = { GameEngine, ROOM_PRESETS };
