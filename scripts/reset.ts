import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE any imports
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import {
  Settings, User, RefreshSession, LoginThrottle, RolePermission, Category, Unit, Product,
  ProductUnit, Supplier, Customer, Purchase, PurchaseItem, InventoryBatch, Sale, SaleItem,
  SaleItemBatch, PaymentMethod, SalePayment, PurchasePayment, SaleReturn, SaleReturnItem,
  PurchaseReturn, PurchaseReturnItem, StockMovement, Expense, AuditLog,
} from '../src/models';

const ALL_MODELS = [
  User, RefreshSession, LoginThrottle, RolePermission, Settings, Category, Unit, Product,
  ProductUnit, Supplier, Customer, Purchase, PurchaseItem, InventoryBatch, Sale, SaleItem,
  SaleItemBatch, PaymentMethod, SalePayment, PurchasePayment, SaleReturn, SaleReturnItem,
  PurchaseReturn, PurchaseReturnItem, StockMovement, Expense, AuditLog,
];

async function reset() {
  try {
    console.log('🗑️  Starting full database reset...');

    const mongodbUri = process.env.MONGODB_URI;
    if (!mongodbUri) {
      throw new Error('MONGODB_URI environment variable is not set. Please check your .env file.');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongodbUri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✓ Connected to MongoDB');

    console.log('🗑️  Clearing all collections...');
    await Promise.all(ALL_MODELS.map((model) => model.collection.deleteMany({})));

    // Drop stale indexes so Mongoose recreates them with the current schema definitions.
    console.log('🔧 Dropping stale indexes...');
    const staleIndexes = [
      [User, 'phoneE164_1'],
      [Product, 'barcode_1'],
      [Supplier, 'phoneE164_1'],
      [Customer, 'phoneE164_1'],
    ] as const;
    for (const [model, index] of staleIndexes) {
      try {
        await model.collection.dropIndex(index);
        console.log(`  ✓ Dropped ${model.modelName}.${index}`);
      } catch {
        console.log(`  - ${model.modelName}.${index} not found, skipping`);
      }
    }

    console.log('\n✅ Database reset complete - all collections cleared!');
    console.log('\n📝 Note: Default infrastructure data will be created automatically');
    console.log('   when the first owner account is created via /setup page.');
    console.log('\n🎯 Next steps:');
    console.log('   1. Run: pnpm dev');
    console.log('   2. Visit: http://localhost:3000/setup');
    console.log('   3. Create your first owner account (infrastructure auto-created)');
    console.log('   4. Start adding your products, suppliers, and customers\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
}

reset();
