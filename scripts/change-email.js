const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const mongoose = require('mongoose');
const crypto = require('crypto');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

async function changeAccountEmail() {
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
      sessionVersion: { type: Number, default: 0 },
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
    const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

    console.log('\n===================================================================');
    console.log('                 STOCKPILOT - CHANGE ACCOUNT EMAIL');
    console.log('===================================================================');

    const users = await User.find({}).sort({ role: 1, createdAt: 1 }).lean();

    if (!users || users.length === 0) {
      console.log('\n[!] No accounts found in the database.\n');
      await mongoose.connection.close();
      return;
    }

    console.log('\nSelect an account whose email you want to update:\n');
    users.forEach((u, idx) => {
      const roleBadge = u.role === 'OWNER' ? '[👑 ADMIN]' : `[${u.role}]`;
      console.log(`  [${idx + 1}] ${roleBadge.padEnd(11)} ${u.fullName} <${u.email}>`);
    });

    console.log('\n(Type "cancel" at any prompt to abort)');
    console.log('-------------------------------------------------------------------');

    const choice = await askQuestion('\nEnter account number (1-' + users.length + '): ');
    if (choice.toLowerCase() === 'cancel') {
      console.log('\nOperation canceled by user.');
      await mongoose.connection.close();
      return;
    }

    const idx = parseInt(choice, 10) - 1;
    let targetUser = null;
    if (idx >= 0 && idx < users.length) {
      targetUser = users[idx];
    } else {
      targetUser = users.find((u) => u.email.toLowerCase() === choice.toLowerCase());
    }

    if (!targetUser) {
      console.log('\n[ERROR] Invalid account selection. Aborted.');
      await mongoose.connection.close();
      return;
    }

    console.log(`\nSelected Account: ${targetUser.fullName} (${targetUser.role})`);
    console.log(`Current Email:    ${targetUser.email}`);

    const newEmail = await askQuestion('\nEnter new email address: ');
    if (newEmail.toLowerCase() === 'cancel') {
      console.log('\nOperation canceled by user.');
      await mongoose.connection.close();
      return;
    }

    const normalizedEmail = newEmail.toLowerCase().trim();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      console.log('\n[ERROR] Invalid email address format. Example: user@example.com. Aborted.');
      await mongoose.connection.close();
      return;
    }

    if (normalizedEmail === targetUser.email.toLowerCase()) {
      console.log('\n[!] The new email is identical to the current email. No changes needed.');
      await mongoose.connection.close();
      return;
    }

    // Check if new email is already in use by another user
    const existing = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: targetUser._id },
    }).select('_id fullName').lean();

    if (existing) {
      console.log(`\n[ERROR] The email "${normalizedEmail}" is already registered to "${existing.fullName}". Aborted.`);
      await mongoose.connection.close();
      return;
    }

    // Update in database
    console.log('\n[*] Updating email in database...');
    await User.updateOne(
      { _id: String(targetUser._id) },
      {
        $set: { email: normalizedEmail },
        $inc: { sessionVersion: 1 },
      }
    );

    // Audit log
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: String(targetUser._id),
      action: 'USER_EMAIL_CHANGED_CLI',
      entityType: 'User',
      entityId: String(targetUser._id),
      metadata: {
        oldEmail: targetUser.email,
        newEmail: normalizedEmail,
        role: targetUser.role,
        via: 'app-start.bat',
      },
    }).catch(() => null);

    console.log('\n===================================================================');
    console.log(' [SUCCESS] Email successfully updated!');
    console.log(` Account:   ${targetUser.fullName} (${targetUser.role})`);
    console.log(` Old Email: ${targetUser.email}`);
    console.log(` New Email: ${normalizedEmail}`);
    console.log(' Password remains unchanged. Please sign in with the new email.');
    console.log('===================================================================\n');

    await mongoose.connection.close();
  } catch (err) {
    console.error('\n[ERROR] Failed to update email:', err.message || err);
    process.exit(1);
  }
}

changeAccountEmail();
