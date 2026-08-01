const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminBilling = require('../controllers/adminBillingController');
const giftController = require('../controllers/giftController');
const notificationController = require('../controllers/notificationController');

router.use(protect, restrictTo('admin'));

router.get('/billing/coin-packs', adminBilling.listCoinPacks);
router.post('/billing/coin-packs', adminBilling.createCoinPack);
router.patch('/billing/coin-packs/:id', adminBilling.updateCoinPack);
router.delete('/billing/coin-packs/:id', adminBilling.deleteCoinPack);

router.get('/billing/subscription-plans', adminBilling.listPlans);
router.post('/billing/subscription-plans', adminBilling.createPlan);
router.patch('/billing/subscription-plans/:id', adminBilling.updatePlan);
router.delete('/billing/subscription-plans/:id', adminBilling.deletePlan);

router.get('/gifts', giftController.listGifts);
router.post('/gifts', giftController.createGift);
router.patch('/gifts/:id', giftController.updateGift);
router.delete('/gifts/:id', giftController.deleteGift);

router.get('/notifications', notificationController.listNotifications);
router.post('/notifications/broadcast', notificationController.broadcast);

module.exports = router;