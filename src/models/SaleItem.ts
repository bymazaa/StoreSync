import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface ISaleItem {
  _id: string;
  id?: string;
  saleId: string;
  productId: string;
  unitId: string;
  productName: string;
  skuSnapshot: string;
  quantity: number;
  conversionToBase: number;
  baseQuantity: number;
  unitPrice: number;
  costPerBaseUnit: number;
  discountAmount: number;
  lineTotal: number;
}

const SaleItemSchema = new Schema<ISaleItem>({
  _id: {
    type: String,
    required: true,
    default: () => randomUUID(),
  },
  saleId: {
    type: String,
    required: true,
    ref: 'Sale',
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
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  costPerBaseUnit: {
    type: Number,
    required: true,
    min: 0,
  },
  discountAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  lineTotal: {
    type: Number,
    required: true,
    min: 0,
  },
});

SaleItemSchema.index({ saleId: 1 });
SaleItemSchema.index({ productId: 1, saleId: 1 });

const SaleItem = mongoose.models.SaleItem || mongoose.model<ISaleItem>('SaleItem', SaleItemSchema);

export default SaleItem;
