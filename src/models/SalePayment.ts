import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface ISalePayment {
  _id: string;
  id?: string;
  clientRequestId?: string | null;
  saleId: string;
  methodId: string;
  collectedById: string;
  amount: number;
  paidAt: Date;
  reference?: string | null;
  notes?: string | null;
}

const SalePaymentSchema = new Schema<ISalePayment>(
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
    saleId: {
      type: String,
      required: true,
      ref: 'Sale',
    },
    methodId: {
      type: String,
      required: true,
      ref: 'PaymentMethod',
    },
    collectedById: {
      type: String,
      required: true,
      ref: 'User',
    },
    /* Collection rows are positive; a customer return that overpays the due writes one negative refund
       row, so the schema only caps the magnitude at the same 12-digit ceiling the API regex allows. */
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

SalePaymentSchema.index({ saleId: 1, paidAt: 1 });

const SalePayment = mongoose.models.SalePayment || mongoose.model<ISalePayment>('SalePayment', SalePaymentSchema);

export default SalePayment;
