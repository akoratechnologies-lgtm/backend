const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    emoji: { type: String, required: true }, // e.g. "🌹" — keeps the app dependency-free (no image hosting needed)
    cost: { type: Number, required: true, min: 1 }, // in coins
    category: { type: String, enum: ['basic', 'luxury'], default: 'basic' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

giftSchema.methods.toClient = function toClient() {
  return {
    id: this.slug,
    name: this.name,
    emoji: this.emoji,
    cost: this.cost,
    category: this.category,
  };
};

module.exports = mongoose.model('Gift', giftSchema);