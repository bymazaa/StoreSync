import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export type PurchaseStatus = 'DRAFT' | 'COMPLETED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CANCELLED';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface IPurchase {
  _id: string;
  id?: string;
  invoiceNumber: string;
  clientRequestId?: string | null;
  supplierInvoiceNumber?: string | null;
  supplierId: string;
  createdById: string;
  status: PurchaseStatus;
  purchasedAt: Date;
  subtotal: number;
  discountType?: DiscountType | null;
  discountValue: number;
  discountAmount: number;
  additionalCost: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
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
    supplierInvoiceNumber: {
      type: String,
      default: null,
      trim: true,
    },
    supplierId: {
      type: String,
      required: true,
      ref: 'Supplier',
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
    purchasedAt: {
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
    additionalCost: {
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

PurchaseSchema.index({ purchasedAt: 1, status: 1 });
PurchaseSchema.index({ supplierId: 1, purchasedAt: 1 });

const Purchase = mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', PurchaseSchema);

export default Purchase;
