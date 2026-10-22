import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export type ReturnStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface IPurchaseReturn {
  _id: string;
  id?: string;
  returnNumber: string;
  clientRequestId?: string | null;
  purchaseId: string;
  createdById: string;
  status: ReturnStatus;
  reason?: string | null;
  total: number;
  returnedAt: Date;
}

const PurchaseReturnSchema = new Schema<IPurchaseReturn>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    clientRequestId: {
      type: String,
      unique: true,
      sparse: true,
    },
    purchaseId: {
      type: String,
      required: true,
      ref: 'Purchase',
    },
    createdById: {
      type: String,
      required: true,
      ref: 'User',
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
    },
    reason: {
      type: String,
      default: null,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    returnedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: {
      createdAt: false,
      updatedAt: false,
    },
  }
);

PurchaseReturnSchema.index({ purchaseId: 1, returnedAt: 1 });

const PurchaseReturn = mongoose.models.PurchaseReturn || mongoose.model<IPurchaseReturn>('PurchaseReturn', PurchaseReturnSchema);

export default PurchaseReturn;
