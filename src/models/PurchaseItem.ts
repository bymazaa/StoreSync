import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface IPurchaseItem {
  _id: string;
  id?: string;
  purchaseId: string;
  productId: string;
  unitId: string;
  productName: string;
  skuSnapshot: string;
  quantity: number;
  conversionToBase: number;
  baseQuantity: number;
  unitCost: number;
  lineTotal: number;
  batchNumber?: string | null;
  expiresAt?: Date | null;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>({
  _id: {
    type: String,
    required: true,
    default: () => randomUUID(),
  },
  purchaseId: {
    type: String,
    required: true,
    ref: 'Purchase',
  },
  productId: {
    type: String,
    required: true,
    ref: 'Product',
  },
  unitId: {
    type: String,
    required: true,
    ref: 'Unit',
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  skuSnapshot: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  conversionToBase: {
    type: Number,
    required: true,
    min: 0,
  },
  baseQuantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0,
  },
  lineTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  batchNumber: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
});

PurchaseItemSchema.index({ purchaseId: 1 });
PurchaseItemSchema.index({ productId: 1, purchaseId: 1 });

const PurchaseItem = mongoose.models.PurchaseItem || mongoose.model<IPurchaseItem>('PurchaseItem', PurchaseItemSchema);

export default PurchaseItem;
