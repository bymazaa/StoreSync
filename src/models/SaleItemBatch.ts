import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface ISaleItemBatch {
  _id: string;
  id?: string;
  saleItemId: string;
  inventoryBatchId: string;
  quantity: number;
}

const SaleItemBatchSchema = new Schema<ISaleItemBatch>({
  _id: {
    type: String,
    required: true,
    default: () => randomUUID(),
  },
  saleItemId: {
    type: String,
    required: true,
    ref: 'SaleItem',
  },
  inventoryBatchId: {
    type: String,
    required: true,
    ref: 'InventoryBatch',
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
});

SaleItemBatchSchema.index({ saleItemId: 1, inventoryBatchId: 1 }, { unique: true });
SaleItemBatchSchema.index({ inventoryBatchId: 1 });

const SaleItemBatch = mongoose.models.SaleItemBatch || mongoose.model<ISaleItemBatch>('SaleItemBatch', SaleItemBatchSchema);

export default SaleItemBatch;
