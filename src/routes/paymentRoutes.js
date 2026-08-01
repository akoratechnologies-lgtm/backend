const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Prices/plans are public info — no auth needed to browse them.
router.get('/coins/packs', paymentController.getCoinPacks);
router.get('/subscription/plans', paymentController.getSubscriptionPlans);

router.use(protect);
router.post('/coins/order', paymentController.createCoinOrder);
router.post('/subscription/order', paymentController.createSubscriptionOrder);
router.post('/verify', paymentController.verifyPayment);

module.exports = router;