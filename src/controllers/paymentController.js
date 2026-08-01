const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const CoinPack = require('../models/CoinPack');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// GET /api/payments/coins/packs
exports.getCoinPacks = async (req, res, next) => {
  try {
    const packs = await CoinPack.find({ active: true }).sort({ sortOrder: 1, priceInPaise: 1 });
    res.json({ success: true, packs: packs.map((p) => p.toClient()) });
  } catch (err) {
    next(err);
  }
};

// GET /api/payments/subscription/plans
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({ active: true }).sort({ sortOrder: 1, priceInPaise: 1 });
    res.json({ success: true, plans: plans.map((p) => p.toClient()) });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/coins/order   body: { packId }
exports.createCoinOrder = async (req, res, next) => {
  try {
    const pack = await CoinPack.findOne({ slug: req.body.packId, active: true });
    if (!pack) return res.status(422).json({ success: false, message: 'Invalid coin pack.' });

    const order = await razorpay.orders.create({
      amount: pack.priceInPaise,
      currency: 'INR',
      receipt: `c_${Date.now()}_${String(req.user._id).slice(-8)}`,
      notes: { userId: String(req.user._id), packId: pack.slug, kind: 'coins' },
    });

    await Transaction.create({
      user: req.user._id,
      type: 'recharge',
      amount: pack.priceInPaise / 100,
      currency: 'INR',
      provider: 'razorpay',
      providerRefId: order.id,
      status: 'pending',
      // Snapshotted at order time — if an admin edits/deletes this pack
      // before the user finishes paying, verification still credits exactly
      // what was actually being purchased.
      meta: { packId: pack.slug, coins: pack.coins },
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/subscription/order   body: { planId }
exports.createSubscriptionOrder = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOne({ slug: req.body.planId, active: true });
    if (!plan) return res.status(422).json({ success: false, message: 'Invalid plan.' });

    const order = await razorpay.orders.create({
      amount: plan.priceInPaise,
      currency: 'INR',
      receipt: `p_${Date.now()}_${String(req.user._id).slice(-8)}`,
      notes: { userId: String(req.user._id), planId: plan.slug, kind: 'premium' },
    });

    await Transaction.create({
      user: req.user._id,
      type: 'premium_purchase',
      amount: plan.priceInPaise / 100,
      currency: 'INR',
      provider: 'razorpay',
      providerRefId: order.id,
      status: 'pending',
      // Snapshotted at order time — see note in createCoinOrder above.
      meta: { planId: plan.slug, durationDays: plan.durationDays },
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
};

function isValidSignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  // Constant-time comparison — avoids leaking timing info about the correct signature.
  return (
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  );
}

// POST /api/payments/verify   body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// The single source of truth for "did this payment really happen" — coins
// are credited / premium is activated ONLY here, after verifying Razorpay's
// signature server-side. The app's "payment succeeded" callback alone is
// never enough, since that event fires client-side and could be spoofed.
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(422).json({ success: false, message: 'Missing payment verification fields.' });
    }

    if (!isValidSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    const txn = await Transaction.findOne({
      providerRefId: razorpay_order_id,
      user: req.user._id,
      status: 'pending',
    });
    if (!txn) {
      return res.status(404).json({ success: false, message: 'No matching pending transaction found.' });
    }

    txn.status = 'success';
    txn.meta = { ...txn.meta, razorpay_payment_id };
    await txn.save();

    let wallet = null;
    let user = null;

    if (txn.type === 'recharge') {
      wallet = await Wallet.findOneAndUpdate(
        { user: req.user._id },
        { $inc: { coinBalance: txn.meta.coins }, $setOnInsert: { user: req.user._id } },
        { new: true, upsert: true }
      );
    } else if (txn.type === 'premium_purchase') {
      // Use the duration snapshotted at order-creation time (see
      // createSubscriptionOrder) rather than re-fetching the plan — the
      // plan admin edited/removed after this order was placed shouldn't
      // change what a user who already paid actually receives.
      const durationDays = txn.meta.durationDays;
      const now = new Date();
      const base = req.user.premiumExpiresAt && req.user.premiumExpiresAt > now ? req.user.premiumExpiresAt : now;
      const expiresAt = durationDays ? new Date(base.getTime() + durationDays * 86400000) : null; // null = lifetime

      user = await User.findByIdAndUpdate(
        req.user._id,
        { isPremium: true, premiumPlan: txn.meta.planId, premiumExpiresAt: expiresAt },
        { new: true }
      );
    }

    res.json({ success: true, transaction: txn, wallet, user });
  } catch (err) {
    next(err);
  }
};