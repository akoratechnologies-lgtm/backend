const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Real completion score behind the "Azar Badge" progress bar — every field
// here is something the user actually filled in, nothing hardcoded.
function calcProfileCompletion(user) {
  const checks = [
    !!(user.photos && user.photos.length > 0),
    !!(user.bio && user.bio.trim().length > 0),
    !!(user.interests && user.interests.length > 0),
    !!(user.languages && user.languages.length > 0),
    !!user.country,
    !!user.dateOfBirth,
    !!user.isMobileVerified,
    !!user.isEmailVerified,
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

// GET /api/users/me   (protected)
exports.getMe = async (req, res, next) => {
  try {
    const user = req.user.toObject ? req.user.toObject() : req.user;
    user.profileCompletion = calcProfileCompletion(req.user);
    user.followersCount = (user.followers || []).length;
    user.followingCount = (user.following || []).length;
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/search?q=someusername   (protected)
// Instagram-style: search by exact/partial username (the permanent, unique
// handle) so a user can find one specific person out of the whole user base.
exports.searchUsers = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, users: [] });

    const users = await User.find({
      _id: { $ne: req.user._id },
      username: { $regex: q, $options: 'i' },
      isBanned: false,
    })
      .select('fullName username profilePhoto country isOnline followers')
      .limit(20);

    res.json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        name: u.fullName || u.username,
        username: u.username,
        avatar: u.profilePhoto || '',
        country: u.country || '',
        isOnline: !!u.isOnline,
        isFollowing: (u.followers || []).some((f) => String(f) === String(req.user._id)),
      })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id   (protected) — public profile view (for search results,
// video-call partner card, followers/following lists, etc.)
exports.getPublicProfile = async (req, res, next) => {
  try {
const user = await User.findById(req.params.id).select(
  'fullName username profilePhoto photos bio interests languages country state gender dateOfBirth isOnline followers following privacy hideGender'
);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

res.json({
  success: true,
  user: {
    id: user._id,
    name: user.fullName || user.username || 'AKORA user',
    username: user.username,
    age: calcAge(user.dateOfBirth),
    gender: user.hideGender ? null : user.gender,
    country: user.country || '',
    avatar: user.profilePhoto || '',
    photos: user.photos || [],
    bio: user.bio || '',
    interests: user.interests || [],
    languages: user.languages || [],
    isOnline: user.privacy?.hideOnlineStatus ? false : user.isOnline,
    lastSeen: user.privacy?.hideLastSeen ? null : user.lastSeen,
    followerCount: (user.followers || []).length,
    followingCount: (user.following || []).length,
    isFollowedByMe: (user.followers || []).some((f) => String(f) === String(req.user._id)),
    canMessage: user.privacy?.whoCanMessage !== 'nobody',
  },
});
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/complete-profile   (protected)
// Called once, right after first OTP signup, to collect the rest of the profile.
exports.completeProfile = async (req, res, next) => {
  try {
    const { fullName, username, email, country, state, city, gender, dateOfBirth } = req.body;

    if (!fullName || !username || !country || !state || !gender || !dateOfBirth) {
      return res.status(422).json({
        success: false,
        message: 'fullName, username, country, state, gender and dateOfBirth are required',
      });
    }

    // 18+ check happens HERE now, since DOB is collected after OTP signup
    const dob = new Date(dateOfBirth);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (isNaN(dob.getTime()) || age < 18) {
      return res.status(403).json({ success: false, message: 'You must be 18 or older to use AKORA Live.' });
    }

    const clash = await User.findOne({
      _id: { $ne: req.user._id },
      $or: [{ username }, ...(email ? [{ email }] : [])],
    });
    if (clash) {
      return res.status(409).json({ success: false, message: 'Username or email already in use.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { fullName, username, email, country, state, city, gender, dateOfBirth, isProfileComplete: true },
      { new: true, runValidators: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = [
      'fullName', 'bio', 'interests', 'languages', 'city', 'country',
      'profilePhoto', 'privacy', 'notificationPrefs', 'hideGender',
    ];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    const obj = user.toObject();
    obj.profileCompletion = calcProfileCompletion(user);
    res.json({ success: true, user: obj });
  } catch (err) {
    next(err);
  }
};

function calcAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

// GET /api/users/discover   (protected)
// Powers the Discover grid: real, complete profiles only, excluding yourself,
// anyone you've blocked, anyone who's blocked you, and banned/suspended
// accounts. Online users are surfaced first. Also returns an accurate
// site-wide online count (not just of this page) for the header stat.
exports.discoverUsers = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    const baseFilter = {
      _id: { $ne: req.user._id, $nin: req.user.blockedUsers || [] },
      blockedUsers: { $ne: req.user._id },
      isProfileComplete: true,
      isBanned: false,
      isSuspended: false,
      'privacy.privateAccount': { $ne: true },
    };

    if (req.query.gender && ['male', 'female', 'other'].includes(req.query.gender)) {
      baseFilter.gender = req.query.gender;
    }
    if (req.query.country) {
      baseFilter.country = req.query.country;
    }

    const [users, total, onlineCount] = await Promise.all([
      User.find(baseFilter)
        .select('fullName username country profilePhoto isOnline gender dateOfBirth lastSeen privacy')
        .sort({ isOnline: -1, lastSeen: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(baseFilter),
      User.countDocuments({ ...baseFilter, isOnline: true }),
    ]);

    const results = users.map((u) => ({
      id: u._id,
      name: u.fullName || u.username || 'AKORA user',
      age: calcAge(u.dateOfBirth),
      country: u.country || '',
      avatar: u.profilePhoto || '',
      // Respect the user's own privacy setting even though isOnline is stored.
      isOnline: u.privacy?.hideOnlineStatus ? false : u.isOnline,
    }));

    res.json({
      success: true,
      users: results,
      onlineCount,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    next(err);
  }
};

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const ALLOWED_MIME = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// POST /api/users/photos   (protected)   body: { imageBase64, mimeType }
// Saves the image to disk and adds it to the user's photo grid. The first
// photo ever added automatically becomes the main profilePhoto too.
exports.uploadPhoto = async (req, res, next) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const ext = ALLOWED_MIME[mimeType];
    if (!imageBase64 || !ext) {
      return res.status(422).json({ success: false, message: 'imageBase64 and a valid mimeType (jpeg/png/webp) are required.' });
    }
    if (imageBase64.length > 8_000_000) {
      return res.status(413).json({ success: false, message: 'Image is too large.' });
    }

    const userDir = path.join(UPLOADS_DIR, String(req.user._id));
    fs.mkdirSync(userDir, { recursive: true });

    const filename = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(userDir, filename), Buffer.from(imageBase64, 'base64'));

    const publicUrl = `/uploads/${req.user._id}/${filename}`;

    const user = await User.findById(req.user._id);
    user.photos.push(publicUrl);
    if (!user.profilePhoto) user.profilePhoto = publicUrl;
    await user.save();

    const obj = user.toObject();
    obj.profileCompletion = calcProfileCompletion(user);
    res.json({ success: true, user: obj });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/photos   (protected)   body: { url }
exports.deletePhoto = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(422).json({ success: false, message: 'url is required.' });

    const user = await User.findById(req.user._id);
    user.photos = (user.photos || []).filter((p) => p !== url);
    if (user.profilePhoto === url) {
      user.profilePhoto = user.photos[0] || '';
    }
    await user.save();

    // Best-effort file cleanup — never fail the request over this.
    try {
      const filePath = path.join(UPLOADS_DIR, url.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}

    const obj = user.toObject();
    obj.profileCompletion = calcProfileCompletion(user);
    res.json({ success: true, user: obj });
  } catch (err) {
    next(err);
  }
};

exports.updateProfilePhoto = async (req, res, next) => {
  try {
    const { profilePhoto } = req.body;

    if (!profilePhoto) {
      return res.status(400).json({
        success: false,
        message: "Profile photo URL is required",
      });
    }

    if (
      !profilePhoto.startsWith(
        "https://res.cloudinary.com/"
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Cloudinary image URL",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        profilePhoto,
      },
      {
        new: true,
      }
    ).select(
      "_id fullName username profilePhoto followers following"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile photo updated",
      user,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/blocked   (protected)
exports.getBlockedUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('blockedUsers', 'fullName username profilePhoto country');
    const blocked = (user.blockedUsers || []).map((u) => ({
      id: u._id,
      name: u.fullName || u.username || 'AKORA user',
      avatar: u.profilePhoto || '',
      country: u.country || '',
    }));
    res.json({ success: true, blockedUsers: blocked });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/block/:id   (protected)
exports.blockUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === String(req.user._id)) {
      return res.status(422).json({ success: false, message: "You can't block yourself." });
    }
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { blockedUsers: targetId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/block/:id   (protected)
exports.unblockUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/push-token   (protected)   body: { token }
exports.registerPushToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(422).json({ success: false, message: 'token is required.' });
    await User.findByIdAndUpdate(req.user._id, { pushToken: token });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};