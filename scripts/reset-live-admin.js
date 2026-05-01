const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

// ─── SET YOUR LIVE ATLAS URL HERE ───────────────────────────────────────────
const MONGODB_URL = 'mongodb+srv://bharatgodamtechsolutions_db_user:YOUR_PASSWORD@cluster0.qpdiozf.mongodb.net/?retryWrites=true&w=majority';
const MONGODB_DB  = 'bharatgodam_db';

// ─── SET YOUR LOGIN CREDENTIALS ─────────────────────────────────────────────
const ADMIN_EMAIL    = 'shrutimehata.01@gmail.com'; // ← your email
const ADMIN_PASSWORD = '123456';                     // ← your password
// ────────────────────────────────────────────────────────────────────────────

async function resetAdminUser() {
  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  console.log('✅ Connected to Atlas');

  const db = client.db(MONGODB_DB);
  const users = db.collection('users');

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const result = await users.updateOne(
    { email: ADMIN_EMAIL },
    {
      $set: {
        password: hashedPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
        updatedAt: new Date(),
      }
    },
    { upsert: true } // creates user if not found
  );

  if (result.upsertedCount > 0) {
    console.log(`✅ Created new admin user: ${ADMIN_EMAIL}`);
  } else {
    console.log(`✅ Reset password for: ${ADMIN_EMAIL}`);
  }

  console.log(`\n🎉 Done! Login with:`);
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);

  await client.close();
}

resetAdminUser().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
