const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const mongoose = require('mongoose');

async function viewAccounts() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[ERROR] MONGODB_URI is not set in your .env file!');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });

    const userSchema = new mongoose.Schema({
      _id: { type: String, required: true },
      fullName: String,
      email: String,
      role: String,
      isActive: Boolean,
      createdAt: Date,
      updatedAt: Date,
    }, { timestamps: true });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    const users = await User.find({}).sort({ role: 1, createdAt: 1 }).lean();

    console.log('\n===================================================================');
    console.log('                 STOCKPILOT ACCOUNTS DIRECTORY (READ-ONLY)');
    console.log('===================================================================');

    if (!users || users.length === 0) {
      console.log('\n[!] No accounts found in the database. Run setup first.\n');
      await mongoose.connection.close();
      return;
    }

    const owners = users.filter((u) => u.role === 'OWNER');
    const staff = users.filter((u) => u.role !== 'OWNER');

    console.log('\n[👑 ADMIN / OWNER ACCOUNTS]');
    if (owners.length === 0) {
      console.log('  None found!');
    } else {
      owners.forEach((owner, idx) => {
        const created = owner.createdAt ? new Date(owner.createdAt).toLocaleString() : 'N/A';
        const status = owner.isActive ? 'ACTIVE' : 'DISABLED';
        console.log(`  ${idx + 1}. Full Name:  ${owner.fullName}`);
        console.log(`     Email:      ${owner.email}`);
        console.log(`     Role:       OWNER (Full Admin Access)`);
        console.log(`     Status:     ${status}`);
        console.log(`     Created:    ${created}`);
        console.log('     ----------------------------------------------------------');
      });
    }

    console.log('\n[👥 STAFF ACCOUNTS (Under Admin Management)]');
    if (staff.length === 0) {
      console.log('  No staff accounts created yet.');
    } else {
      console.log('  -----------------------------------------------------------------');
      console.log('  #   ROLE         STATUS     FULL NAME             EMAIL');
      console.log('  -----------------------------------------------------------------');
      staff.forEach((u, idx) => {
        const num = String(idx + 1).padEnd(3);
        const role = String(u.role).padEnd(12);
        const status = (u.isActive ? 'Active' : 'Disabled').padEnd(10);
        const name = String(u.fullName || '').slice(0, 20).padEnd(21);
        const email = String(u.email || '');
        console.log(`  ${num} ${role} ${status} ${name} ${email}`);
      });
      console.log('  -----------------------------------------------------------------');
    }

    console.log(`\nSummary: Total ${users.length} account(s) on file (${owners.length} Owner, ${staff.length} Staff).`);
    console.log('===================================================================\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('\n[ERROR] Failed to fetch accounts:', err.message || err);
    process.exit(1);
  }
}

viewAccounts();
