const twilio = require('twilio');
const logger = require('./logger');

// NOTE: Swap this out for MSG91 / Firebase Phone Auth / any SMS provider you use in production.
// Twilio Verify is used here because it handles OTP generation, expiry and rate limiting for you.

let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendOtp(mobileNumber) {
  if (!client) {
    logger.warn('Twilio not configured - OTP not actually sent (dev mode)');
    return { status: 'pending', dev: true };
  }
  const verification = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({ to: mobileNumber, channel: 'sms' });
  return verification;
}

async function checkOtp(mobileNumber, code) {
  if (!client) {
    // DEV ONLY fallback so you can test the flow locally without Twilio creds.
    logger.warn('Twilio not configured - accepting any 6-digit code in dev mode');
    return /^\d{6}$/.test(code);
  }
  const check = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: mobileNumber, code });
  return check.status === 'approved';
}

module.exports = { sendOtp, checkOtp };
