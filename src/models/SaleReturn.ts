import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export type ReturnStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface ISaleReturn {
  _id: string;
  id?: string;
  returnNumber: string;
  clientRequestId?: string | null;
  saleId: string;
  createdById: string;
  status: ReturnStatus;
  reason?: string | null;
  total: number;
  refundAmount: number;
  returnedAt: Date;
}

const SaleReturnSchema = new Schema<ISaleReturn>(
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
    saleId: {
      type: String,
      required: true,
      ref: 'Sale',
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
    refundAmount: {
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

SaleReturnSchema.index({ saleId: 1, returnedAt: 1 });

const SaleReturn = mongoose.models.SaleReturn || mongoose.model<ISaleReturn>('SaleReturn', SaleReturnSchema);

export default SaleReturn;
