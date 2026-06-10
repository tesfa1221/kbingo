/**
 * Telegram Bot Handler for K Bingo
 * Professional menu with inline keyboard buttons
 */
const axios  = require('axios');
const db     = require('../db/connection');

const TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://negattech.com/kbingo';
const BASE_URL     = `https://api.telegram.org/bot${TOKEN}`;
const SUPPORT_USER = '@Tesfa3362';

// ─── Core send functions ──────────────────────────────────
async function sendMessage(chatId, text, extra = {}) {
  if (!TOKEN) return;
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId, text, parse_mode: 'Markdown', ...extra,
    });
  } catch (e) {
    console.error('TG sendMessage:', e.response?.data?.description || e.message);
  }
}

async function sendPhoto(chatId, photoUrl, caption, extra = {}) {
  if (!TOKEN) return;
  try {
    await axios.post(`${BASE_URL}/sendPhoto`, {
      chat_id: chatId, photo: photoUrl, caption, parse_mode: 'Markdown', ...extra,
    });
  } catch {
    // fallback to text if photo fails
    await sendMessage(chatId, caption, extra);
  }
}

// ─── Main menu keyboard ───────────────────────────────────
function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎮 ጫወት',            web_app: { url: MINI_APP_URL } },
          { text: '📝 ምዝገባ',           callback_data: 'register' },
        ],
        [
          { text: '💰 ሂሳብ ተመልከት',     callback_data: 'balance' },
          { text: '💳 ጨምር (Deposit)',   callback_data: 'deposit' },
        ],
        [
          { text: '⬇️ አውጣ (Withdraw)', callback_data: 'withdraw' },
          { text: '📖 መመሪያ',           callback_data: 'instruction' },
        ],
        [
          { text: '🔗 ጓደኛ ጋብዝ',        callback_data: 'invite' },
          { text: '📞 ድጋፍ',            callback_data: 'support' },
        ],
      ]
    }
  };
}

// ─── Welcome message with logo ────────────────────────────
async function sendWelcome(chatId, firstName, balance = null) {
  const LOGO_URL = process.env.BOT_LOGO_URL || null;

  const caption =
    `👋 *K Bingo* へ እንኳን ደህና መጡ${firstName ? `, *${firstName}*` : ''}!\n\n` +
    (balance !== null
      ? `💰 ቀሪ ሂሳብ: *${parseFloat(balance).toFixed(2)} ETB*\n\n`
      : `🎁 ሲመዘገቡ *10 ETB* ጀምሪያ ሂሳብ ያገኛሉ!\n\n`) +
    `ከዚህ በታች ያለውን ምርጫ ይጫኑ 👇`;

  if (LOGO_URL) {
    await sendPhoto(chatId, LOGO_URL, caption, mainMenu());
  } else {
    await sendMessage(chatId, caption, mainMenu());
  }
}

// ─── Handle incoming updates ──────────────────────────────
async function handleUpdate(update) {
  // Handle callback queries (button taps)
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg) return;

  const chatId  = msg.chat.id;
  const userId  = msg.from?.id;
  const text    = msg.text || '';
  const contact = msg.contact;

  // ── Phone number shared ──────────────────────────────────
  if (contact && contact.user_id === userId) {
    const phone     = contact.phone_number?.replace(/\D/g, '');
    const firstName = msg.from?.first_name || contact.first_name || 'ተጠቃሚ';
    const lastName  = msg.from?.last_name  || contact.last_name  || null;
    const username  = msg.from?.username   || null;

    try {
      await db.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, phone, balance)
         VALUES (?, ?, ?, ?, ?, 10.00)
         ON DUPLICATE KEY UPDATE
           username=VALUES(username), first_name=VALUES(first_name),
           last_name=VALUES(last_name),
           phone=IF(phone IS NULL OR phone='', VALUES(phone), phone)`,
        [userId, username, firstName, lastName, phone]
      );
      console.log(`📱 Registered: ${firstName} (${phone})`);
    } catch (e) { console.error('Upsert error:', e.message); }

    // Remove keyboard and show main menu
    await sendMessage(chatId,
      `✅ *ተመዝግበዋል, ${firstName}!*\n\n🎁 10 ETB ጀምሪያ ሂሳብ ተሰጥቷል!`,
      { reply_markup: { remove_keyboard: true } }
    );
    await sendWelcome(chatId, firstName, 10);
    return;
  }

  // ── Commands & text ──────────────────────────────────────
  const [rows] = await db.query(
    'SELECT id, first_name, balance FROM users WHERE telegram_id=?', [userId]
  ).catch(() => [[]]);
  const user = rows[0];

  if (text.startsWith('/start') || text === '📋 Menu' || text === 'Menu') {
    if (user) {
      await sendWelcome(chatId, user.first_name, user.balance);
    } else {
      await sendMessage(chatId,
        `*K Bingo* へ እንኳን ደህና መጡ! 🎉\n\n` +
        `ለመጀመር ስልክ ቁጥርዎን ያጋሩ 👇`,
        {
          reply_markup: {
            keyboard: [[{ text: '📱 ስልክ ቁጥር አጋራ', request_contact: true }]],
            resize_keyboard: true, one_time_keyboard: true,
          }
        }
      );
    }
    return;
  }

  if (text.startsWith('/play')) {
    await sendMessage(chatId, '🎮 ጨዋታ ለመጀመር 👇', {
      reply_markup: { inline_keyboard: [[{ text: '🎮 K Bingo ጫወት', web_app: { url: MINI_APP_URL } }]] }
    });
    return;
  }

  if (text.startsWith('/register'))  { await handleCallback({ message: msg, from: msg.from, id: '', data: 'register' }); return; }
  if (text.startsWith('/balance'))   { await handleCallback({ message: msg, from: msg.from, id: '', data: 'balance' }); return; }
  if (text.startsWith('/deposit'))   { await handleCallback({ message: msg, from: msg.from, id: '', data: 'deposit' }); return; }
  if (text.startsWith('/withdraw'))  { await handleCallback({ message: msg, from: msg.from, id: '', data: 'withdraw' }); return; }
  if (text.startsWith('/invite'))    { await handleCallback({ message: msg, from: msg.from, id: '', data: 'invite' }); return; }
  if (text.startsWith('/support'))   { await handleCallback({ message: msg, from: msg.from, id: '', data: 'support' }); return; }
  if (text.startsWith('/help') || text.startsWith('/instruction')) {
    await handleCallback({ message: msg, from: msg.from, id: '', data: 'instruction' });
    return;
  }

  // Default — show main menu
  if (user) {
    await sendWelcome(chatId, user.first_name, user.balance);
  } else {
    await sendMessage(chatId, 'ለመጀመር /start ይጫኑ');
  }
}

// ─── Handle button callbacks ──────────────────────────────
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const userId = cb.from?.id;
  const data   = cb.data;

  // Answer callback to remove loading spinner
  try {
    await axios.post(`${BASE_URL}/answerCallbackQuery`, { callback_query_id: cb.id });
  } catch {}

  const [rows] = await db.query(
    'SELECT id, first_name, balance, referral_code FROM users WHERE telegram_id=?', [userId]
  ).catch(() => [[]]);
  const user = rows[0];

  if (!user && data !== 'register') {
    await sendMessage(chatId, 'ለመጀመር /start ይጫኑ');
    return;
  }

  switch (data) {

    case 'register':
      if (user) {
        await sendMessage(chatId,
          `✅ *አስቀድሞ ተመዝግበዋል!*\n\n👤 ${user.first_name}\n💰 ሂሳብ: *${parseFloat(user.balance).toFixed(2)} ETB*`,
          mainMenu()
        );
      } else {
        await sendMessage(chatId,
          `📝 *ምዝገባ*\n\nስልክ ቁጥርዎን ያጋሩ 👇`,
          {
            reply_markup: {
              keyboard: [[{ text: '📱 ስልክ ቁጥር አጋራ', request_contact: true }]],
              resize_keyboard: true, one_time_keyboard: true,
            }
          }
        );
      }
      break;

    case 'balance':
      await sendMessage(chatId,
        `💰 *ቀሪ ሂሳብ*\n\n👤 ${user.first_name}\n💵 *${parseFloat(user.balance).toFixed(2)} ETB*`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 ጨምር', callback_data: 'deposit' }, { text: '⬇️ አውጣ', callback_data: 'withdraw' }],
              [{ text: '🔙 ወደ ዋና ምናሌ', callback_data: 'menu' }],
            ]
          }
        }
      );
      break;

    case 'deposit': {
      // Get live payment accounts from settings
      let tbirr = { number: '0946336242', name: 'Tesfamichael' };
      let cbe   = { number: '1000296475387', name: 'Tesfamikael Worku' };
      try {
        const [s] = await db.query("SELECT key_name, value FROM settings WHERE key_name IN ('telebirr_number','telebirr_name','cbe_number','cbe_name')");
        const m = {};
        s.forEach(r => { m[r.key_name] = r.value; });
        if (m.telebirr_number) tbirr = { number: m.telebirr_number, name: m.telebirr_name || tbirr.name };
        if (m.cbe_number)      cbe   = { number: m.cbe_number,      name: m.cbe_name      || cbe.name };
      } catch {}

      await sendMessage(chatId,
        `💳 *ገንዘብ ጨምር*\n\n` +
        `📱 *Telebirr*\n\`${tbirr.number}\`\nስም: ${tbirr.name}\n\n` +
        `🏦 *CBE*\n\`${cbe.number}\`\nስም: ${cbe.name}\n\n` +
        `✅ ከላኩ በኋላ:\n1. የ SMS ማረጋገጫ ቅዱ\n2. ጨዋታ ከፍቶ → ሂሳብ → ጨምር → ለጥፍ`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 ጨዋታ ክፈት', web_app: { url: MINI_APP_URL } }],
              [{ text: '🔙 ወደ ዋና ምናሌ', callback_data: 'menu' }],
            ]
          }
        }
      );
      break;
    }

    case 'withdraw':
      await sendMessage(chatId,
        `⬇️ *ገንዘብ አውጣ*\n\n` +
        `ለማውጣት ጨዋታ ከፍቶ → ሂሳብ → አውጣ\n\n` +
        `⚠️ ቢያንስ *100 ETB* ሂሳብ ውስጥ መቆየት አለበት`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 ጨዋታ ክፈት', web_app: { url: MINI_APP_URL } }],
              [{ text: '🔙 ወደ ዋና ምናሌ', callback_data: 'menu' }],
            ]
          }
        }
      );
      break;

    case 'instruction':
      await sendMessage(chatId,
        `📖 *K Bingo መመሪያ*\n\n` +
        `1️⃣ ምዝገባ ጊዜ (45 ሰከንድ) ካርድ ምረጥ\n` +
        `2️⃣ ጨዋታ ሲጀምር ቁጥሮቹ ይጠራሉ\n` +
        `3️⃣ ቁጥሮቹ ካርድህ ላይ ካሉ ምልክት አድርግ\n` +
        `4️⃣ አግድም፣ ቀጥ፣ ሰያፍ ወይም አራት ማዕዘን ሲሞላ BINGO ጩህ!\n` +
        `5️⃣ ደራሽ ወዲያው ወደ ሂሳብህ ይገባል\n\n` +
        `💡 *ሁለት ካርዶች* መምረጥ ይቻላል!\n` +
        `⚡ *ራስ-ምልክት* ካበሩ ቁጥሮቹ ራሱ ይምልክታል`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 አሁን ጫወት', web_app: { url: MINI_APP_URL } }],
              [{ text: '🔙 ወደ ዋና ምናሌ', callback_data: 'menu' }],
            ]
          }
        }
      );
      break;

    case 'invite': {
      const code = user.referral_code || 'N/A';
      const link = `https://t.me/k_bingobot?start=ref_${code}`;
      await sendMessage(chatId,
        `🔗 *ጓደኛ ጋብዝ*\n\n` +
        `የሪፈራል ኮድህ:\n\`${code}\`\n\n` +
        `ሊንክ:\n${link}\n\n` +
        `🎁 ጓደኛህ ሲመዘገብ ሁለታችሁ *30 ETB* ትቀበላላችሁ!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📤 ሊንክ ያጋሩ', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('K Bingo ጫወት እና አትርፍ!')}` }],
              [{ text: '🔙 ወደ ዋና ምናሌ', callback_data: 'menu' }],
            ]
          }
        }
      );
      break;
    }

    case 'support':
      await sendMessage(chatId,
        `📞 *ድጋፍ*\n\n` +
        `ለማናቸውም ጥያቄ ወይም ችግር:\n\n` +
        `👤 ${SUPPORT_USER} ያናግሩ\n\n` +
        `⏰ ሰኞ–ቅዳሜ 8AM–10PM`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 አስተዳዳሪ ያናግሩ', url: `https://t.me/${SUPPORT_USER.replace('@','')}` }],
              [{ text: '🔙 ወደ ዋና ምናሌ', callback_data: 'menu' }],
            ]
          }
        }
      );
      break;

    case 'menu':
      await sendWelcome(chatId, user?.first_name, user?.balance);
      break;
  }
}

// ─── Notification helpers ─────────────────────────────────
async function notifyWinner(telegramId, firstName, prizeShare, pattern) {
  if (!TOKEN || !telegramId) return;
  const labels = { HORIZONTAL:'አግድም', VERTICAL:'ቀጥ', DIAGONAL:'ሰያፍ', FOUR_CORNERS:'አራት ማዕዘን' };
  await sendMessage(telegramId,
    `🏆 *እንኳን ደስ አለህ, ${firstName}!*\n\n` +
    `✅ ${labels[pattern] || pattern}\n💰 *${parseFloat(prizeShare).toFixed(2)} ETB* ወደ ሂሳብህ ገብቷል!`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 ቀጣይ ዙር', web_app: { url: MINI_APP_URL } }
        ]]
      }
    }
  );
}

async function notifyDepositApproved(telegramId, firstName, amount) {
  if (!TOKEN || !telegramId) return;
  await sendMessage(telegramId,
    `✅ *ሂሳብ ተጨምሯል!*\n\n${firstName}, *${parseFloat(amount).toFixed(2)} ETB* ወደ ሂሳብህ ገብቷል!`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: '🎮 ጫወት', web_app: { url: MINI_APP_URL } }]]
      }
    }
  );
}

async function notifyDepositRejected(telegramId, firstName, amount) {
  if (!TOKEN || !telegramId) return;
  await sendMessage(telegramId,
    `❌ *ጥያቄ ተቀባይነት አልተሰጠም*\n\n${firstName}, ${parseFloat(amount).toFixed(2)} ETB ጥያቄ ተሰርዟል.\n` +
    `ለጥያቄ ${SUPPORT_USER} ያናግሩ.`
  );
}

module.exports = {
  handleUpdate, sendMessage, sendPhoto,
  notifyWinner, notifyDepositApproved, notifyDepositRejected,
};

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
      await sendMessage(user.telegram_id, text, {
        reply_markup: { inline_keyboard: [[{ text: '🎮 ጫወት', web_app: { url: MINI_APP_URL } }]] }
      });
      await new Promise(r => setTimeout(r, 50));
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
    { reply_markup: { inline_keyboard: [[{ text: '🎮 ቀጣይ ዙር', web_app: { url: MINI_APP_URL } }]] } }
  );
}

// Notify deposit approved
async function notifyDepositApproved(telegramId, firstName, amount) {
  if (!TOKEN || !telegramId) return;
  await sendMessage(telegramId,
    `✅ *ሂሳብ ተጨምሯል!*\n\n` +
    `${firstName}, *${parseFloat(amount).toFixed(2)} ETB* ወደ ሂሳብህ ገብቷል!\n\n` +
    `ለመጫወት ይጫኑ 👇`,
    { reply_markup: { inline_keyboard: [[{ text: '🎮 ጫወት', web_app: { url: MINI_APP_URL } }]] } }
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
