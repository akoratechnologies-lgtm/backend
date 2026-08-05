const { Expo } = require("expo-server-sdk");

const expo = new Expo();

async function sendExpoPush(tokens, { title, message }) {
  const messages = [];

  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token)) continue;

    messages.push({
      to: token,
      sound: "default",
      title,
      body: message,
      priority: "high",
      data: {
        click: "notification",
      },
    });
  }

  const chunks = expo.chunkPushNotifications(messages);

  let sent = 0;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      sent += tickets.length;
    } catch (e) {
      console.log(e);
    }
  }

  return { sent };
}

module.exports = {
  sendExpoPush,
};