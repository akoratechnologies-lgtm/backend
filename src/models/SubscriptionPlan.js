const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true }, // e.g. "Monthly"
    period: { type: String, required: true, trim: true }, // e.g. "/mo", "one-time"
    durationDays: { type: Number, default: null }, // null = lifetime
    priceInPaise: { type: Number, required: true, min: 100 },
    tag: { type: String, default: null }, // e.g. "Popular", "Best Value"
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

subscriptionPlanSchema.methods.toClient = function toClient() {
  return {
    id: this.slug,
    label: this.label,
    period: this.period,
    durationDays: this.durationDays,
    priceInPaise: this.priceInPaise,
    priceLabel: `₹${(this.priceInPaise / 100).toLocaleString('en-IN')}`,
    tag: this.tag,
  };
};

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);