const logger = require('./logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 90; // Expo's documented limit is 100 per request; leave headroom

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// tokens: string[] (Expo push tokens, already filtered for validity)
async function sendExpoPush(tokens, { title, message }) {
  const validTokens = tokens.filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (validTokens.length === 0) return { sent: 0 };

  const chunks = chunk(validTokens, CHUNK_SIZE);
  let sent = 0;

  for (const batch of chunks) {
    const body = batch.map((to) => ({ to, title, body: message, sound: 'default' }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        logger.error(`Expo push batch failed: ${res.status} ${await res.text()}`);
        continue;
      }
      sent += batch.length;
    } catch (err) {
      logger.error(`Expo push batch error: ${err.message}`);
    }
  }

  return { sent };
}

module.exports = { sendExpoPush };