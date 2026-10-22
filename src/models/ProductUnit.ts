import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IProductUnit {
  _id: string;
  id?: string;
  productId: string;
  unitId: string;
  conversionToBase: number;
  isDefaultPurchase: boolean;
  isDefaultSale: boolean;
}

const ProductUnitSchema = new Schema<IProductUnit>({
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
  unitId: {
    type: String,
    required: true,
    ref: 'Unit',
  },
  conversionToBase: {
    type: Number,
    required: true,
    default: 1,
    min: 0,
  },
  isDefaultPurchase: {
    type: Boolean,
    required: true,
    default: false,
  },
  isDefaultSale: {
    type: Boolean,
    required: true,
    default: false,
  },
});

ProductUnitSchema.index({ productId: 1, unitId: 1 }, { unique: true });
ProductUnitSchema.index({ productId: 1, isDefaultPurchase: 1 });
ProductUnitSchema.index({ productId: 1, isDefaultSale: 1 });

const ProductUnit = mongoose.models.ProductUnit || mongoose.model<IProductUnit>('ProductUnit', ProductUnitSchema);

export default ProductUnit;
