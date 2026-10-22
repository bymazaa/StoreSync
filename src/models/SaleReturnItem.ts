import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface ISaleReturnItem {
  _id: string;
  id?: string;
  returnId: string;
  saleItemId: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  unitAmount: number;
  lineTotal: number;
}

const SaleReturnItemSchema = new Schema<ISaleReturnItem>({
  _id: {
    type: String,
    required: true,
    default: () => randomUUID(),
  },
  returnId: {
    type: String,
    required: true,
    ref: 'SaleReturn',
  },
  saleItemId: {
    type: String,
    required: true,
    ref: 'SaleItem',
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
  unitAmount: {
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

SaleReturnItemSchema.index({ returnId: 1 });

const SaleReturnItem = mongoose.models.SaleReturnItem || mongoose.model<ISaleReturnItem>('SaleReturnItem', SaleReturnItemSchema);

export default SaleReturnItem;
