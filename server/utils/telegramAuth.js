const crypto = require('crypto');

/**
 * Validates Telegram WebApp initData to prevent spoofing.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false, data: null };

    params.delete('hash');

    // Sort keys alphabetically and build check string
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    if (expectedHash !== hash) {
      return { valid: false, data: null };
    }

    // Parse user data
    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : null;

    return { valid: true, data: { user, authDate: params.get('auth_date') } };
  } catch (err) {
    return { valid: false, data: null };
  }
}

module.exports = { validateTelegramInitData };
