const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

router.use(protect);
router.post('/', reportController.createReport);

module.exports = router;