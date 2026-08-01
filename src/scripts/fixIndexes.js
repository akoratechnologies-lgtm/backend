// One-time fix: the `username` and `email` fields on User are declared as
// `sparse: true, unique: true` in the schema, but the indexes actually sitting
// in MongoDB were created before that (or without the option) as plain unique
// indexes. A plain unique index treats every missing field as `null` and
// rejects the second document that has it — which is exactly the
// "E11000 duplicate key ... dup key: { username: null }" error you saw on
// verify-otp, since every brand-new OTP signup has no username/email yet.
//
// This script drops the old indexes and lets Mongoose recreate them correctly
// as sparse (so multiple documents can have username/email unset).
//
// Run once from the backend folder:
//   node src/scripts/fixIndexes.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const collection = User.collection;

  // Step 1: sparse indexes only skip documents where the field is entirely
  // ABSENT — a document with the field explicitly set to `null` still gets
  // indexed and will collide. Clean those up first.
  const unsetUsername = await collection.updateMany(
    { username: null },
    { $unset: { username: '' } }
  );
  const unsetEmail = await collection.updateMany(
    { email: null },
    { $unset: { email: '' } }
  );
  console.log(`Unset username on ${unsetUsername.modifiedCount} doc(s)`);
  console.log(`Unset email on ${unsetEmail.modifiedCount} doc(s)`);

  // Step 2: rebuild the indexes as sparse so this can't happen again.
  const existing = await collection.indexes();
  console.log('Existing indexes:', existing.map((i) => i.name));

  for (const name of ['username_1', 'email_1']) {
    const found = existing.find((i) => i.name === name);
    if (found) {
      if (found.sparse) {
        console.log(`${name} is already sparse — skipping drop`);
        continue;
      }
      await collection.dropIndex(name);
      console.log(`Dropped non-sparse index: ${name}`);
    }
  }

  await collection.createIndex({ username: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ email: 1 }, { unique: true, sparse: true });
  console.log('Recreated username_1 and email_1 as sparse unique indexes');

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Failed to fix indexes:', err);
  process.exit(1);
});