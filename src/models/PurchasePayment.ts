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
    /* Collection rows are positive; a supplier return that overpays the balance writes one negative
       refund row, so the schema only caps the magnitude at the same 12-digit ceiling the API regex allows. */
    amount: {
      type: Number,
      required: true,
      min: -999999999999,
      max: 999999999999,
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
