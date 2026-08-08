const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth");
const followController = require("../controllers/followController");

router.use(protect);

// Follow / Unfollow
router.post("/:userId", followController.followUser);
router.delete("/:userId", followController.unfollowUser);

// Follow status
router.get("/:userId/status", followController.getFollowStatus);

// Followers / Following
router.get("/:userId/followers", followController.getFollowers);
router.get("/:userId/following", followController.getFollowing);

module.exports = router;