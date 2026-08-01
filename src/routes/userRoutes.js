const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.use(protect);
router.get('/me', userController.getMe);
router.get('/discover', userController.discoverUsers);
router.patch('/complete-profile', userController.completeProfile);
router.patch('/me', userController.updateProfile);
router.post('/photos', userController.uploadPhoto);
router.delete('/photos', userController.deletePhoto);
router.get('/blocked', userController.getBlockedUsers);
router.post('/block/:id', userController.blockUser);
router.delete('/block/:id', userController.unblockUser);
router.post('/push-token', userController.registerPushToken);

module.exports = router;