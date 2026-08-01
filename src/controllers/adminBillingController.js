const CoinPack = require('../models/CoinPack');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const { emitToAll } = require('../socket/io');

// ---- Coin Packs -----------------------------------------------------------

exports.listCoinPacks = async (req, res, next) => {
  try {
    const packs = await CoinPack.find().sort({ sortOrder: 1, priceInPaise: 1 });
    res.json({ success: true, packs });
  } catch (err) {
    next(err);
  }
};

exports.createCoinPack = async (req, res, next) => {
  try {
    const { slug, coins, bonusLabel, priceInPaise, sortOrder, active } = req.body;
    if (!slug || !coins || !priceInPaise) {
      return res.status(422).json({ success: false, message: 'slug, coins, and priceInPaise are required.' });
    }
    const pack = await CoinPack.create({ slug, coins, bonusLabel, priceInPaise, sortOrder, active });
    emitToAll('billing:coinpacks-updated', {});
    res.status(201).json({ success: true, pack });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A coin pack with this slug already exists.' });
    }
    next(err);
  }
};

exports.updateCoinPack = async (req, res, next) => {
  try {
    const allowed = ['coins', 'bonusLabel', 'priceInPaise', 'sortOrder', 'active'];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    const pack = await CoinPack.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!pack) return res.status(404).json({ success: false, message: 'Coin pack not found.' });
    emitToAll('billing:coinpacks-updated', {});
    res.json({ success: true, pack });
  } catch (err) {
    next(err);
  }
};

exports.deleteCoinPack = async (req, res, next) => {
  try {
    const pack = await CoinPack.findByIdAndDelete(req.params.id);
    if (!pack) return res.status(404).json({ success: false, message: 'Coin pack not found.' });
    emitToAll('billing:coinpacks-updated', {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ---- Subscription Plans ----------------------------------------------------

exports.listPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ sortOrder: 1, priceInPaise: 1 });

    // Real active-subscriber counts per plan, straight from User — this is
    // what actually powers the numbers shown on the Premium Management page.
    const counts = await User.aggregate([
      { $match: { isPremium: true } },
      { $group: { _id: '$premiumPlan', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));

    const plansWithCounts = plans.map((p) => ({
      ...p.toObject(),
      activeSubscribers: countMap[p.slug] || 0,
    }));

    res.json({ success: true, plans: plansWithCounts });
  } catch (err) {
    next(err);
  }
};

exports.createPlan = async (req, res, next) => {
  try {
    const { slug, label, period, durationDays, priceInPaise, tag, sortOrder, active } = req.body;
    if (!slug || !label || !period || !priceInPaise) {
      return res.status(422).json({ success: false, message: 'slug, label, period, and priceInPaise are required.' });
    }
    const plan = await SubscriptionPlan.create({
      slug, label, period, durationDays, priceInPaise, tag, sortOrder, active,
    });
    emitToAll('billing:plans-updated', {});
    res.status(201).json({ success: true, plan });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A plan with this slug already exists.' });
    }
    next(err);
  }
};

exports.updatePlan = async (req, res, next) => {
  try {
    const allowed = ['label', 'period', 'durationDays', 'priceInPaise', 'tag', 'sortOrder', 'active'];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    emitToAll('billing:plans-updated', {});
    res.json({ success: true, plan });
  } catch (err) {
    next(err);
  }
};

exports.deletePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    emitToAll('billing:plans-updated', {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};