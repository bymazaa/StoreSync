/**
 * Database helper utilities for MongoDB/Mongoose compatibility
 * Provides Prisma-like API surface for easier migration
 */

import connectDB from './db';
import * as models from '@/models';

// Type helpers
export type ModelName = keyof typeof models;

/**
 * Ensure database connection before queries
 */
export async function ensureDbConnection() {
    return await connectDB();
}

/**
 * Health check - verify MongoDB connection
 */
export async function healthCheck(): Promise<boolean> {
    try {
        const mongoose = await connectDB();
        return mongoose.connection.readyState === 1; // Connected
    } catch {
        return false;
    }
}

// Export all models for easy access
export const db = {
    settings: models.Settings,
    user: models.User,
    refreshSession: models.RefreshSession,
    loginThrottle: models.LoginThrottle,
    rolePermission: models.RolePermission,
    category: models.Category,
    unit: models.Unit,
    product: models.Product,
    productUnit: models.ProductUnit,
    supplier: models.Supplier,
    customer: models.Customer,
    purchase: models.Purchase,
    purchaseItem: models.PurchaseItem,
    inventoryBatch: models.InventoryBatch,
    sale: models.Sale,
    saleItem: models.SaleItem,
    saleItemBatch: models.SaleItemBatch,
    paymentMethod: models.PaymentMethod,
    salePayment: models.SalePayment,
    purchasePayment: models.PurchasePayment,
    saleReturn: models.SaleReturn,
    saleReturnItem: models.SaleReturnItem,
    purchaseReturn: models.PurchaseReturn,
    purchaseReturnItem: models.PurchaseReturnItem,
    stockMovement: models.StockMovement,
    expense: models.Expense,
    auditLog: models.AuditLog,
};

export default db;
