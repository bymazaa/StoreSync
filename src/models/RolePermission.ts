import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export type Permission = 
  | 'MANAGE_PRODUCTS'
  | 'CREATE_PURCHASES'
  | 'COMPLETE_PURCHASES'
  | 'CREATE_SALES'
  | 'APPLY_DISCOUNTS'
  | 'COLLECT_PAYMENTS'
  | 'VIEW_REPORTS'
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS'
  | 'ADJUST_STOCK'
  | 'PROCESS_RETURNS'
  | 'MANAGE_EXPENSES';

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'STOCK_CLERK';

export interface IRolePermission {
  _id: string;
  id?: string;
  role: UserRole;
  permission: Permission;
  createdAt: Date;
}

const RolePermissionSchema = new Schema<IRolePermission>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    role: {
      type: String,
      required: true,
      enum: ['OWNER', 'MANAGER', 'CASHIER', 'STOCK_CLERK'],
    },
    permission: {
      type: String,
      required: true,
      enum: [
        'MANAGE_PRODUCTS',
        'CREATE_PURCHASES',
        'COMPLETE_PURCHASES',
        'CREATE_SALES',
        'APPLY_DISCOUNTS',
        'COLLECT_PAYMENTS',
        'VIEW_REPORTS',
        'MANAGE_USERS',
        'MANAGE_SETTINGS',
        'ADJUST_STOCK',
        'PROCESS_RETURNS',
        'MANAGE_EXPENSES',
      ],
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: false,
    },
  }
);

RolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });

const RolePermission = mongoose.models.RolePermission || mongoose.model<IRolePermission>('RolePermission', RolePermissionSchema);

export default RolePermission;
