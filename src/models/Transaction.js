const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['recharge', 'gift_sent', 'gift_received', 'premium_purchase', 'withdrawal', 'refund'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['coins', 'INR', 'USD'], default: 'coins' },
    provider: { type: String, enum: ['razorpay', 'stripe', 'paypal', 'internal'], default: 'internal' },
    providerRefId: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);