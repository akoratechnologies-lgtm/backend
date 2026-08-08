const User = require("../models/User");
const { emitToRoom } = require("../socket/io");

// POST /api/users/:userId
// Follow user
exports.followUser = async (req, res, next) => {
  try {
    const targetId = req.params.userId;

    if (targetId === String(req.user._id)) {
      return res.status(422).json({
        success: false,
        message: "You can't follow yourself.",
      });
    }

    const target = await User.findById(targetId);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: {
        following: targetId,
      },
    });

    await User.findByIdAndUpdate(targetId, {
      $addToSet: {
        followers: req.user._id,
      },
    });

    // Notify target user in real time
    emitToRoom(`user:${targetId}`, "user:new-follower", {
      follower: {
        id: req.user._id,
        name:
          req.user.fullName ||
          req.user.username ||
          "Someone",
        avatar: req.user.profilePhoto || "",
      },
    });

    return res.json({
      success: true,
      following: true,
    });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/users/:userId
// Unfollow user
exports.unfollowUser = async (req, res, next) => {
  try {
    const targetId = req.params.userId;

    await User.findByIdAndUpdate(req.user._id, {
      $pull: {
        following: targetId,
      },
    });

    await User.findByIdAndUpdate(targetId, {
      $pull: {
        followers: req.user._id,
      },
    });

    return res.json({
      success: true,
      following: false,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/users/:userId/status
// Check whether current user follows target user
exports.getFollowStatus = async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    const currentUserId = String(req.user._id);

    const target = await User.findById(targetId)
      .select("_id followers");

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isFollowing = target.followers.some(
      (id) => String(id) === currentUserId
    );

    return res.json({
      success: true,
      isFollowing,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/users/:userId/followers
exports.getFollowers = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate(
        "followers",
        "fullName username profilePhoto country"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const followers = user.followers.map((u) => ({
      id: u._id,
      name:
        u.fullName ||
        u.username ||
        "AKORA user",
      avatar: u.profilePhoto || "",
      country: u.country || "",
    }));

    return res.json({
      success: true,
      followers,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/users/:userId/following
exports.getFollowing = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate(
        "following",
        "fullName username profilePhoto country"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const following = user.following.map((u) => ({
      id: u._id,
      name:
        u.fullName ||
        u.username ||
        "AKORA user",
      avatar: u.profilePhoto || "",
      country: u.country || "",
    }));

    return res.json({
      success: true,
      following,
    });
  } catch (err) {
    next(err);
  }
};