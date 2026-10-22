import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface IInventoryBatch {
  _id: string;
  id?: string;
  productId: string;
  purchaseItemId?: string | null;
  batchNumber?: string | null;
  expiresAt?: Date | null;
  receivedQuantity: number;
  availableQuantity: number;
  costPerBaseUnit: number;
  createdAt: Date;
}

const InventoryBatchSchema = new Schema<IInventoryBatch>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    productId: {
      type: String,
      required: true,
      ref: 'Product',
    },
    purchaseItemId: {
      type: String,
      default: null,
      ref: 'PurchaseItem',
    },
    batchNumber: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    receivedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    costPerBaseUnit: {
      type: Number,
      required: true,
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

InventoryBatchSchema.index({ productId: 1, expiresAt: 1 });
InventoryBatchSchema.index({ productId: 1, createdAt: 1 });

const InventoryBatch = mongoose.models.InventoryBatch || mongoose.model<IInventoryBatch>('InventoryBatch', InventoryBatchSchema);

export default InventoryBatch;
