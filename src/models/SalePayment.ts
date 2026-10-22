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

SalePaymentSchema.index({ saleId: 1, paidAt: 1 });

const SalePayment = mongoose.models.SalePayment || mongoose.model<ISalePayment>('SalePayment', SalePaymentSchema);

export default SalePayment;
