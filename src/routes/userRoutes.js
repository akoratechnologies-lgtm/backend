const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const userController = require('../controllers/userController');
const followController = require('../controllers/Followcontroller');

router.use(protect);
router.get('/me', userController.getMe);
router.get('/discover', userController.discoverUsers);
router.get('/search', userController.searchUsers);
router.patch('/complete-profile', userController.completeProfile);
router.patch('/me', userController.updateProfile);
router.post('/photos', userController.uploadPhoto);
router.delete('/photos', userController.deletePhoto);
router.get('/blocked', userController.getBlockedUsers);
router.post('/block/:id', userController.blockUser);
router.delete('/block/:id', userController.unblockUser);
router.post('/push-token', userController.registerPushToken);

router.post('/:id/follow', followController.followUser);
router.delete('/:id/follow', followController.unfollowUser);
router.get('/:id/followers', followController.getFollowers);
router.get('/:id/following', followController.getFollowing);

// Kept last — a bare :id is a catch-all, so it must never sit above a more
// specific route like /search or /discover or it would swallow those first.
router.get('/:id', userController.getPublicProfile);

module.exports = router;