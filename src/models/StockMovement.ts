import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export type StockDirection = 'IN' | 'OUT';
export type StockMovementReason = 
  | 'OPENING'
  | 'PURCHASE'
  | 'SALE'
  | 'CUSTOMER_RETURN'
  | 'SUPPLIER_RETURN'
  | 'ADJUSTMENT'
  | 'VOIDED_SALE'
  | 'VOIDED_PURCHASE';

export interface IStockMovement {
  _id: string;
  id?: string;
  clientRequestId?: string | null;
  productId: string;
  actorId?: string | null;
  direction: StockDirection;
  reason: StockMovementReason;
  quantity: number;
  balanceAfter: number;
  costPerBaseUnit?: number | null;
  sourceType?: string | null;
  sourceId?: string | null;
  note?: string | null;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    clientRequestId: {
      type: String,
      unique: true,
      sparse: true,
    },
    productId: {
      type: String,
      required: true,
      ref: 'Product',
    },
    actorId: {
      type: String,
      default: null,
      ref: 'User',
    },
    direction: {
      type: String,
      required: true,
      enum: ['IN', 'OUT'],
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'OPENING',
        'PURCHASE',
        'SALE',
        'CUSTOMER_RETURN',
        'SUPPLIER_RETURN',
        'ADJUSTMENT',
        'VOIDED_SALE',
        'VOIDED_PURCHASE',
      ],
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    costPerBaseUnit: {
      type: Number,
      default: null,
    },
    sourceType: {
      type: String,
      default: null,
    },
    sourceId: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: false,
    },
  }
);

StockMovementSchema.index({ productId: 1, createdAt: 1 });
StockMovementSchema.index({ sourceType: 1, sourceId: 1 });

const StockMovement = mongoose.models.StockMovement || mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);

export default StockMovement;
