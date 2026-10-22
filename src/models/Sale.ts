import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CANCELLED';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface ISale {
  _id: string;
  id?: string;
  invoiceNumber: string;
  clientRequestId?: string | null;
  customerId?: string | null;
  createdById: string;
  status: SaleStatus;
  soldAt: Date;
  subtotal: number;
  discountType?: DiscountType | null;
  discountValue: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SaleSchema = new Schema<ISale>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    invoiceNumber: {
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
    customerId: {
      type: String,
      default: null,
      ref: 'Customer',
    },
    createdById: {
      type: String,
      required: true,
      ref: 'User',
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED', 'CANCELLED'],
      default: 'DRAFT',
    },
    soldAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    discountType: {
      type: String,
      default: null,
      enum: ['PERCENTAGE', 'FIXED_AMOUNT', null],
    },
    discountValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    dueAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  }
);

SaleSchema.index({ soldAt: 1, status: 1 });
SaleSchema.index({ customerId: 1, soldAt: 1 });

const Sale = mongoose.models.Sale || mongoose.model<ISale>('Sale', SaleSchema);

export default Sale;
