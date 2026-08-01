/**
 * Creates a real, password-protected admin account in MongoDB.
 * This replaces any hardcoded admin email/password in source code.
 *
 * Usage:
 *   node src/scripts/createAdmin.js "Admin Name" admin@example.com StrongPass123!
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const [, , fullName, email, password] = process.argv;
  if (!fullName || !email || !password) {
    console.log('Usage: node src/scripts/createAdmin.js "<Full Name>" <email> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.log('Password must be at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    existing.password = password; // will be re-hashed by the pre-save hook
    await existing.save();
    console.log(`✅ Existing user ${email} promoted to admin with a new password.`);
  } else {
    await User.create({
      fullName,
      email,
      password,
      role: 'admin',
      mobileNumber: `admin-${Date.now()}`, // placeholder — admins don't need a real mobile number
      isEmailVerified: true,
      isProfileComplete: true,
    });
    console.log(`✅ Admin account created: ${email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
