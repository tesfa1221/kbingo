/**
 * Telegram Bot Handler for K Bingo
 * Handles: /start, /play, /balance, /help
 * Sends: round notifications, win alerts, deposit confirmations
 */
const axios  = require('axios');
const db     = require('../db/connection');

const TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://negattech.com/kbingo';
const BASE_URL    = `https://api.telegram.org/bot${TOKEN}`;

// ─── Send a message ───────────────────────────────────────
async function sendMessage(chatId, text, extra = {}) {
  if (!TOKEN) return;
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id:    chatId,
      text,
      parse_mode: 'Markdown',
      ...extra,
    });
  } catch (e) {
    console.error('Telegram sendMessage error:', e.response?.data?.description || e.message);
  }
}

// ─── Send Mini App button ─────────────────────────────────
function miniAppButton(text) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text, web_app: { url: MINI_APP_URL } }
      ]]
    }
  };
}

// ─── Handle incoming updates ──────────────────────────────
async function handleUpdate(update) {
  const msg = update.message || update.callback_query?.message;
  if (!msg) return;

  const chatId   = msg.chat.id;
  const userId   = msg.from?.id;
  const text     = msg.text || '';
  const contact  = msg.contact;

  // ── /start ──────────────────────────────────────────────
  if (text.startsWith('/start') || text.startsWith('/play')) {
    // Check if user exists in DB
    const [rows] = await db.query('SELECT id, first_name, balance FROM users WHERE telegram_id=?', [userId]).catch(() => [[]]);
    const user = rows[0];

    if (user) {
      // Returning user — send play button
      await sendMessage(chatId,
        `እንኳን ደህና መጡ ወደ K Bingo, *${user.first_name}*! 🎮\n\n` +
        `💰 ቀሪ ሂሳብ: *${parseFloat(user.balance).toFixed(2)} ETB*\n\n` +
        `ለመጫወት ከዚህ ይጫኑ 👇`,
        miniAppButton('🎮 K Bingo ጫወት')
      );
    } else {
      // New user — ask for phone number
      await sendMessage(chatId,
        `*K Bingo* へ እንኳን ደህና መጡ! 🎉\n\n` +
        `ለመጀመር ስልክ ቁጥርዎን ያጋሩ 👇`,
        {
          reply_markup: {
            keyboard: [[
              { text: '📱 ስልክ ቁጥር አጋራ', request_contact: true }
            ]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        }
      );
    }
    return;
  }

  // ── Contact shared ───────────────────────────────────────
  if (contact && contact.user_id === userId) {
    const phone     = contact.phone_number?.replace(/\D/g, '');
    const firstName = msg.from?.first_name || contact.first_name || 'ተጠቃሚ';
    const lastName  = msg.from?.last_name  || contact.last_name  || null;
    const username  = msg.from?.username   || null;

    // Upsert user in DB
    try {
      await db.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, phone, balance)
         VALUES (?, ?, ?, ?, ?, 10.00)
         ON DUPLICATE KEY UPDATE
           username=VALUES(username),
           first_name=VALUES(first_name),
           last_name=VALUES(last_name),
           phone=IF(phone IS NULL OR phone='', VALUES(phone), phone)`,
        [userId, username, firstName, lastName, phone]
      );
      console.log(`📱 New Telegram user: ${firstName} (${phone})`);
    } catch (e) {
      console.error('User upsert error:', e.message);
    }

    // Send welcome + play button
    await sendMessage(chatId,
      `✅ ተመዝግበዋል! እንኳን ደህና መጡ, *${firstName}*!\n\n` +
      `🎁 10 ETB ጀምሪያ ሂሳብ ተሰጥቷል!\n\n` +
      `ለመጫወት ከዚህ ይጫኑ 👇`,
      {
        ...miniAppButton('🎮 K Bingo ጫወት'),
        reply_markup: {
          ...miniAppButton('🎮 K Bingo ጫወት').reply_markup,
          remove_keyboard: true,
        }
      }
    );
    return;
  }

  // ── /balance ─────────────────────────────────────────────
  if (text.startsWith('/balance')) {
    const [rows] = await db.query('SELECT first_name, balance FROM users WHERE telegram_id=?', [userId]).catch(() => [[]]);
    if (rows[0]) {
      await sendMessage(chatId,
        `💰 *${rows[0].first_name}* ቀሪ ሂሳብ:\n\n*${parseFloat(rows[0].balance).toFixed(2)} ETB*`,
        miniAppButton('💳 ሂሳብ ጨምር')
      );
    } else {
      await sendMessage(chatId, 'ለመጀመር /start ይጫኑ');
    }
    return;
  }

  // ── /help ────────────────────────────────────────────────
  if (text.startsWith('/help')) {
    await sendMessage(chatId,
      `*K Bingo እርዳታ* 🎮\n\n` +
      `🃏 ካርድ ምረጥ (1-100)\n` +
      `🔢 ቁጥሮቹ ሲጠሩ ምልክት አድርግ\n` +
      `🏆 መስመር ሲሞላ BINGO ጩህ!\n\n` +
      `💰 ለማስቀመጥ: Telebirr *0946336242*\n` +
      `📱 ወይም CBE *1000296475387*\n\n` +
      `ለጨዋታ 👇`,
      miniAppButton('🎮 ጫወት')
    );
    return;
  }

  // ── Default ──────────────────────────────────────────────
  await sendMessage(chatId,
    'ለጨዋታ ከዚህ ይጫኑ 👇',
    miniAppButton('🎮 K Bingo ጫወት')
  );
}

// ─── Notification helpers ─────────────────────────────────

// Notify all active users when a new round starts
async function notifyNewRound(roomId, entryFee, prizePool) {
  if (!TOKEN) return;
  try {
    // Get users who played in last 24h and have telegram_id
    const [users] = await db.query(
      `SELECT DISTINCT u.telegram_id, u.first_name
       FROM users u
       JOIN tickets t ON t.user_id = u.id
       JOIN games g ON g.id = t.game_id
       WHERE u.telegram_id IS NOT NULL
         AND u.is_bot = 0
         AND g.finished_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       LIMIT 50`
    );

    const text =
      `🎮 *K Bingo — ዙር ጀምሯል!*\n\n` +
      `💰 ክፍያ: *${entryFee} ETB*\n` +
      `🏆 ደራሽ: *${(prizePool * 0.8).toFixed(0)} ETB+*\n\n` +
      `ለመቀላቀል ይጫኑ 👇`;

    for (const user of users) {
      await sendMessage(user.telegram_id, text, miniAppButton('🎮 ጫወት'));
      await new Promise(r => setTimeout(r, 50)); // rate limit
    }
  } catch (e) {
    console.error('notifyNewRound error:', e.message);
  }
}

// Notify winner
async function notifyWinner(telegramId, firstName, prizeShare, pattern) {
  if (!TOKEN || !telegramId) return;
  const patternLabels = {
    HORIZONTAL: 'አግድም መስመር', VERTICAL: 'ቀጥ ያለ መስመር',
    DIAGONAL: 'ሰያፍ መስመር', FOUR_CORNERS: 'አራት ማዕዘን',
  };
  await sendMessage(telegramId,
    `🏆 *እንኳን ደስ አለህ, ${firstName}!*\n\n` +
    `✅ ${patternLabels[pattern] || pattern}\n` +
    `💰 ደራሽ: *${parseFloat(prizeShare).toFixed(2)} ETB*\n\n` +
    `ሂሳብህ ተጨምሯል!`,
    miniAppButton('🎮 ቀጣይ ዙር')
  );
}

// Notify deposit approved
async function notifyDepositApproved(telegramId, firstName, amount) {
  if (!TOKEN || !telegramId) return;
  await sendMessage(telegramId,
    `✅ *ሂሳብ ተጨምሯል!*\n\n` +
    `${firstName}, *${parseFloat(amount).toFixed(2)} ETB* ወደ ሂሳብህ ገብቷል!\n\n` +
    `ለመጫወት ይጫኑ 👇`,
    miniAppButton('🎮 ጫወት')
  );
}

// Notify deposit rejected
async function notifyDepositRejected(telegramId, firstName, amount) {
  if (!TOKEN || !telegramId) return;
  await sendMessage(telegramId,
    `❌ *ጥያቄ ተቀባይነት አልተሰጠም*\n\n` +
    `${firstName}, ${parseFloat(amount).toFixed(2)} ETB ጥያቄ ተሰርዟል.\n` +
    `ለጥያቄ አስተዳዳሪን ያናግሩ.`
  );
}

module.exports = {
  handleUpdate,
  notifyNewRound,
  notifyWinner,
  notifyDepositApproved,
  notifyDepositRejected,
  sendMessage,
};
