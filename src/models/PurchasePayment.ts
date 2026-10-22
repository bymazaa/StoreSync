import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface IPurchasePayment {
  _id: string;
  id?: string;
  clientRequestId?: string | null;
  purchaseId: string;
  methodId: string;
  madeById: string;
  amount: number;
  paidAt: Date;
  reference?: string | null;
  notes?: string | null;
}

const PurchasePaymentSchema = new Schema<IPurchasePayment>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
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
    methodId: {
      type: String,
      required: true,
      ref: 'PaymentMethod',
    },
    madeById: {
      type: String,
      required: true,
      ref: 'User',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reference: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: false,
      updatedAt: false,
    },
  }
);

PurchasePaymentSchema.index({ purchaseId: 1, paidAt: 1 });

const PurchasePayment = mongoose.models.PurchasePayment || mongoose.model<IPurchasePayment>('PurchasePayment', PurchasePaymentSchema);

export default PurchasePayment;
