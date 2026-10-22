import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface IPurchaseReturnItem {
  _id: string;
  id?: string;
  returnId: string;
  purchaseItemId: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  lineTotal: number;
}

const PurchaseReturnItemSchema = new Schema<IPurchaseReturnItem>({
  _id: {
    type: String,
    required: true,
    default: () => randomUUID(),
  },
  returnId: {
    type: String,
    required: true,
    ref: 'PurchaseReturn',
  },
  purchaseItemId: {
    type: String,
    required: true,
    ref: 'PurchaseItem',
  },
  unitId: {
    type: String,
    required: true,
    ref: 'Unit',
  },
  quantity: {
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
});

PurchaseReturnItemSchema.index({ returnId: 1 });

const PurchaseReturnItem = mongoose.models.PurchaseReturnItem || mongoose.model<IPurchaseReturnItem>('PurchaseReturnItem', PurchaseReturnItemSchema);

export default PurchaseReturnItem;
