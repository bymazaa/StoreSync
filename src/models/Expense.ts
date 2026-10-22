import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IExpense {
  _id: string;
  id?: string;
  clientRequestId?: string | null;
  title: string;
  category?: string | null;
  amount: number;
  expenseDate: Date;
  methodId?: string | null;
  createdById: string;
  voidedAt?: Date | null;
  voidedById?: string | null;
  voidReason?: string | null;
  notes?: string | null;
  createdAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: null,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    methodId: {
      type: String,
      default: null,
      ref: 'PaymentMethod',
    },
    createdById: {
      type: String,
      required: true,
      ref: 'User',
    },
    voidedAt: {
      type: Date,
      default: null,
    },
    voidedById: {
      type: String,
      default: null,
      ref: 'User',
    },
    voidReason: {
      type: String,
      default: null,
    },
    notes: {
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

ExpenseSchema.index({ expenseDate: 1, voidedAt: 1 });
ExpenseSchema.index({ voidedById: 1, voidedAt: 1 });

const Expense = mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);

export default Expense;
