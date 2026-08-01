const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Razorpay's SDK (and some other libraries) reject with a plain object
  // like { statusCode, error: { code, description } } instead of a real
  // Error — that has neither .message nor .stack, which is exactly why
  // this used to log "undefined" and hide the real problem. Log the whole
  // thing so nothing gets swallowed again.
  logger.error(err.stack || err.message || JSON.stringify(err));

  const razorpayMessage = err?.error?.description;
  const statusCode = err.statusCode || 500;
  const rawMessage = razorpayMessage || err.message || 'Something went wrong.';

  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Something went wrong. Please try again.'
      : rawMessage;

  res.status(statusCode).json({ success: false, message });
}

module.exports = errorHandler;