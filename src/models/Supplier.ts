import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface ISupplier {
  _id: string;
  id?: string;
  name: string;
  phoneE164?: string | null;
  email?: string | null;
  address?: string | null;
  openingBalance: number;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneE164: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      default: null,
    },
    openingBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    notes: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  }
);

SupplierSchema.index({ name: 1, isActive: 1 });

const Supplier = mongoose.models.Supplier || mongoose.model<ISupplier>('Supplier', SupplierSchema);

export default Supplier;
