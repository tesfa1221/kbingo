const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../db/connection');

// ─── Multer setup: local disk or Cloudinary ───────────────
let upload;

const hasCloudinary = (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'YOUR_CLOUD_NAME' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== 'YOUR_API_KEY' &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_API_SECRET !== 'YOUR_API_SECRET'
);

if (hasCloudinary) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  const multer = require('multer');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'bingo_deposits',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, crop: 'limit' }],
    },
  });

  upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
  console.log('📸 Using Cloudinary for screenshot storage');
} else {
  const multer = require('multer');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `deposit_${req.user?.id || 'unknown'}_${Date.now()}${ext}`);
    },
  });

  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    },
  });
  console.log('📸 Using local disk storage for screenshots');
}

// ─── Helper: get screenshot URL ──────────────────────────
function getScreenshotUrl(req) {
  if (!req.file) return null;
  if (hasCloudinary) return req.file.path;
  // Local: build a URL path
  return `/uploads/${req.file.filename}`;
}

// GET /api/wallet/balance
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT balance FROM users WHERE id=?', [req.user.id]);
    res.json({ balance: rows[0]?.balance || 0 });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/deposit-sms — Deposit via pasted SMS text (no screenshot needed)
router.post('/deposit-sms', requireAuth, async (req, res) => {
  const amount  = parseFloat(req.body.amount);
  const smsText = (req.body.smsText || '').toString().trim();

  if (!smsText) return res.status(400).json({ error: 'SMS text is required' });
  if (!amount || isNaN(amount) || amount < 10 || amount > 100000) {
    return res.status(400).json({ error: 'Amount must be between 10 and 100,000 ETB' });
  }

  try {
    const [uRows] = await db.query('SELECT balance FROM users WHERE id=?', [req.user.id]);
    const balBefore = parseFloat(uRows[0].balance);

    await db.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, admin_note)
       VALUES (?, 'DEPOSIT', ?, ?, ?, 'PENDING', ?)`,
      [req.user.id, amount, balBefore, balBefore, `SMS: ${smsText.substring(0, 500)}`]
    );

    res.json({ message: 'Deposit request submitted. Awaiting admin approval.' });
  } catch (err) {
    console.error('deposit-sms error:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/deposit — Upload Telebirr screenshot (kept for backward compat)
router.post('/deposit', requireAuth, upload.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Screenshot required' });

  const amount = parseFloat(req.body.amount);
  if (!amount || isNaN(amount) || amount < 10 || amount > 100000) {
    return res.status(400).json({ error: 'Amount must be between 10 and 100,000 ETB' });
  }

  const screenshotUrl = getScreenshotUrl(req);

  try {
    const [uRows] = await db.query('SELECT balance FROM users WHERE id=?', [req.user.id]);
    const balBefore = parseFloat(uRows[0].balance);

    await db.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, screenshot_url)
       VALUES (?, 'DEPOSIT', ?, ?, ?, 'PENDING', ?)`,
      [req.user.id, amount, balBefore, balBefore, screenshotUrl]
    );

    res.json({ message: 'Deposit request submitted. Awaiting admin approval.', screenshotUrl });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/withdraw
router.post('/withdraw', requireAuth, async (req, res) => {
  const amount = parseFloat(req.body.amount);
  const phone  = (req.body.phone  || '').toString().trim();
  const method = (req.body.method || '').toString().trim().toLowerCase();

  if (!amount || isNaN(amount) || amount < 10 || amount > 100000) {
    return res.status(400).json({ error: 'Amount must be between 10 and 100,000 ETB' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  if (!['telebirr', 'cbe'].includes(method)) {
    return res.status(400).json({ error: 'Method must be telebirr or cbe' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [uRows] = await conn.query('SELECT balance FROM users WHERE id=?', [req.user.id]);
    if (!uRows.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const balBefore = parseFloat(uRows[0].balance);
    if (amount > balBefore) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    // Minimum balance rule: must keep at least 100 ETB after withdrawal
    if (balBefore - amount < 100) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'ከወጪ በኋላ ቢያንስ 100 ETB ሂሳብ ውስጥ መቆየት አለበት' });
    }
    const balAfter = balBefore - amount;

    // Deduct balance immediately (hold it)
    await conn.query('UPDATE users SET balance=? WHERE id=?', [balAfter, req.user.id]);

    // Create WITHDRAWAL transaction with PENDING status
    const [result] = await conn.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reference_id)
       VALUES (?, 'WITHDRAWAL', ?, ?, ?, 'PENDING', ?)`,
      [req.user.id, amount, balBefore, balAfter, `${method}:${phone}`]
    );

    await conn.commit();
    res.json({
      message: 'Withdrawal request submitted. Awaiting admin approval.',
      transactionId: result.insertId,
      newBalance: balAfter,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'DB error' });
  }
  conn.release();
});

// GET /api/wallet/transactions — User transaction history
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, type, amount, balance_before, balance_after, status, reference_id, created_at
       FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ transactions: rows });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// ─── Admin Routes ─────────────────────────────────────────

// GET /api/wallet/admin/pending — Pending deposits
router.get('/admin/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, u.first_name, u.username, u.telegram_id
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.type='DEPOSIT' AND t.status='PENDING'
       ORDER BY t.created_at ASC`
    );
    res.json({ pending: rows });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/admin/approve/:id
router.post('/admin/approve/:id', requireAuth, requireAdmin, async (req, res) => {
  const txId = parseInt(req.params.id);
  const { note } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [txRows] = await conn.query(
      'SELECT * FROM transactions WHERE id=? AND type="DEPOSIT" AND status="PENDING"',
      [txId]
    );
    if (!txRows.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const tx = txRows[0];

    const [uRows] = await conn.query('SELECT balance FROM users WHERE id=?', [tx.user_id]);
    const balBefore = parseFloat(uRows[0].balance);
    const balAfter  = balBefore + parseFloat(tx.amount);

    await conn.query('UPDATE users SET balance=? WHERE id=?', [balAfter, tx.user_id]);
    await conn.query(
      `UPDATE transactions SET status='APPROVED', balance_after=?, admin_note=?, reviewed_by=?, reviewed_at=NOW()
       WHERE id=?`,
      [balAfter, note || null, req.user.id, txId]
    );

    await conn.commit();
    res.json({ message: 'Deposit approved', newBalance: balAfter });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'DB error' });
  }
  conn.release();
});

// POST /api/wallet/admin/reject/:id
router.post('/admin/reject/:id', requireAuth, requireAdmin, async (req, res) => {
  const txId = parseInt(req.params.id);
  const { note } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE transactions SET status='REJECTED', admin_note=?, reviewed_by=?, reviewed_at=NOW()
       WHERE id=? AND type='DEPOSIT' AND status='PENDING'`,
      [note || null, req.user.id, txId]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deposit rejected' });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /api/wallet/admin/withdrawals — List pending withdrawals
router.get('/admin/withdrawals', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, u.first_name, u.username, u.telegram_id
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.type='WITHDRAWAL' AND t.status='PENDING'
       ORDER BY t.created_at ASC`
    );
    res.json({ withdrawals: rows });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/admin/approve-withdrawal/:id
router.post('/admin/approve-withdrawal/:id', requireAuth, requireAdmin, async (req, res) => {
  const txId = parseInt(req.params.id);
  const { note } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE transactions SET status='APPROVED', admin_note=?, reviewed_by=?, reviewed_at=NOW()
       WHERE id=? AND type='WITHDRAWAL' AND status='PENDING'`,
      [note || null, req.user.id, txId]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Withdrawal not found or already processed' });
    res.json({ message: 'Withdrawal approved' });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/admin/reject-withdrawal/:id — Refunds balance
router.post('/admin/reject-withdrawal/:id', requireAuth, requireAdmin, async (req, res) => {
  const txId = parseInt(req.params.id);
  const { note } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [txRows] = await conn.query(
      'SELECT * FROM transactions WHERE id=? AND type="WITHDRAWAL" AND status="PENDING"',
      [txId]
    );
    if (!txRows.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Withdrawal not found or already processed' });
    }
    const tx = txRows[0];

    // Refund the balance
    const [uRows] = await conn.query('SELECT balance FROM users WHERE id=?', [tx.user_id]);
    const balBefore = parseFloat(uRows[0].balance);
    const balAfter  = balBefore + parseFloat(tx.amount);

    await conn.query('UPDATE users SET balance=? WHERE id=?', [balAfter, tx.user_id]);
    await conn.query(
      `UPDATE transactions SET status='REJECTED', balance_after=?, admin_note=?, reviewed_by=?, reviewed_at=NOW()
       WHERE id=?`,
      [balAfter, note || null, req.user.id, txId]
    );

    // Log a refund transaction
    await conn.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reference_id)
       VALUES (?, 'REFUND', ?, ?, ?, 'COMPLETED', ?)`,
      [tx.user_id, parseFloat(tx.amount), balBefore, balAfter, `withdrawal_refund:${txId}`]
    );

    await conn.commit();
    res.json({ message: 'Withdrawal rejected and balance refunded', newBalance: balAfter });
  } catch (err) {
    await conn.rollback();
    console.error('Reject withdrawal error:', err);
    res.status(500).json({ error: 'DB error' });
  }
  conn.release();
});

// GET /api/wallet/admin/all-transactions — All transactions for admin view
router.get('/admin/all-transactions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.user_id, t.type, t.amount, t.status, t.reference_id, t.created_at,
              u.username, u.first_name
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC
       LIMIT 200`
    );
    res.json({ transactions: rows });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /api/wallet/admin/users — All users with balances
router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, telegram_id, username, first_name, balance, is_admin, is_banned, ban_expires_at,
              false_bingo_count, total_wins, total_winnings, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/admin/ban/:id — Ban a user
router.post('/admin/ban/:id', requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const banUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  try {
    await db.query('UPDATE users SET is_banned=1, ban_expires_at=? WHERE id=?', [banUntil, userId]);
    res.json({ message: 'User banned' });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/admin/unban/:id — Unban a user
router.post('/admin/unban/:id', requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  try {
    await db.query('UPDATE users SET is_banned=0, ban_expires_at=NULL WHERE id=?', [userId]);
    res.json({ message: 'User unbanned' });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/wallet/admin/topup/:id — Add balance to a user
router.post('/admin/topup/:id', requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [uRows] = await conn.query('SELECT balance FROM users WHERE id=?', [userId]);
    if (!uRows.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'User not found' });
    }
    const balBefore = parseFloat(uRows[0].balance);
    const balAfter  = balBefore + amount;
    await conn.query('UPDATE users SET balance=? WHERE id=?', [balAfter, userId]);
    await conn.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reference_id)
       VALUES (?, 'DEPOSIT', ?, ?, ?, 'APPROVED', 'admin_topup')`,
      [userId, amount, balBefore, balAfter]
    );
    await conn.commit();
    res.json({ message: 'Balance updated', newBalance: balAfter });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'DB error' });
  }
  conn.release();
});

module.exports = router;
