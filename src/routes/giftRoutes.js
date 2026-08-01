const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const giftController = require('../controllers/giftController');

router.use(protect);
router.get('/', giftController.getPublicGifts);

module.exports = router;