const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // --- Required at OTP signup time ---
    mobileNumber: { type: String, required: true, unique: true, trim: true, index: true , required:function () {
      return this.role !== "admin" ;
    } },
    isMobileVerified: { type: Boolean, default: true }, // true because they only exist after OTP success

    // --- Filled in later via "Complete Profile" (all optional at creation) ---
    fullName: { type: String, trim: true, maxlength: 60, default: '' },
    username: {
      type: String, trim: true, lowercase: true, sparse: true, unique: true,
      // sparse+unique lets multiple docs have username: undefined without collisions
    },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    country: { type: String, default: '' },
    state: { type: String, default: '' },
    city: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
    dateOfBirth: { type: Date, default: null },
    profilePhoto: { type: String, default: '' },
    isProfileComplete: { type: Boolean, default: false },

    // --- Password is OPTIONAL: only used for admin/staff accounts that log in
    // with email+password. Regular users authenticate purely via mobile OTP. ---
    password: { type: String, minlength: 8, select: false, default: undefined },

    isEmailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },

    isPremium: { type: Boolean, default: false },
    premiumPlan: { type: String, default: 'none' }, // matches SubscriptionPlan.slug, admin-defined
    premiumExpiresAt: { type: Date, default: null },

    isBanned: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    banReason: { type: String, default: '' },

    bio: { type: String, maxlength: 300, default: '' },
    interests: [{ type: String }],
    languages: [{ type: String }],

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    privacy: {
      whoCanMessage: { type: String, enum: ['everyone', 'friends', 'nobody'], default: 'everyone' },
      whoCanCall: { type: String, enum: ['everyone', 'friends', 'nobody'], default: 'everyone' },
      hideOnlineStatus: { type: Boolean, default: false },
      hideLastSeen: { type: Boolean, default: false },
      privateAccount: { type: Boolean, default: false },
    },

    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    // Photo grid shown on the profile editor (in addition to profilePhoto,
    // which is always photos[0] once at least one photo exists).
    photos: [{ type: String }],

    notificationPrefs: {
      push: { type: Boolean, default: true },
      marketing: { type: Boolean, default: true },
      onlineStatus: { type: Boolean, default: true },
      newFollowers: { type: Boolean, default: true },
    },
    hideGender: { type: Boolean, default: false },
    pushToken: { type: String, default: null }, // Expo push token, registered from the app after permission grant

    refreshTokens: [{ type: String, select: false }],

    loginHistory: [
      {
        ip: String,
        device: String,
        loggedInAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Only hash if a password was actually set (admin/staff accounts)
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isAdult = function isAdult() {
  if (!this.dateOfBirth) return false;
  const today = new Date();
  const age = today.getFullYear() - this.dateOfBirth.getFullYear();
  const m = today.getMonth() - this.dateOfBirth.getMonth();
  const has18thPassed = m > 0 || (m === 0 && today.getDate() >= this.dateOfBirth.getDate());
  return has18thPassed ? age >= 18 : age - 1 >= 18;
};

module.exports = mongoose.model('User', userSchema);