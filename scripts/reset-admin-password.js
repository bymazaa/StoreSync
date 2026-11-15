const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function resetAdminPassword() {
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
      passwordHash: String,
      sessionVersion: { type: Number, default: 0 },
    }, { timestamps: true });

    const sessionSchema = new mongoose.Schema({
      _id: { type: String },
      userId: String,
      revokedAt: Date,
    }, { timestamps: true });

    const auditLogSchema = new mongoose.Schema({
      _id: { type: String, required: true },
      actorId: String,
      action: String,
      entityType: String,
      entityId: String,
      metadata: mongoose.Schema.Types.Mixed,
    }, { timestamps: true });

    const User = mongoose.models.User || mongoose.model('User', userSchema);
    const RefreshSession = mongoose.models.RefreshSession || mongoose.model('RefreshSession', sessionSchema);
    const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

    console.log('\n===================================================================');
    console.log('                 STOCKPILOT - RESET ADMIN PASSWORD');
    console.log('===================================================================');

    const owners = await User.find({ role: 'OWNER' }).lean();

    if (!owners || owners.length === 0) {
      console.log('\n[!] No OWNER account found in the database. Please complete initial setup first.\n');
      await mongoose.connection.close();
      return;
    }

    let targetOwner = null;
    if (owners.length === 1) {
      targetOwner = owners[0];
      console.log(`\nTarget Admin Found:`);
      console.log(`- Full Name: ${targetOwner.fullName}`);
      console.log(`- Email:     ${targetOwner.email}`);
    } else {
      console.log('\nMultiple OWNER accounts detected:');
      owners.forEach((o, i) => console.log(`  [${i + 1}] ${o.fullName} <${o.email}>`));
      const choice = await askQuestion('\nSelect account number (or type email): ');
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < owners.length) {
        targetOwner = owners[idx];
      } else {
        targetOwner = owners.find((o) => o.email.toLowerCase() === choice.toLowerCase());
      }
      if (!targetOwner) {
        console.log('[ERROR] Invalid selection. Aborted.');
        await mongoose.connection.close();
        return;
      }
    }

    console.log('\n-------------------------------------------------------------------');
    console.log('Note: Password must be at least 12 characters long.');
    console.log('(Type "cancel" at any prompt to abort)');
    console.log('-------------------------------------------------------------------');

    const newPassword = await askQuestion('\nEnter new password: ');
    if (newPassword.toLowerCase() === 'cancel') {
      console.log('\nOperation canceled by user.');
      await mongoose.connection.close();
      return;
    }

    if (newPassword.length < 12) {
      console.log('\n[ERROR] Password must be at least 12 characters long for security. Aborted.');
      await mongoose.connection.close();
      return;
    }

    const confirmPassword = await askQuestion('Confirm new password: ');
    if (confirmPassword !== newPassword) {
      console.log('\n[ERROR] Passwords do not match. Aborted.');
      await mongoose.connection.close();
      return;
    }

    console.log('\n[*] Encrypting password with bcrypt...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    console.log('[*] Updating admin record in database...');
    await User.updateOne(
      { _id: String(targetOwner._id) },
      {
        $set: { passwordHash, isActive: true },
        $inc: { sessionVersion: 1 },
      }
    );

    console.log('[*] Revoking all active browser sessions...');
    await RefreshSession.updateMany(
      { userId: String(targetOwner._id), revokedAt: null },
      { revokedAt: new Date() }
    ).catch(() => null);

    const crypto = require('crypto');
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: String(targetOwner._id),
      action: 'ADMIN_PASSWORD_RESET_CLI',
      entityType: 'User',
      entityId: String(targetOwner._id),
      metadata: { email: targetOwner.email, via: 'app-start.bat' },
    }).catch(() => null);

    console.log('\n===================================================================');
    console.log(' [SUCCESS] Admin password was successfully changed!');
    console.log(` Account: ${targetOwner.email}`);
    console.log(' You can now log into StockPilot with this new password.');
    console.log('===================================================================\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('\n[ERROR] Password reset failed:', err.message || err);
    process.exit(1);
  }
}

resetAdminPassword();
