import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface ICategory {
  _id: string;
  id?: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    parentId: {
      type: String,
      default: null,
      ref: 'Category',
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

CategorySchema.index({ parentId: 1, isActive: 1 });

const Category = mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);

export default Category;
