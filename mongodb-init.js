// MongoDB initialization script for StockPilot
// This file runs automatically when the container is first created

db = db.getSiblingDB('stockpilot');

// Create application user with specific permissions
db.createUser({
  user: 'stockpilot_app',
  pwd: 'StockPilot@2026',
  roles: [
    {
      role: 'readWrite',
      db: 'stockpilot'
    }
  ]
});

// Create indexes for better performance (matching Prisma @@index annotations)

// Products
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ barcode: 1 }, { sparse: true });
db.products.createIndex({ name: 1, isActive: 1 });
db.products.createIndex({ categoryId: 1, isActive: 1 });
db.products.createIndex({ baseUnitId: 1 });

// Categories
db.categories.createIndex({ name: 1 }, { unique: true });
db.categories.createIndex({ parentId: 1 });

// Units
db.units.createIndex({ code: 1 }, { unique: true });

// Customers
db.customers.createIndex({ phoneE164: 1 }, { sparse: true, unique: true });
db.customers.createIndex({ email: 1 }, { sparse: true });
db.customers.createIndex({ name: 1 });

// Suppliers
db.suppliers.createIndex({ phoneE164: 1 }, { sparse: true, unique: true });
db.suppliers.createIndex({ email: 1 }, { sparse: true });
db.suppliers.createIndex({ name: 1 });

// Sales
db.sales.createIndex({ invoiceNumber: 1 }, { unique: true });
db.sales.createIndex({ customerId: 1 });
db.sales.createIndex({ soldAt: -1 });
db.sales.createIndex({ status: 1, soldAt: -1 });
db.sales.createIndex({ clientRequestId: 1 }, { sparse: true, unique: true });

// Sale Items
db.saleItems.createIndex({ saleId: 1 });
db.saleItems.createIndex({ productId: 1 });

// Purchases
db.purchases.createIndex({ invoiceNumber: 1 }, { unique: true });
db.purchases.createIndex({ supplierId: 1 });
db.purchases.createIndex({ purchasedAt: -1 });
db.purchases.createIndex({ status: 1, purchasedAt: -1 });
db.purchases.createIndex({ clientRequestId: 1 }, { sparse: true, unique: true });

// Purchase Items
db.purchaseItems.createIndex({ purchaseId: 1 });
db.purchaseItems.createIndex({ productId: 1 });

// Inventory Batches
db.inventoryBatches.createIndex({ productId: 1 });
db.inventoryBatches.createIndex({ purchaseItemId: 1 });
db.inventoryBatches.createIndex({ availableQuantity: 1 });
db.inventoryBatches.createIndex({ expiresAt: 1 });
db.inventoryBatches.createIndex({ productId: 1, availableQuantity: 1, expiresAt: 1 });

// Stock Movements
db.stockMovements.createIndex({ productId: 1 });
db.stockMovements.createIndex({ actorId: 1 });
db.stockMovements.createIndex({ createdAt: -1 });
db.stockMovements.createIndex({ sourceType: 1, sourceId: 1 });
db.stockMovements.createIndex({ clientRequestId: 1 }, { sparse: true, unique: true });

// Expenses
db.expenses.createIndex({ expenseDate: -1 });
db.expenses.createIndex({ methodId: 1 });
db.expenses.createIndex({ createdById: 1 });
db.expenses.createIndex({ voidedAt: 1 });

// Audit Logs
db.auditLogs.createIndex({ actorId: 1 });
db.auditLogs.createIndex({ action: 1 });
db.auditLogs.createIndex({ entityType: 1, entityId: 1 });
db.auditLogs.createIndex({ createdAt: -1 });

// Users
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

// Refresh Sessions
db.refreshSessions.createIndex({ userId: 1 });
db.refreshSessions.createIndex({ tokenHash: 1 }, { unique: true });
db.refreshSessions.createIndex({ expiresAt: 1 });

// Login Throttles
db.loginThrottles.createIndex({ identifier: 1 });
db.loginThrottles.createIndex({ ipAddress: 1 });
db.loginThrottles.createIndex({ lastAttemptAt: 1 }, { expireAfterSeconds: 3600 });

// Role Permissions
db.rolePermissions.createIndex({ role: 1 }, { unique: true });

// Payment Methods
db.paymentMethods.createIndex({ code: 1 }, { unique: true });

// Sale Returns
db.saleReturns.createIndex({ saleId: 1 });
db.saleReturns.createIndex({ returnNumber: 1 }, { unique: true });
db.saleReturns.createIndex({ clientRequestId: 1 }, { sparse: true, unique: true });

// Sale Return Items
db.saleReturnItems.createIndex({ returnId: 1 });
db.saleReturnItems.createIndex({ saleItemId: 1 });

// Purchase Returns
db.purchaseReturns.createIndex({ purchaseId: 1 });
db.purchaseReturns.createIndex({ returnNumber: 1 }, { unique: true });
db.purchaseReturns.createIndex({ clientRequestId: 1 }, { sparse: true, unique: true });

// Purchase Return Items
db.purchaseReturnItems.createIndex({ returnId: 1 });
db.purchaseReturnItems.createIndex({ purchaseItemId: 1 });

// Sale Payments
db.salePayments.createIndex({ saleId: 1 });
db.salePayments.createIndex({ methodId: 1 });
db.salePayments.createIndex({ collectedById: 1 });
db.salePayments.createIndex({ clientRequestId: 1 }, { sparse: true, unique: true });

// Purchase Payments
db.purchasePayments.createIndex({ purchaseId: 1 });
db.purchasePayments.createIndex({ methodId: 1 });
db.purchasePayments.createIndex({ madeById: 1 });
db.purchasePayments.createIndex({ clientRequestId: 1 }, { sparse: true, unique: true });

// Product Units
db.productUnits.createIndex({ productId: 1 });
db.productUnits.createIndex({ unitId: 1 });
db.productUnits.createIndex({ productId: 1, unitId: 1 }, { unique: true });

// Sale Item Batches
db.saleItemBatches.createIndex({ saleItemId: 1 });
db.saleItemBatches.createIndex({ inventoryBatchId: 1 });

print('StockPilot database initialized successfully!');
print('User: stockpilot_app created with readWrite permissions');
print('All indexes created for optimal performance');
