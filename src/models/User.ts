import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';
import { UserRole } from '@/types';

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
