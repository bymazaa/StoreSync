import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export type PaymentMethodKind = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_PAYMENT' | 'OTHER';

export interface IPaymentMethod {
  _id: string;
  id?: string;
  code: string;
  name: string;
  kind: PaymentMethodKind;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    kind: {
      type: String,
      required: true,
      enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'OTHER'],
    },
    isEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: false,
    },
  }
);

PaymentMethodSchema.index({ isEnabled: 1, sortOrder: 1 });

const PaymentMethod = mongoose.models.PaymentMethod || mongoose.model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);

export default PaymentMethod;
