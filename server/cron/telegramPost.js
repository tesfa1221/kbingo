const cron = require('node-cron');
const axios = require('axios');
const db    = require('../db/connection');

/**
 * Auto-post winner results to Telegram channel after each game.
 * Called from GameEngine after finalization.
 */
async function postWinnerToTelegram(gameData) {
  const { gameCode, winners, prizeShare, netPrize } = gameData;
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) return;

  try {
    const winnerNames = winners.map(w => w.firstName || w.username || `User#${w.userId}`).join(', ');
    const text =
      `🎉 *K Bingo - ዙር ተጠናቀቀ!*\n\n` +
      `🎮 Game: \`${gameCode}\`\n` +
      `🏆 አሸናፊ: *${winnerNames}*\n` +
      `💰 ደራሽ: *${prizeShare.toFixed(2)} ETB*\n` +
      `📊 ጠቅላላ ፈንድ: ${netPrize.toFixed(2)} ETB\n\n` +
      `👉 ለመጫወት ቦቱን ክፈቱ!`;

    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id:    process.env.TELEGRAM_CHANNEL_ID,
        text,
        parse_mode: 'Markdown',
      }
    );
    console.log('📢 Winner posted to Telegram channel');
  } catch (err) {
    console.error('❌ Telegram post failed:', err.message);
  }
}

/**
 * Daily summary cron — posts top 3 winners of the day at 9 PM.
 */
function startDailySummaryCron() {
  cron.schedule('0 21 * * *', async () => {
    try {
      const [rows] = await db.query(
        `SELECT u.first_name, u.username, SUM(w.prize_share) AS total
         FROM winners w JOIN users u ON u.id = w.user_id
         WHERE DATE(w.created_at) = CURDATE()
         GROUP BY u.id ORDER BY total DESC LIMIT 3`
      );

      if (!rows.length) return;

      const lines = rows.map((r, i) =>
        `${['🥇','🥈','🥉'][i]} ${r.first_name || r.username}: ${parseFloat(r.total).toFixed(2)} ETB`
      ).join('\n');

      const text = `📅 *ዛሬ ምርጥ አሸናፊዎች*\n\n${lines}\n\n🎮 K Bingo`;

      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        { chat_id: process.env.TELEGRAM_CHANNEL_ID, text, parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('❌ Daily cron failed:', err.message);
    }
  });
  console.log('⏰ Daily summary cron scheduled');
}

module.exports = { postWinnerToTelegram, startDailySummaryCron };
