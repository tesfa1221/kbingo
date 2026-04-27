const cron = require('node-cron');
const db   = require('../db/connection');
const { sendMessage } = require('../telegram/bot');

// ─── Post winner to channel (called after each game) ─────
// Only posts if a REAL player (not bot) won
async function postWinnerToTelegram(gameData) {
  const { gameCode, winners, prizeShare, netPrize } = gameData;
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) return;

  // Only post if a real player won (not a bot)
  const realWinners = winners.filter(w => !w.is_bot);
  if (!realWinners.length) return;

  try {
    const winnerNames = realWinners.map(w => w.firstName || w.username || 'ተጫዋች').join(', ');
    const text =
      `🏆 *K Bingo — አሸናፊ!*\n\n` +
      `👤 *${winnerNames}* አሸነፈ!\n` +
      `💰 ደራሽ: *${parseFloat(prizeShare).toFixed(0)} ETB*\n\n` +
      `🎮 አንተም ጫወት → @k_bingobot`;

    const { default: axios } = await import('axios').catch(() => ({ default: require('axios') }));
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: process.env.TELEGRAM_CHANNEL_ID, text, parse_mode: 'Markdown' }
    );
    console.log('📢 Real winner posted to channel');
  } catch (err) {
    console.error('❌ Telegram post failed:', err.message);
  }
}

// ─── Daily promotion cron ─────────────────────────────────
// Sends a nice promotional message to all users once per day
function startDailySummaryCron() {

  // Morning promotion — 9 AM every day
  cron.schedule('0 9 * * *', async () => {
    await sendDailyPromotion('morning');
  });

  // Evening promotion — 8 PM every day
  cron.schedule('0 20 * * *', async () => {
    await sendDailyPromotion('evening');
  });

  console.log('⏰ Daily promotion cron scheduled (9AM + 8PM)');
}

async function sendDailyPromotion(time) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  try {
    const PROMOS_FALLBACK = [
      `🎮 *K Bingo — ጫወት እና አትርፍ!*\n\n💰 10 ETB ብቻ ከፍለህ 80 ETB+ አትርፍ!\n🏆 አሁን ጫወት 👇`,
    ];

    // Load active promos from DB, fallback to hardcoded if none
    let text;
    try {
      const [promoRows] = await db.query('SELECT text_body FROM promotions WHERE is_active=1 ORDER BY RAND() LIMIT 1');
      text = promoRows.length ? promoRows[0].text_body : PROMOS_FALLBACK[0];
    } catch {
      text = PROMOS_FALLBACK[0];
    }

    // Send to all users with telegram_id who played in last 7 days
    const [users] = await db.query(`
      SELECT DISTINCT u.telegram_id
      FROM users u
      JOIN tickets t ON t.user_id = u.id
      JOIN games g ON g.id = t.game_id
      WHERE u.telegram_id IS NOT NULL
        AND u.is_bot = 0
        AND g.finished_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      LIMIT 200
    `);

    const keyboard = {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 K Bingo ጫወት', web_app: { url: process.env.MINI_APP_URL || 'https://negattech.com/kbingo' } }
        ]]
      }
    };

    let sent = 0;
    for (const user of users) {
      try {
        await sendMessage(user.telegram_id, text, keyboard);
        sent++;
        await new Promise(r => setTimeout(r, 100)); // 10 msgs/sec rate limit
      } catch { /* user may have blocked bot */ }
    }

    console.log(`📢 Daily ${time} promotion sent to ${sent} users`);
  } catch (err) {
    console.error('❌ Daily promotion failed:', err.message);
  }
}

module.exports = { postWinnerToTelegram, startDailySummaryCron };
