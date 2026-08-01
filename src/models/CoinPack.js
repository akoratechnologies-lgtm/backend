const mongoose = require('mongoose');

const coinPackSchema = new mongoose.Schema(
  {
    // Stable slug used by the client/Razorpay receipts — never changes even
    // if the admin edits price/coins, so old orders/transactions still
    // resolve to the right pack for support/refund lookups.
    slug: { type: String, required: true, unique: true, trim: true },
    coins: { type: Number, required: true, min: 1 },
    bonusLabel: { type: String, default: null },
    priceInPaise: { type: Number, required: true, min: 100 }, // Razorpay minimum
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

coinPackSchema.methods.toClient = function toClient() {
  return {
    id: this.slug,
    coins: this.coins,
    bonusLabel: this.bonusLabel,
    priceInPaise: this.priceInPaise,
    priceLabel: `₹${(this.priceInPaise / 100).toLocaleString('en-IN')}`,
  };
};

module.exports = mongoose.model('CoinPack', coinPackSchema);