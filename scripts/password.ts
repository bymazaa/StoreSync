import mongoose from 'mongoose';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE any imports
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { User, RefreshSession, AuditLog } from '../src/models';
import { UserRole } from '../src/types';

const MIN_LENGTH = 12;

/**
 * The break-glass path when nobody can sign in. Settings cannot rescue an owner account: that route
 * refuses self-edits and refuses every OWNER row, so this script is the only way back inside.
 */
async function changePassword() {
  const email = process.argv[2];
  if (!email || email.startsWith('-')) throw new Error('Usage: pnpm db:password <account-email>');

  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) throw new Error('MONGODB_URI environment variable is not set. Please check your .env file.');

  await mongoose.connect(mongodbUri, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  const user = await User.findOne({ email: email.trim().toLowerCase() })
    .select('fullName email role isActive sessionVersion')
    .lean();
  if (!user) {
    const accounts = await User.find({}).select('email role').lean();
    console.log('\n📋 Sign-in emails on file:');
    for (const account of accounts) console.log(`   ${account.role.padEnd(12)} ${account.email}`);
    throw new Error(`No account uses ${email}. Nothing was changed.`);
  }

  const password = await askPassword(`\nNew password for ${user.fullName} <${user.email}>: `);
  if (password.length < MIN_LENGTH) throw new Error(`The password must be at least ${MIN_LENGTH} characters. Nothing was changed.`);
  if (password !== await askPassword('Repeat it: ')) throw new Error('The two entries did not match. Nothing was changed.');

  await User.findByIdAndUpdate(user._id, { passwordHash: await hash(password, 12), sessionVersion: user.sessionVersion + 1 });
  const revoked = await RefreshSession.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  await AuditLog.create({
    _id: randomUUID(),
    actorId: user._id, action: 'auth.password_reset', entityType: 'user', entityId: user._id,
    metadata: { via: 'script' },
  });

  console.log(`\n✅ Password changed for ${user.fullName} (${user.role}).`);
  console.log(`   ${revoked.modifiedCount} saved session(s) signed out — they must sign in again with the new password.`);
  if (!user.isActive) console.log('   ⚠️  This account is still DISABLED, so it cannot sign in yet. Enable it from Settings → Staff accounts.');
  if (user.role === UserRole.OWNER) console.log('   ⚠️  Owner accounts cannot be reset from inside the app — keep this password written down outside StockPilot as well.');

  process.exit(0);
}

let pipedLines: string[] | null = null;

/** Reads the whole piped input once, then hands out one line per prompt. */
async function nextPipedLine(): Promise<string> {
  if (!pipedLines) {
    const input = await new Promise<string>((resolve) => {
      let collected = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk: string) => { collected += chunk; });
      process.stdin.once('end', () => resolve(collected));
    });
    pipedLines = input.split(/\r?\n/);
  }
  return (pipedLines.shift() ?? '').trimEnd();
}

/**
 * Shows a star per character so the new password stays out of shell history and `ps` output.
 * Without a terminal (`docker compose exec -T`) the whole input is read once and handed out line by line.
 */
function askPassword(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(question);
    return nextPipedLine();
  }

  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    let value = '';
    let skipKeySequence = 0;
    const stop = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (skipKeySequence > 0) { skipKeySequence -= 1; continue; }
        if (character === '\u001b') { skipKeySequence = 2; continue; }
        if (character === '\u0003') { stop(); process.stdout.write('\n'); reject(new Error('Cancelled.')); return; }
        if (character === '\r' || character === '\n') { stop(); process.stdout.write('\n'); resolve(value); return; }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
          continue;
        }
        if (character < ' ') continue;
        value += character;
        process.stdout.write('*');
      }
    };
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.on('data', onData);
  });
}

changePassword().catch(async (error) => {
  console.error('❌ Password change failed:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
