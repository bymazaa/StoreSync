import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';
import { UserRole } from '@/types';

export interface ILoginHistoryItem {
  _id?: string;
  id?: string;
  timestamp: Date;
  ip: string;
  device: string;
  location?: string;
  userAgent?: string;
}

export interface IUser {
  _id: string;
  id?: string;
  fullName: string;
  email: string;
  phoneE164?: string | null;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  sessionVersion: number;
  lastLoginAt?: Date | null;
  loginHistory?: ILoginHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneE164: {
      type: String,
      default: null,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(UserRole),
      default: UserRole.CASHIER,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    sessionVersion: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    loginHistory: {
      type: [
        new Schema(
          {
            _id: { type: String, default: () => randomUUID() },
            timestamp: { type: Date, required: true, default: () => new Date() },
            ip: { type: String, required: true, default: 'unknown' },
            device: { type: String, required: true, default: 'Unknown Device' },
            location: { type: String, default: 'Unknown Location' },
            userAgent: { type: String, default: '' },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  }
);

UserSchema.index({ role: 1, isActive: 1 });

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
