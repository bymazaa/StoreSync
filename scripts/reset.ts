import mongoose from 'mongoose';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
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
import { UserRole, Permission, PaymentMethodKind } from '../src/types';

const DEMO_PASSWORD = 'Test@123456';

const ALL_MODELS = [
  User, RefreshSession, LoginThrottle, RolePermission, Settings, Category, Unit, Product,
  ProductUnit, Supplier, Customer, Purchase, PurchaseItem, InventoryBatch, Sale, SaleItem,
  SaleItemBatch, PaymentMethod, SalePayment, PurchasePayment, SaleReturn, SaleReturnItem,
  PurchaseReturn, PurchaseReturnItem, StockMovement, Expense, AuditLog,
];

type DemoProduct = {
  sku: string; name: string; brand: string | null; category: string; base: string;
  barcode: string | null; purchasePrice: number; sellingPrice: number;
  stockOnHand: number; lowStockThreshold: number;
};

/** Fake shop data so the app can be tested manually right after a reset. */
async function createDemoData() {
  console.log('🌱 Creating demo data for manual testing...');

  await Settings.create({
    _id: 'shop',
    shopName: 'Bismillah Trading',
    address: '123 Mirpur Road, Dhaka 1205',
    phone: '+8801711000000',
    countryCode: 'BD',
    currencyCode: 'BDT',
    locale: 'en-BD',
    timezone: 'Asia/Dhaka',
    saleInvoicePrefix: 'INV',
    purchaseInvoicePrefix: 'PO',
    nextSaleNumber: 1,
    nextPurchaseNumber: 1,
    costingMethod: 'WEIGHTED_AVERAGE',
  });

  const units = [
    { code: 'KG', name: 'Kilogram', symbol: 'kg' },
    { code: 'G', name: 'Gram', symbol: 'g' },
    { code: 'LTR', name: 'Liter', symbol: 'L' },
    { code: 'PCS', name: 'Piece', symbol: 'pcs' },
    { code: 'BAG', name: 'Bag', symbol: 'bag' },
    { code: 'PKT', name: 'Packet', symbol: 'pkt' },
  ];
  const unitId: Record<string, string> = {};
  for (const unit of units) unitId[unit.code] = randomUUID();
  await Unit.insertMany(units.map((unit) => ({ _id: unitId[unit.code], ...unit, isActive: true })));

  const categories = [
    { name: 'Groceries', description: 'Food and daily essentials' },
    { name: 'Electronics', description: 'Electronic devices and accessories' },
    { name: 'Clothing', description: 'Apparel and fashion items' },
    { name: 'Pharmaceuticals', description: 'Medicines and health products' },
  ];
  const categoryId: Record<string, string> = {};
  for (const category of categories) categoryId[category.name] = randomUUID();
  await Category.insertMany(categories.map((category) => ({ _id: categoryId[category.name], ...category, isActive: true })));

  const paymentMethods = [
    { code: 'cash', name: 'Cash', kind: PaymentMethodKind.CASH, sortOrder: 0 },
    { code: 'card', name: 'Card', kind: PaymentMethodKind.CARD, sortOrder: 1 },
    { code: 'bank_transfer', name: 'Bank Transfer', kind: PaymentMethodKind.BANK_TRANSFER, sortOrder: 2 },
    { code: 'mobile_payment', name: 'Mobile Payment', kind: PaymentMethodKind.MOBILE_PAYMENT, sortOrder: 3 },
  ];
  await PaymentMethod.insertMany(paymentMethods.map((method) => ({ _id: randomUUID(), ...method, isEnabled: true })));

  const rolePermissions: { role: UserRole; permissions: Permission[] }[] = [
    { role: UserRole.OWNER, permissions: Object.values(Permission) },
    {
      role: UserRole.MANAGER,
      permissions: [
        Permission.MANAGE_PRODUCTS, Permission.CREATE_PURCHASES, Permission.COMPLETE_PURCHASES,
        Permission.CREATE_SALES, Permission.APPLY_DISCOUNTS, Permission.COLLECT_PAYMENTS,
        Permission.VIEW_REPORTS, Permission.ADJUST_STOCK,
      ],
    },
    { role: UserRole.CASHIER, permissions: [Permission.CREATE_SALES, Permission.COLLECT_PAYMENTS, Permission.VIEW_REPORTS] },
    { role: UserRole.STOCK_CLERK, permissions: [Permission.MANAGE_PRODUCTS, Permission.ADJUST_STOCK, Permission.VIEW_REPORTS] },
  ];
  await RolePermission.insertMany(
    rolePermissions.flatMap((entry) => entry.permissions.map((permission) => ({ _id: randomUUID(), role: entry.role, permission }))),
  );

  const passwordHash = await hash(DEMO_PASSWORD, 10);
  const users = [
    { fullName: 'Rakib Hasan', email: 'owner@bismillah.test', role: UserRole.OWNER },
    { fullName: 'Sadia Islam', email: 'manager@bismillah.test', role: UserRole.MANAGER },
    { fullName: 'Jamal Uddin', email: 'cashier@bismillah.test', role: UserRole.CASHIER },
    { fullName: 'Anwar Hossain', email: 'stock@bismillah.test', role: UserRole.STOCK_CLERK },
  ];
  await User.insertMany(users.map((user) => ({ _id: randomUUID(), ...user, passwordHash, isActive: true, sessionVersion: 0 })));

  const suppliers = [
    { name: 'Meghna Wholesale Traders', phoneE164: '+8801711223344', email: 'meghna@example.com', address: 'Gulistan, Dhaka' },
    { name: 'Rahim Agro Supply', phoneE164: '+8801812334455', email: 'rahim@example.com', address: 'Bogura Sadar, Bogura' },
    { name: 'Tech Point Distributors', phoneE164: '+8801913445566', email: 'techpoint@example.com', address: 'Mirpur 1, Dhaka' },
  ];
  await Supplier.insertMany(suppliers.map((supplier) => ({ _id: randomUUID(), ...supplier, openingBalance: 0, isActive: true })));

  const customers = [
    { name: 'Karim Hossain', phoneE164: '+8801712345678', email: 'karim@example.com', address: 'Mirpur 10, Dhaka' },
    { name: 'Nusrat Jahan', phoneE164: '+8801812345679', email: 'nusrat@example.com', address: 'Dhanmondi, Dhaka' },
    { name: 'Abdul Mannan', phoneE164: '+8801912345680', email: null, address: 'Uttara, Dhaka' },
    { name: 'Shirin Akter', phoneE164: '+8801612345681', email: null, address: 'Bashundhara, Dhaka' },
  ];
  await Customer.insertMany(customers.map((customer) => ({ _id: randomUUID(), ...customer, openingBalance: 0, isActive: true })));

  const products: DemoProduct[] = [
    { sku: 'RICE-MINIKET-KG', name: 'Miniket Rice', brand: 'Pran', category: 'Groceries', base: 'KG', barcode: '8901234500011', purchasePrice: 62, sellingPrice: 72, stockOnHand: 250, lowStockThreshold: 50 },
    { sku: 'SUGAR-KG', name: 'Refined Sugar', brand: null, category: 'Groceries', base: 'KG', barcode: '8901234500028', purchasePrice: 105, sellingPrice: 118, stockOnHand: 80, lowStockThreshold: 20 },
    { sku: 'DAL-MASUR-KG', name: 'Masur Lentil', brand: null, category: 'Groceries', base: 'KG', barcode: null, purchasePrice: 128, sellingPrice: 145, stockOnHand: 45, lowStockThreshold: 10 },
    { sku: 'ONION-KG', name: 'Red Onion', brand: null, category: 'Groceries', base: 'KG', barcode: null, purchasePrice: 38, sellingPrice: 50, stockOnHand: 120, lowStockThreshold: 30 },
    { sku: 'POTATO-KG', name: 'Potato', brand: null, category: 'Groceries', base: 'KG', barcode: null, purchasePrice: 28, sellingPrice: 38, stockOnHand: 5, lowStockThreshold: 20 },
    { sku: 'OIL-SOY-5L', name: 'Soybean Oil 5L', brand: 'Teer', category: 'Groceries', base: 'PCS', barcode: '8901234500035', purchasePrice: 780, sellingPrice: 860, stockOnHand: 24, lowStockThreshold: 6 },
    { sku: 'EGG-DOZEN', name: 'Chicken Egg Dozen', brand: null, category: 'Groceries', base: 'PCS', barcode: null, purchasePrice: 108, sellingPrice: 125, stockOnHand: 40, lowStockThreshold: 12 },
    { sku: 'NOODLE-PKT', name: 'Instant Noodles', brand: 'Maggi', category: 'Groceries', base: 'PKT', barcode: '8901234500042', purchasePrice: 14, sellingPrice: 18, stockOnHand: 200, lowStockThreshold: 50 },
    { sku: 'ELEC-CHG-20W', name: 'Fast Charger 20W', brand: 'Anker', category: 'Electronics', base: 'PCS', barcode: null, purchasePrice: 320, sellingPrice: 450, stockOnHand: 15, lowStockThreshold: 5 },
    { sku: 'ELEC-EAR-WIRED', name: 'Wired Earphone', brand: 'Xiaomi', category: 'Electronics', base: 'PCS', barcode: null, purchasePrice: 250, sellingPrice: 400, stockOnHand: 8, lowStockThreshold: 3 },
    { sku: 'PHAR-PARA-500', name: 'Paracetamol 500mg', brand: 'Napa', category: 'Pharmaceuticals', base: 'PKT', barcode: null, purchasePrice: 1.2, sellingPrice: 2, stockOnHand: 300, lowStockThreshold: 60 },
    { sku: 'CLO-TSHIRT-M', name: 'Cotton T-Shirt M', brand: null, category: 'Clothing', base: 'PCS', barcode: null, purchasePrice: 280, sellingPrice: 450, stockOnHand: 0, lowStockThreshold: 5 },
  ];
  const productId: Record<string, string> = {};
  for (const product of products) productId[product.sku] = randomUUID();
  await Product.insertMany(products.map(({ category, base, ...product }) => ({
    _id: productId[product.sku],
    ...product,
    categoryId: categoryId[category],
    baseUnitId: unitId[base],
    isActive: true,
  })));

  // Package units let a few products be purchased in bags but sold in kilograms or packets.
  const productUnits = [
    { sku: 'RICE-MINIKET-KG', unit: 'BAG', conversionToBase: 50 },
    { sku: 'SUGAR-KG', unit: 'BAG', conversionToBase: 50 },
    { sku: 'DAL-MASUR-KG', unit: 'BAG', conversionToBase: 25 },
    { sku: 'NOODLE-PKT', unit: 'BAG', conversionToBase: 40 },
  ];
  await ProductUnit.insertMany(productUnits.map((item) => ({
    _id: randomUUID(),
    productId: productId[item.sku],
    unitId: unitId[item.unit],
    conversionToBase: item.conversionToBase,
    isDefaultPurchase: true,
    isDefaultSale: false,
  })));

  console.log(`✓ Demo data: ${users.length} users, ${products.length} products, ${suppliers.length} suppliers, ${customers.length} customers`);
  console.log('\n👤 Demo logins (password for all: ' + DEMO_PASSWORD + '):');
  for (const user of users) console.log(`   ${user.role.padEnd(12)} ${user.email}`);
}

async function reset() {
  const withDemo = process.argv.includes('--demo');
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
      // The old docker init script made `role` alone unique, but the schema stores one document
      // per role-permission pair.
      [RolePermission, 'role_1'],
      [User, 'role_1'],
      // Sparse indexes still store explicit nulls, so these rejected the second unset value.
      [Sale, 'clientRequestId_1'],
      [Purchase, 'clientRequestId_1'],
      [StockMovement, 'clientRequestId_1'],
      [SaleReturn, 'clientRequestId_1'],
      [PurchaseReturn, 'clientRequestId_1'],
      [SalePayment, 'clientRequestId_1'],
      [PurchasePayment, 'clientRequestId_1'],
      [Expense, 'clientRequestId_1'],
    ] as const;
    for (const [model, index] of staleIndexes) {
      try {
        await model.collection.dropIndex(index);
        console.log(`  ✓ Dropped ${model.modelName}.${index}`);
      } catch {
        console.log(`  - ${model.modelName}.${index} not found, skipping`);
      }
    }

    if (withDemo) await createDemoData();

    console.log('\n✅ Database reset complete - all collections cleared!');
    if (withDemo) {
      console.log('\n🎯 Next steps:');
      console.log('   1. Run: pnpm dev');
      console.log('   2. Sign in with a demo login above (setup is already done)\n');
    } else {
      console.log('\n📝 Note: Default infrastructure data will be created automatically');
      console.log('   when the first owner account is created via /setup page.');
      console.log('\n🎯 Next steps:');
      console.log('   1. Run: pnpm dev');
      console.log('   2. Visit: http://localhost:3000/setup');
      console.log('   3. Create your first owner account (infrastructure auto-created)');
      console.log('   4. Start adding your products, suppliers, and customers\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
}

reset();
