const twilio = require('twilio');
const logger = require('../utils/logger');

let client = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  logger.warn('Twilio credentials missing — OTP will run in DEV MODE (any 6-digit code accepted).');
}

const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

module.exports = { client, verifyServiceSid };
