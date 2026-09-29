const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

(async () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
  await connectDB();
  await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase() },
    {
      $set: { role: 'admin', name: 'Admin' },
      $setOnInsert: { phone: '08000000000', password: await bcrypt.hash(ADMIN_PASSWORD, 12) },
    },
    { upsert: true }
  );
  console.log(`Admin ready: ${ADMIN_EMAIL}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
