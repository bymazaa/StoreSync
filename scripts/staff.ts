import mongoose from 'mongoose';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline/promises';

// Load environment variables BEFORE any imports
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import {
  User, RefreshSession, AuditLog,
  Sale, SaleReturn, SalePayment, Purchase, PurchaseReturn, PurchasePayment, StockMovement, Expense,
} from '../src/models';
import type { IUser } from '../src/models/User';
import { UserRole } from '../src/types';
import { askPassword } from './ask-password';

const MIN_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = Object.values(UserRole).join(', ');

const USAGE = `Usage:
  pnpm db:staff list
  pnpm db:staff email <current-email> <new-email>
  pnpm db:staff add <"full name"> <email> <role>
  pnpm db:staff remove <email>

Roles: ${ROLES}`;

async function connect() {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) throw new Error('MONGODB_URI environment variable is not set. Please check your .env file.');
  await mongoose.connect(mongodbUri, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
}

async function audit(action: string, actorId: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await AuditLog.create({
    _id: randomUUID(),
    actorId, action, entityType: 'user', entityId,
    metadata: { ...metadata, via: 'script' },
  });
}

async function list() {
  const users = await User.find().select('fullName email role isActive').lean().sort({ createdAt: 1 }) as unknown as Pick<IUser, 'fullName' | 'email' | 'role' | 'isActive'>[];
  console.log('\nStaff accounts:');
  for (const user of users) {
    console.log(`   ${user.role.padEnd(12)} ${user.isActive ? '         ' : '(disabled) '}${user.fullName} <${user.email}>`);
  }
  console.log(`\n${users.length} account(s).`);
}

async function changeEmail(current: string, next: string) {
  const normalized = next.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) throw new Error(`"${next}" does not look like an email address. Nothing was changed.`);

  const user = await User.findOne({ email: current.trim().toLowerCase() }).select('_id fullName email role').lean() as unknown as Pick<IUser, '_id' | 'fullName' | 'email' | 'role'> | null;
  if (!user) throw new Error(`No account uses ${current}. Nothing was changed.`);

  const taken = await User.findOne({ email: normalized, _id: { $ne: user._id } }).select('_id').lean();
  if (taken) throw new Error(`Another account already uses ${normalized}. Nothing was changed.`);

  await User.findByIdAndUpdate(user._id, { email: normalized });
  await audit('user.updated', user._id, user._id, { changedFields: ['email'], oldEmail: user.email });
  console.log(`\n✅ Email changed for ${user.fullName} (${user.role}): ${user.email} -> ${normalized}`);
  console.log('   They keep using the same password. Existing sessions stay signed in.');
}

async function add(fullName: string, email: string, roleRaw: string) {
  const name = fullName.trim();
  const normalized = email.trim().toLowerCase();
  const role = roleRaw.trim().toUpperCase() as UserRole;
  if (!name) throw new Error('A full name is required. Nothing was changed.');
  if (!EMAIL_PATTERN.test(normalized)) throw new Error(`"${email}" does not look like an email address. Nothing was changed.`);
  if (!Object.values(UserRole).includes(role)) throw new Error(`Unknown role "${roleRaw}". Roles: ${ROLES}. Nothing was changed.`);
  if (role === UserRole.OWNER) throw new Error('The owner account is created once during setup and cannot be duplicated. Nothing was changed.');

  const taken = await User.findOne({ email: normalized }).select('_id').lean();
  if (taken) throw new Error(`Another account already uses ${normalized}. Nothing was changed.`);

  const password = await askPassword(`\nNew password for ${name} <${normalized}>: `);
  if (password.length < MIN_LENGTH) throw new Error(`The password must be at least ${MIN_LENGTH} characters. Nothing was changed.`);
  if (password !== await askPassword('Repeat it: ')) throw new Error('The two entries did not match. Nothing was changed.');

  const id = randomUUID();
  await User.create({
    _id: id, fullName: name, email: normalized,
    passwordHash: await hash(password, 12), role, isActive: true, sessionVersion: 0,
  });
  await audit('user.created', id, id, { fullName: name, role });
  console.log(`\n✅ Created ${role.toLowerCase().replace('_', ' ')} account: ${name} <${normalized}>`);
  console.log('   The account is active — they can sign in right away.');
}

async function remove(email: string) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('_id fullName email role').lean() as unknown as Pick<IUser, '_id' | 'fullName' | 'email' | 'role'> | null;
  if (!user) throw new Error(`No account uses ${email}. Nothing was changed.`);
  if (user.role === UserRole.OWNER) throw new Error('Owner accounts cannot be deleted. Nothing was changed.');

  // Same rule as the Settings page: an account that produced records is disabled, never deleted.
  const [sales, saleReturns, collections, purchases, purchaseReturns, supplierPayments, movements, expenses] = await Promise.all([
    Sale.countDocuments({ createdById: user._id }),
    SaleReturn.countDocuments({ createdById: user._id }),
    SalePayment.countDocuments({ collectedById: user._id }),
    Purchase.countDocuments({ createdById: user._id }),
    PurchaseReturn.countDocuments({ createdById: user._id }),
    PurchasePayment.countDocuments({ madeById: user._id }),
    StockMovement.countDocuments({ actorId: user._id }),
    Expense.countDocuments({ $or: [{ createdById: user._id }, { voidedById: user._id }] }),
  ]);
  const held: [string, number][] = [['sale', sales], ['customer return', saleReturns], ['payment collected', collections], ['purchase', purchases], ['supplier return', purchaseReturns], ['supplier payment', supplierPayments], ['stock movement', movements], ['expense', expenses]];
  const summary = held.filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}${count === 1 ? '' : 's'}`).join(', ');
  if (summary) throw new Error(`${user.fullName} already left records (${summary}). Disable the account in Settings instead, so those records keep their author.`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\nDelete ${user.fullName} <${user.email}>? This cannot be undone. Type YES to confirm: `)).trim();
  rl.close();
  if (answer !== 'YES') { console.log('Cancelled — nothing was deleted.'); return; }

  await User.findByIdAndDelete(user._id);
  await RefreshSession.deleteMany({ userId: user._id });
  await audit('user.deleted', user._id, user._id, { deletedAccount: `${user.fullName} <${user.email}>` });
  console.log(`\n✅ Deleted ${user.fullName} <${user.email}>.`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') { console.log(USAGE); return; }
  await connect();
  switch (command) {
    case 'list': await list(); break;
    case 'email': {
      const [current, next] = rest;
      if (!current || !next) throw new Error(`Usage: pnpm db:staff email <current-email> <new-email>`);
      await changeEmail(current, next);
      break;
    }
    case 'add': {
      const [name, email, role] = rest;
      if (!name || !email || !role) throw new Error(`Usage: pnpm db:staff add <"full name"> <email> <role>\nRoles: ${ROLES}`);
      await add(name, email, role);
      break;
    }
    case 'remove': {
      const [email] = rest;
      if (!email) throw new Error('Usage: pnpm db:staff remove <email>');
      await remove(email);
      break;
    }
    default: throw new Error(`Unknown command "${command}".\n${USAGE}`);
  }
}

main().then(() => {
  process.exit(0);
}).catch(async (error) => {
  console.error('❌ Failed:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
