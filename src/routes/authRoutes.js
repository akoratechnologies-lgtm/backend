const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { otpLimiter, authLimiter } = require('../middleware/rateLimiter');

// --- OTP-first flow (regular users) ---
router.post('/send-otp', otpLimiter, authController.sendOtp);
router.post('/resend-otp', otpLimiter, authController.resendOtp);
router.post('/verify-otp', authLimiter, authController.verifyOtp);

// --- Password-based login (admins/staff only — accounts with a password set) ---
router.post('/login', authLimiter, authController.login);

router.post('/google', authController.socialLogin);
router.post('/apple', authController.socialLogin);

router.post('/refresh', authController.refresh);
router.post('/logout', protect, authController.logout);
router.post(
  "/admin/login",
  authLimiter,
  authController.adminLogin
);

module.exports = router;
