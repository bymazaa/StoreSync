import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface IUnit {
  _id: string;
  id?: string;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
  createdAt: Date;
}

const UnitSchema = new Schema<IUnit>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
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
      updatedAt: false,
    },
  }
);

const Unit = mongoose.models.Unit || mongoose.model<IUnit>('Unit', UnitSchema);

export default Unit;
