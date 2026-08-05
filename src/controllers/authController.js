// PLACE AT: backend/src/controllers/authController.js
// IMPORTANT: replace your ENTIRE file with this — don't hand-copy just the
// bottom function. The line that was missing before is right here at the top:
//     const admin = require('../config/firebaseAdmin');
// Without it, `admin` inside socialLogin is undefined and the whole export
// can end up broken depending on how it was pasted in.

const User = require('../models/User');
const { client: twilioClient, verifyServiceSid } = require('../config/twilio');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const logger = require('../utils/logger');
const bcrypt = require("bcrypt");
const admin = require('../config/firebaseAdmin'); // <-- THIS was missing

// --- E.164 phone format check (+countrycode + number, e.g. +919876543210) ---
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function isValidE164(number) {
  return typeof number === 'string' && E164_REGEX.test(number);
}

// ============================================================
// POST /api/auth/send-otp   { mobileNumber: "+919876543210" }
// ============================================================
exports.sendOtp = async (req, res, next) => {
  try {
    console.log("Body:", req.body);
    console.log("Phone:", req.body.mobileNumber);
    console.log("Twilio Client:", !!twilioClient);
    console.log("Verify SID:", verifyServiceSid);

    
    const { mobileNumber } = req.body;

    if (!isValidE164(mobileNumber)) {
      return res.status(422).json({
        success: false,
        message: 'Enter a valid mobile number in international format, e.g. +919876543210',
      });
    }

    if (!twilioClient) {
      logger.warn(`[DEV MODE] OTP not actually sent to ${mobileNumber}. Use code 123456 to verify.`);
      return res.json({ success: true, message: 'OTP sent (dev mode)', devMode: true });
    }

    await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: mobileNumber, channel: 'sms' });

    return res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
  console.log(err);
  console.log(err.code);
  console.log(err.message);
  console.log(err.status);

  return res.status(400).json({
    success: false,
    error: err.message,
    code: err.code,
  });
}
};

// ============================================================
// POST /api/auth/resend-otp   { mobileNumber }
// Same as send-otp, kept as a separate route so the frontend can label/track
// it distinctly (e.g. disable "Resend" button with a cooldown timer).
// ============================================================
exports.resendOtp = exports.sendOtp;

// ============================================================
// POST /api/auth/verify-otp   { mobileNumber, code }
// Auto-registers a new user OR logs in an existing one.
// ============================================================
exports.verifyOtp = async (req, res, next) => {
  try {
    const { mobileNumber, code } = req.body;

    if (!isValidE164(mobileNumber) || !code) {
      return res.status(422).json({ success: false, message: 'Mobile number and OTP code are required' });
    }

    let isValid;
    if (!twilioClient) {
      // DEV MODE fallback only — never enabled in production because
      // TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are always set there.
      isValid = code === '123456';
    } else {
      const check = await twilioClient.verify.v2
        .services(verifyServiceSid)
        .verificationChecks.create({ to: mobileNumber, code });
      isValid = check.status === 'approved';
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // OTP correct — find existing user or create a brand-new one (auto signup)
    // NOTE: refreshTokens is `select: false` on the schema, so it must be
    // explicitly selected here or `user.refreshTokens` is undefined below.
    let user = await User.findOne({ mobileNumber }).select('+refreshTokens');
    let isNewUser = false;

    if (!user) {
      user = await User.create({ mobileNumber, isMobileVerified: true });
      isNewUser = true;
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'This account has been banned.' });
    }

    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id });

    user.refreshTokens.push(refreshToken);
    user.isOnline = true;
    user.lastSeen = new Date();
    user.loginHistory.push({ ip: req.ip, device: req.headers['user-agent'] });
    await user.save();

    return res.json({
      success: true,
      isNewUser,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        mobileNumber: user.mobileNumber,
        fullName: user.fullName,
        username: user.username,
        isProfileComplete: user.isProfileComplete,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/auth/login   { emailOrMobile, password }
// Password-based login — used ONLY by accounts that have a password set
// (admins/staff). Regular users never set a password and can't use this route.
// ============================================================
exports.login = async (req, res, next) => {
  try {
    const { emailOrMobile, password } = req.body;
    if (!emailOrMobile || !password) {
      return res.status(422).json({ success: false, message: 'Email/mobile and password are required' });
    }

    const user = await User.findOne({
      $or: [{ email: emailOrMobile }, { mobileNumber: emailOrMobile }, { username: emailOrMobile }],
    }).select('+password +refreshTokens');

    // Generic message — don't reveal whether the account exists, has no
    // password set, or the password was simply wrong (anti-enumeration).
    if (!user || !user.password || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.isBanned) return res.status(403).json({ success: false, message: 'Account banned' });
    if (user.isSuspended) return res.status(403).json({ success: false, message: 'Account suspended' });

    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id });

    user.refreshTokens.push(refreshToken);
    user.isOnline = true;
    user.loginHistory.push({ ip: req.ip, device: req.headers['user-agent'] });
    await user.save();

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};



// POST /api/auth/admin/login
exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Hardcoded admin credentials (DEV ONLY)
    if (email !== "admin@gmail.com" || password !== "123456") {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials",
      });
    }

    // Find admin in DB
    let user = await User.findOne({
      email: "admin@gmail.com",
      role: "admin",
    }).select("+refreshTokens");

    // If admin doesn't exist, create it
    if (!user) {
      const hashedPassword = await bcrypt.hash("123456", 10);

      user = await User.create({
        fullName: "Super Admin",
        email: "admin@gmail.com",
        password: hashedPassword,
        role: "admin",
        isMobileVerified: true,
      });
    }

    const accessToken = signAccessToken({
      id: user._id,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      id: user._id,
    });

    user.refreshTokens.push(refreshToken);
    user.isOnline = true;
    user.lastSeen = new Date();

    await user.save();

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/auth/refresh   { refreshToken }
// ============================================================
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token required' });

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id).select('+refreshTokens');

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const newAccessToken = signAccessToken({ id: user._id, role: user.role });
    return res.json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// ============================================================
// POST /api/auth/logout   (protected)   { refreshToken }
// ============================================================
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const user = await User.findById(req.user._id).select('+refreshTokens');
    user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== refreshToken);
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();
    return res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/auth/social-login   { idToken }
// idToken = the Firebase ID token the app gets back after the user signs in
// with Google or Apple via @react-native-firebase/auth on the client.
//
// This does NOT switch your app over to Firebase sessions — it just uses
// Firebase as a one-time identity check, then issues the SAME
// accessToken/refreshToken pair (via your existing signAccessToken /
// signRefreshToken) that /verify-otp issues. Everything downstream — the
// api.ts interceptor, the socket auth, the refresh flow, req.user in
// `protect` — keeps working exactly as it already does, no matter which
// method the user signed in with.
// ============================================================
exports.socialLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(422).json({ success: false, message: 'idToken is required' });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      console.log('[socialLogin] token verify failed:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token' });
    }

    const { uid, email, name, phone_number, picture, firebase } = decoded;
    const provider = firebase?.sign_in_provider || 'unknown'; // "google.com" | "apple.com"

    // Match by firebaseUid first; fall back to email so someone who signed
    // up earlier via OTP and later taps "Continue with Google" using the
    // same email gets linked to their existing account instead of a duplicate.
    let user = await User.findOne({
      $or: [{ firebaseUid: uid }, ...(email ? [{ email }] : [])],
    }).select('+refreshTokens');
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        authProvider: provider,
        email: email || undefined,
        mobileNumber: phone_number || undefined,
        fullName: name || '',
        profilePhoto: picture || '',
        isMobileVerified: !!phone_number,
        isEmailVerified: !!email,
      });
      isNewUser = true;
    } else if (!user.firebaseUid) {
      user.firebaseUid = uid;
      user.authProvider = provider;
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'This account has been banned.' });
    }

    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id });

    user.refreshTokens.push(refreshToken);
    user.isOnline = true;
    user.lastSeen = new Date();
    user.loginHistory.push({ ip: req.ip, device: req.headers['user-agent'] });
    await user.save();

    return res.json({
      success: true,
      isNewUser,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        mobileNumber: user.mobileNumber,
        fullName: user.fullName,
        username: user.username,
        isProfileComplete: user.isProfileComplete,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};