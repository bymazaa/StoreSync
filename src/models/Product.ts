import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface IProduct {
  _id: string;
  id?: string;
  sku: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  categoryId?: string | null;
  baseUnitId: string;
  purchasePrice: number;
  sellingPrice: number;
  stockOnHand: number;
  lowStockThreshold: number;
  tracksExpiry: boolean;
  tracksBatch: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      default: null,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      default: null,
      trim: true,
    },
    categoryId: {
      type: String,
      default: null,
      ref: 'Category',
    },
    baseUnitId: {
      type: String,
      required: true,
      ref: 'Unit',
    },
    purchasePrice: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stockOnHand: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    tracksExpiry: {
      type: Boolean,
      required: true,
      default: false,
    },
    tracksBatch: {
      type: Boolean,
      required: true,
      default: false,
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

ProductSchema.index({ name: 1, isActive: 1 });
ProductSchema.index({ categoryId: 1, isActive: 1 });
ProductSchema.index({ stockOnHand: 1, lowStockThreshold: 1 });

const Product = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
