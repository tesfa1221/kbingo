const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const db      = require('../db/connection');
const { validateTelegramInitData } = require('../utils/telegramAuth');

// ─── JWT middleware ───────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [payload.userId]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Admin guard ──────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ─── Local register ───────────────────────────────────────────────────────────
async function localRegister(req, res) {
  const username   = (req.body.username  || '').toString().trim();
  const password   = (req.body.password  || '').toString();
  const firstName  = (req.body.firstName || '').toString().trim();
  const lastName   = (req.body.lastName  || '').toString().trim();
  const phone      = (req.body.phone     || '').toString().trim();
  const refCode    = (req.body.referralCode || '').toString().trim().toUpperCase();

  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (username.length < 3 || username.length > 30) return res.status(400).json({ error: 'Username must be 3–30 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username: letters, numbers and _ only' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const [existing] = await db.query('SELECT id FROM users WHERE username=?', [username]);
  if (existing.length) return res.status(409).json({ error: 'Username already taken' });

  // Validate referral code
  let referredById = null;
  if (refCode) {
    const [refRows] = await db.query('SELECT id FROM users WHERE referral_code=?', [refCode]);
    if (refRows.length) referredById = refRows[0].id;
  }

  const hash    = await bcrypt.hash(password, 12);
  const myCode  = _generateReferralCode(username);

  const [result] = await db.query(
    `INSERT INTO users (username, first_name, last_name, phone, password_hash, balance, referral_code, referred_by)
     VALUES (?, ?, ?, ?, ?, 10.00, ?, ?)`,
    [username, firstName || username, lastName || null, phone || null, hash, myCode, referredById]
  );

  // Pay referral bonus to referrer (30 ETB) — only once
  if (referredById) {
    try {
      const [rRows] = await db.query('SELECT balance FROM users WHERE id=?', [referredById]);
      const rBal = parseFloat(rRows[0].balance);
      await db.query('UPDATE users SET balance=? WHERE id=?', [rBal + 30, referredById]);
      await db.query(
        `INSERT INTO transactions (user_id,type,amount,balance_before,balance_after,status,reference_id)
         VALUES (?,'REFUND',30,?,?,'COMPLETED','referral_bonus')`,
        [referredById, rBal, rBal + 30]
      );
      console.log(`🎁 Referral bonus: 30 ETB → user ${referredById}`);
    } catch (err) { console.error('Referral bonus error:', err.message); }
  }

  const [rows] = await db.query('SELECT * FROM users WHERE id=?', [result.insertId]);
  const user   = rows[0];
  const token  = _signToken(user);
  return res.status(201).json({ token, user: sanitizeUser(user) });
}

function _generateReferralCode(username) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = username.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  while (code.length < 3) code += 'X';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Local login ──────────────────────────────────────────────────────────────
async function localLogin(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
  if (!rows.length) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const user = rows[0];

  if (!user.password_hash) {
    return res.status(401).json({ error: 'This account uses Telegram login' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (user.is_banned) {
    const now = new Date();
    if (!user.ban_expires_at || new Date(user.ban_expires_at) > now) {
      return res.status(403).json({
        error: 'Account is banned',
        banExpiresAt: user.ban_expires_at,
      });
    }
    // Ban expired — lift it
    await db.query('UPDATE users SET is_banned=0, ban_expires_at=NULL WHERE id=?', [user.id]);
  }

  const token = _signToken(user);
  return res.json({ token, user: sanitizeUser(user) });
}

// ─── Telegram login ───────────────────────────────────────────────────────────
async function telegramLogin(req, res) {
  const { initData } = req.body;
  if (!initData) return res.status(400).json({ error: 'initData required' });

  const { valid, data } = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
  if (!valid) return res.status(401).json({ error: 'Invalid Telegram auth' });

  const tgUser = data.user;
  if (!tgUser) return res.status(400).json({ error: 'No user in initData' });

  await db.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, photo_url)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username=VALUES(username),
       first_name=VALUES(first_name),
       last_name=VALUES(last_name),
       photo_url=VALUES(photo_url)`,
    [tgUser.id, tgUser.username || null, tgUser.first_name || '', tgUser.last_name || null, tgUser.photo_url || null]
  );

  const [rows] = await db.query('SELECT * FROM users WHERE telegram_id = ?', [tgUser.id]);
  const user = rows[0];
  const token = _signToken(user);
  return res.json({ token, user: sanitizeUser(user) });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _signToken(user) {
  return jwt.sign(
    { userId: user.id, telegramId: user.telegram_id || null },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function sanitizeUser(u) {
  return {
    id:            u.id,
    telegramId:    u.telegram_id,
    username:      u.username,
    firstName:     u.first_name,
    lastName:      u.last_name,
    photoUrl:      u.photo_url,
    phone:         u.phone,
    balance:       u.balance,
    isAdmin:       !!u.is_admin,
    isBanned:      !!u.is_banned,
    banExpiresAt:  u.ban_expires_at,
    totalWins:     u.total_wins,
    totalWinnings: u.total_winnings,
    referralCode:  u.referral_code,
    referredBy:    u.referred_by,
  };
}

module.exports = { requireAuth, requireAdmin, localRegister, localLogin, telegramLogin, sanitizeUser };
