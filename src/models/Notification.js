const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['push', 'email', 'sms'], default: 'push' },
    audience: { type: String, default: 'all' }, // 'all' or a country name, e.g. "India"
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);