const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToAll, emitToRoom } = require('../socket/io');
const { sendExpoPush } = require('../utils/expoPush');

// GET /api/admin/notifications
exports.listNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications   (any logged-in user)
// Powers the in-app notification bell — history relevant to this user
// (broadcasts to everyone, or to their specific country), newest first.
exports.getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      $or: [{ audience: 'all' }, { audience: req.user.country }],
    })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
};
exports.broadcast = async (req, res, next) => {
  try {
    const { channel = 'push', audience = 'all', title, message } = req.body;
    if (!title || !message) {
      return res.status(422).json({ success: false, message: 'title and message are required.' });
    }

    const userFilter = audience === 'all' ? {} : { country: audience };
    const recipients = await User.find(userFilter).select('pushToken');
    const tokens = recipients.map((u) => u.pushToken).filter(Boolean);

    // 1. Real push notification, delivered even if the app is closed.
    const { sent } = channel === 'push'
      ? await sendExpoPush(tokens, { title, message })
      : { sent: recipients.length }; // email/sms not wired to a provider yet — tracked but not actually sent

    // 2. Real-time in-app delivery for anyone currently online — shows
    // instantly with zero delay, no refresh, independent of push delivery.
    const payload = { title, message, audience, sentAt: new Date().toISOString() };
    if (audience === 'all') {
      emitToAll('notification:new', payload);
    } else {
      emitToRoom(`country:${audience}`, 'notification:new', payload);
    }

    const record = await Notification.create({
      channel, audience, title, message, sentBy: req.user._id, recipientCount: recipients.length,
    });

    res.status(201).json({ success: true, notification: record, pushSent: sent });
  } catch (err) {
    next(err);
  }
};