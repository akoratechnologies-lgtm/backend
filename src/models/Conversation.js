const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// A given pair of users should only ever have one conversation document.
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);