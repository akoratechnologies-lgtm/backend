const Gift = require('../models/Gift');
const { emitToAll } = require('../socket/io');

exports.listGifts = async (req, res, next) => {
  try {
    const gifts = await Gift.find().sort({ sortOrder: 1, cost: 1 });
    res.json({ success: true, gifts });
  } catch (err) {
    next(err);
  }
};

exports.createGift = async (req, res, next) => {
  try {
    const { slug, name, emoji, cost, category, sortOrder, active } = req.body;
    if (!slug || !name || !emoji || !cost) {
      return res.status(422).json({ success: false, message: 'slug, name, emoji, and cost are required.' });
    }
    const gift = await Gift.create({ slug, name, emoji, cost, category, sortOrder, active });
    emitToAll('gifts:updated', {});
    res.status(201).json({ success: true, gift });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A gift with this slug already exists.' });
    }
    next(err);
  }
};

exports.updateGift = async (req, res, next) => {
  try {
    const allowed = ['name', 'emoji', 'cost', 'category', 'sortOrder', 'active'];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    const gift = await Gift.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!gift) return res.status(404).json({ success: false, message: 'Gift not found.' });
    emitToAll('gifts:updated', {});
    res.json({ success: true, gift });
  } catch (err) {
    next(err);
  }
};

exports.deleteGift = async (req, res, next) => {
  try {
    const gift = await Gift.findByIdAndDelete(req.params.id);
    if (!gift) return res.status(404).json({ success: false, message: 'Gift not found.' });
    emitToAll('gifts:updated', {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/gifts (protected, public-to-any-logged-in-user) — powers the
// gift tray in VideoCallScreen.
exports.getPublicGifts = async (req, res, next) => {
  try {
    const gifts = await Gift.find({ active: true }).sort({ sortOrder: 1, cost: 1 });
    res.json({ success: true, gifts: gifts.map((g) => g.toClient()) });
  } catch (err) {
    next(err);
  }
};