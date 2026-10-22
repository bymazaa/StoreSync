import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface IRefreshSession {
  _id: string;
  id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
}

const RefreshSessionSchema = new Schema<IRefreshSession>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: false,
    },
  }
);

RefreshSessionSchema.index({ userId: 1, expiresAt: 1 });

const RefreshSession = mongoose.models.RefreshSession || mongoose.model<IRefreshSession>('RefreshSession', RefreshSessionSchema);

export default RefreshSession;
