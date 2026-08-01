const rateLimit = require('express-rate-limit');

// Prevents abuse of Twilio SMS sending (each OTP costs money) — 5 requests per
// 10 minutes per IP, keyed additionally by mobile number where possible.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please wait a few minutes and try again.' },
});

// General auth endpoints (verify/login/refresh) — brute-force protection
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please slow down.' },
});

module.exports = { otpLimiter, authLimiter };
