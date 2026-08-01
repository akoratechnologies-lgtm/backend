const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

exports.getWallet = async (req, res, next) => {
  try {
    // New users never get a Wallet document created anywhere else in the
    // app, so without upsert this returns `wallet: null` and crashes any
    // screen reading `wallet.coinBalance` for a brand-new account.
    const wallet = await Wallet.findOneAndUpdate(
      { user: req.user._id },
      { $setOnInsert: { user: req.user._id, coinBalance: 0 } },
      { new: true, upsert: true }
    );
    res.json({ success: true, wallet });
  } catch (err) {
    next(err);
  }
};

// POST /api/wallet/recharge
// NOTE: This creates a pending transaction; actual coin credit should happen
// in a Razorpay/Stripe webhook handler AFTER verifying payment signature server-side,
// never trust a client-reported "success" for crediting coins.
exports.initiateRecharge = async (req, res, next) => {
  try {
    const { amount, provider } = req.body;
    const txn = await Transaction.create({
      user: req.user._id,
      type: 'recharge',
      amount,
      currency: 'INR',
      provider,
      status: 'pending',
    });
    res.json({ success: true, transactionId: txn._id, message: 'Proceed to payment gateway with this transaction reference' });
  } catch (err) {
    next(err);
  }
};

exports.getTransactionHistory = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, transactions });
  } catch (err) {
    next(err);
  }
};