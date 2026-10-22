// Type definitions migrated from Prisma schema for MongoDB/Mongoose compatibility

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  STOCK_CLERK = 'STOCK_CLERK',
}

export enum Permission {
  MANAGE_PRODUCTS = 'MANAGE_PRODUCTS',
  CREATE_PURCHASES = 'CREATE_PURCHASES',
  COMPLETE_PURCHASES = 'COMPLETE_PURCHASES',
  CREATE_SALES = 'CREATE_SALES',
  APPLY_DISCOUNTS = 'APPLY_DISCOUNTS',
  COLLECT_PAYMENTS = 'COLLECT_PAYMENTS',
  VIEW_REPORTS = 'VIEW_REPORTS',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',
  ADJUST_STOCK = 'ADJUST_STOCK',
  PROCESS_RETURNS = 'PROCESS_RETURNS',
  MANAGE_EXPENSES = 'MANAGE_EXPENSES',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum CostingMethod {
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
  FIFO = 'FIFO',
}

export enum PaymentMethodKind {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT',
  OTHER = 'OTHER',
}

export enum PurchaseStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  PARTIALLY_RETURNED = 'PARTIALLY_RETURNED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum SaleStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  PARTIALLY_RETURNED = 'PARTIALLY_RETURNED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum ReturnStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum StockDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum StockMovementReason {
  OPENING = 'OPENING',
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  CUSTOMER_RETURN = 'CUSTOMER_RETURN',
  SUPPLIER_RETURN = 'SUPPLIER_RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  VOIDED_SALE = 'VOIDED_SALE',
  VOIDED_PURCHASE = 'VOIDED_PURCHASE',
}

// Re-export common types for API usage
export type { IUser } from '@/models/User';
export type { IProduct } from '@/models/Product';
export type { ISale } from '@/models/Sale';
export type { IPurchase } from '@/models/Purchase';
export type { ICustomer } from '@/models/Customer';
export type { ISupplier } from '@/models/Supplier';
