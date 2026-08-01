const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      required: true,
      enum: [
        'Nudity or sexual content',
        'Harassment or abusive language',
        'Spam or scam',
        'Underage user',
        'Something else',
      ],
    },
    status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);