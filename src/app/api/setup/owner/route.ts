import { hash } from "bcryptjs";
import { UserRole, Permission } from "@/types";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import connectDB from "@/lib/db";
import { User, AuditLog, Unit, Category, PaymentMethod, RolePermission, Settings } from "@/models";
import { assertSameOrigin } from "@/lib/auth/cookies";
import { invalidBody, apiError } from "@/lib/http/api-response";
import { ownerSetupSchema as ownerSchema } from "@/lib/validation/api";

// Helper function to create default infrastructure data
async function createDefaultData() {
  console.log('🌱 Creating default infrastructure data...');
  
  // Create Units (upsert - skip if exists)
  const units = [
    { code: 'KG', name: 'Kilogram', symbol: 'kg' },
    { code: 'G', name: 'Gram', symbol: 'g' },
    { code: 'LTR', name: 'Liter', symbol: 'L' },
    { code: 'PCS', name: 'Piece', symbol: 'pcs' },
    { code: 'BAG', name: 'Bag', symbol: 'bag' },
    { code: 'PKT', name: 'Packet', symbol: 'pkt' },
  ];
  
  for (const unit of units) {
    const existing = await Unit.findOne({ code: unit.code });
    if (!existing) {
      await Unit.create({ _id: randomUUID(), ...unit });
    }
  }
  console.log(`✓ Created/skipped ${units.length} units`);
  
  // Create Categories
  const categories = [
    { name: 'Electronics', description: 'Electronic devices and accessories' },
    { name: 'Groceries', description: 'Food and daily essentials' },
    { name: 'Clothing', description: 'Apparel and fashion items' },
    { name: 'Pharmaceuticals', description: 'Medicines and health products' },
  ];
  
  for (const cat of categories) {
    const existing = await Category.findOne({ name: cat.name });
    if (!existing) {
      await Category.create({ _id: randomUUID(), ...cat, isActive: true });
    }
  }
  console.log(`✓ Created/skipped ${categories.length} categories`);
  
  // Create Payment Methods
  const paymentMethods = [
    { code: 'cash', name: 'Cash', kind: 'CASH', sortOrder: 0 },
    { code: 'card', name: 'Card', kind: 'CARD', sortOrder: 1 },
    { code: 'bank_transfer', name: 'Bank transfer', kind: 'BANK_TRANSFER', sortOrder: 2 },
    { code: 'mobile_payment', name: 'Mobile payment', kind: 'MOBILE_PAYMENT', sortOrder: 3 },
  ];
  
  for (const pm of paymentMethods) {
    const existing = await PaymentMethod.findOne({ code: pm.code });
    if (!existing) {
      await PaymentMethod.create({ _id: randomUUID(), ...pm, isEnabled: true });
    }
  }
  console.log(`✓ Created/skipped ${paymentMethods.length} payment methods`);
  
  // Create Role Permissions (one document per role-permission pair)
  const allPermissions = Object.values(Permission);
  const roles = [
    { 
      role: UserRole.OWNER, 
      permissions: allPermissions 
    },
    { 
      role: UserRole.MANAGER, 
      permissions: [
        Permission.MANAGE_PRODUCTS,
        Permission.CREATE_PURCHASES,
        Permission.COMPLETE_PURCHASES,
        Permission.CREATE_SALES,
        Permission.APPLY_DISCOUNTS,
        Permission.COLLECT_PAYMENTS,
        Permission.VIEW_REPORTS,
        Permission.ADJUST_STOCK,
      ]
    },
    { 
      role: UserRole.CASHIER, 
      permissions: [
        Permission.CREATE_SALES,
        Permission.COLLECT_PAYMENTS,
        Permission.VIEW_REPORTS,
      ]
    },
    { 
      role: UserRole.STOCK_CLERK, 
      permissions: [
        Permission.MANAGE_PRODUCTS,
        Permission.ADJUST_STOCK,
        Permission.VIEW_REPORTS,
      ]
    },
  ];
  
  for (const rolePerm of roles) {
    for (const perm of rolePerm.permissions) {
      const existing = await RolePermission.findOne({ 
        role: rolePerm.role, 
        permission: perm 
      });
      if (!existing) {
        await RolePermission.create({
          _id: randomUUID(),
          role: rolePerm.role,
          permission: perm,
        });
      }
    }
  }
  console.log(`✓ Created/skipped role permissions for ${roles.length} roles`);
  
  // Create Default Settings (only if not exists)
  const settingsExists = await Settings.findById('shop');
  if (!settingsExists) {
    await Settings.create({
      _id: 'shop',
      shopName: 'My Grocery Shop',
      countryCode: 'US',
      currencyCode: 'USD',
      locale: 'en-US',
      timezone: 'America/New_York',
      saleInvoicePrefix: 'INV',
      purchaseInvoicePrefix: 'PO',
      costingMethod: 'WEIGHTED_AVERAGE',
    });
    console.log('✓ Created default settings');
  } else {
    console.log('✓ Settings already exist, skipped');
  }
}

export async function POST(request: Request) {
  await connectDB();
  if (!assertSameOrigin(request)) return apiError(403, "FORBIDDEN", "Request origin is not allowed.");
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = ownerSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  const passwordHash = await hash(parsed.data.password, 12);
  
  try {
    const count = await User.countDocuments({});
    if (count !== 0) {
      return apiError(409, "CONFLICT", "Initial setup is already complete.");
    }
    
    // Create default infrastructure data FIRST
    await createDefaultData();
    
    // Then create the owner user
    const id = crypto.randomUUID();
    const user = await User.create({
      _id: id,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash,
      role: UserRole.OWNER,
    });
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: id,
      action: "setup.owner_created",
      entityType: "user",
      entityId: id,
    });
    
    console.log('✅ Setup completed successfully!');
    
    return NextResponse.json({ 
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        role: user.role 
      } 
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return apiError(409, "CONFLICT", "That email address is already in use.");
    }
    throw error;
  }
}
