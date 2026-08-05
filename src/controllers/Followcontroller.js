const User = require('../models/User');
const { emitToRoom } = require('../socket/io');

// POST /api/users/:id/follow   (protected)
exports.followUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === String(req.user._id)) {
      return res.status(422).json({ success: false, message: "You can't follow yourself." });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $addToSet: { followers: req.user._id } });

    // Real-time: if the person being followed is online, their follower
    // count updates immediately without them needing to refresh anything.
    emitToRoom(`user:${targetId}`, 'user:new-follower', {
      follower: {
        id: req.user._id,
        name: req.user.fullName || req.user.username || 'Someone',
        avatar: req.user.profilePhoto || '',
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id/follow   (protected)
exports.unfollowUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    await User.findByIdAndUpdate(req.user._id, { $pull: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $pull: { followers: req.user._id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id/followers   (protected)
exports.getFollowers = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('followers', 'fullName username profilePhoto country');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const followers = user.followers.map((u) => ({
      id: u._id, name: u.fullName || u.username || 'AKORA user', avatar: u.profilePhoto || '', country: u.country || '',
    }));
    res.json({ success: true, followers });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id/following   (protected)
exports.getFollowing = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('following', 'fullName username profilePhoto country');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const following = user.following.map((u) => ({
      id: u._id, name: u.fullName || u.username || 'AKORA user', avatar: u.profilePhoto || '', country: u.country || '',
    }));
    res.json({ success: true, following });
  } catch (err) {
    next(err);
  }
};