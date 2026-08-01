const Report = require('../models/Report');
const User = require('../models/User');

// POST /api/reports   (protected)   body: { reportedUserId, reason }
exports.createReport = async (req, res, next) => {
  try {
    const { reportedUserId, reason } = req.body;
    if (!reportedUserId || !reason) {
      return res.status(422).json({ success: false, message: 'reportedUserId and reason are required.' });
    }

    const target = await User.findById(reportedUserId);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });

    const report = await Report.create({ reporter: req.user._id, reportedUser: reportedUserId, reason });
    res.status(201).json({ success: true, report });
  } catch (err) {
    next(err);
  }
};