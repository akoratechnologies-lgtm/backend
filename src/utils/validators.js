const { body, validationResult } = require('express-validator');

const registerRules = [
  body('fullName').trim().isLength({ min: 2, max: 60 }).escape(),
  body('username').trim().isAlphanumeric().isLength({ min: 3, max: 20 }),
  body('email').isEmail().normalizeEmail(),
  body('mobileNumber').isMobilePhone('any'),
  body('country').notEmpty(),
  body('state').notEmpty(),
  body('gender').isIn(['male', 'female', 'other']),
  body('dateOfBirth').isISO8601().toDate(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .withMessage('Password must be 8+ chars with upper, lower and a number'),
];

const loginRules = [
  body('emailOrMobile').notEmpty(),
  body('password').notEmpty(),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
}

module.exports = { registerRules, loginRules, validate };
