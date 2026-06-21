// Verifies Telegram Mini App `initData` per Telegram's documented algorithm.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const crypto = require('crypto');

function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return { ok: false, reason: 'missing initData or bot token' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'no hash present' };
  params.delete('hash');

  const pairs = [];
  for (const [key, value] of params.entries()) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return { ok: false, reason: 'hash mismatch' };

  // Optional: reject stale auth (older than 24h)
  const authDate = Number(params.get('auth_date') || 0);
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > 86400) return { ok: false, reason: 'initData expired' };

  const userRaw = params.get('user');
  const user = userRaw ? JSON.parse(userRaw) : null;

  return { ok: true, user };
}

module.exports = { verifyInitData };
