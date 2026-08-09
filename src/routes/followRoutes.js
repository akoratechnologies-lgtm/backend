const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth");
const followController = require("../controllers/Followcontroller");

router.use(protect);

// Follow / Unfollow
router.post("/:userId/follow", followController.followUser);
router.delete("/:userId/follow", followController.unfollowUser);

// Follow status
router.get("/:userId/follow/status", followController.getFollowStatus);

// Followers / Following
router.get("/:userId/followers", followController.getFollowers);
router.get("/:userId/following", followController.getFollowing);

module.exports = router;