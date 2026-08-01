const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

router.use(protect);
router.get('/', walletController.getWallet);
router.post('/recharge', walletController.initiateRecharge);
router.get('/transactions', walletController.getTransactionHistory);

module.exports = router;
