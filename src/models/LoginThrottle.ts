import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface ILoginThrottle {
  _id: string;
  id?: string;
  attempts: number;
  windowStartedAt: Date;
  blockedUntil?: Date | null;
  updatedAt: Date;
}

const LoginThrottleSchema = new Schema<ILoginThrottle>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    windowStartedAt: {
      type: Date,
      required: true,
    },
    blockedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: false,
      updatedAt: 'updatedAt',
    },
  }
);

LoginThrottleSchema.index({ updatedAt: 1 });

const LoginThrottle = mongoose.models.LoginThrottle || mongoose.model<ILoginThrottle>('LoginThrottle', LoginThrottleSchema);

export default LoginThrottle;
