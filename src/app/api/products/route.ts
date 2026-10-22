import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Permission } from "@/types";
import { authorized, authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { Product, Category, Unit, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { productSchema } from "@/lib/validation/api";

export async function GET(request: Request) {
  await connectDB();
  const guard = await authorizedAny([Permission.MANAGE_PRODUCTS, Permission.CREATE_SALES, Permission.CREATE_PURCHASES, Permission.ADJUST_STOCK]);
  if ("response" in guard) return guard.response;
  
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.trim();
  const includeInactive = searchParams.get("includeInactive") === "true"
    && guard.user.rolePermissions.some((entry) => entry.permission === Permission.MANAGE_PRODUCTS);
  
  let query: any = {};
  if (!includeInactive) query.isActive = true;
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }
  
  const products = await Product.find(query)
    .sort({ name: 1 })
    .limit(100)
    .lean();
  
  // Manually populate categoryId, baseUnitId, and units
  const categoryIds = [...new Set(products.filter(p => p.categoryId).map(p => p.categoryId!))];
  const unitIds = [...new Set(products.map(p => p.baseUnitId))];
  
  const [categories, units] = await Promise.all([
    categoryIds.length > 0 ? Category.find({ _id: { $in: categoryIds } }).select('_id name').lean() : [],
    unitIds.length > 0 ? Unit.find({ _id: { $in: unitIds } }).select('_id code name symbol').lean() : []
  ]);
  
  const categoryMap = new Map(categories.map(c => [c._id, c]));
  const unitMap = new Map(units.map(u => [u._id, u]));
  
  // Fetch product units separately
  const productIds = products.map(p => p._id);
  const allProductUnits = await import('@/models').then(m => 
    m.ProductUnit.find({ productId: { $in: productIds } }).lean()
  );
  
  const productUnitsMap = new Map<string, any[]>();
  for (const pu of allProductUnits) {
    if (!productUnitsMap.has(pu.productId)) {
      productUnitsMap.set(pu.productId, []);
    }
    productUnitsMap.get(pu.productId)!.push(pu);
  }
  
  const productsWithRelations = products.map(product => {
    const productUnits = productUnitsMap.get(product._id) || [];
    const unitsWithDetails = productUnits.map(pu => ({
      ...pu,
      unit: unitMap.get(pu.unitId) || null
    }));
    
    return {
      ...product,
      id: product._id,
      category: product.categoryId ? categoryMap.get(product.categoryId) || null : null,
      baseUnit: unitMap.get(product.baseUnitId) || null,
      units: unitsWithDetails
    };
  });
  
  return NextResponse.json({ products: productsWithRelations });
}

export async function POST(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_PRODUCTS);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  
  console.log("Product POST body:", JSON.stringify(body, null, 2));
  
  // Normalize empty or missing categoryId to null
  if (body && typeof body === "object") {
    const normalized = { ...(body as Record<string, unknown>) };
    if (!normalized.categoryId || normalized.categoryId === "") {
      normalized.categoryId = null;
    }
    body = normalized;
  }
  
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    console.log("Product validation errors:", JSON.stringify(parsed.error.issues, null, 2));
    const firstError = parsed.error.issues[0];
    const message = firstError 
      ? `${firstError.path.join(".")}: ${firstError.message}` 
      : "Please check the submitted information.";
    return NextResponse.json({ error: { code: "BAD_REQUEST", message } }, { status: 400 });
  }
  
  const input = parsed.data;
  
  try {
    // Validate base unit
    const baseUnit = await Unit.findOne({ _id: input.baseUnitId, isActive: true }).lean();
    if (!baseUnit) {
      throw new Error("Base unit was not found.");
    }
    
    // Validate category if provided
    const category = input.categoryId 
      ? await Category.findOne({ _id: input.categoryId, isActive: true }).lean()
      : null;
    
    if (input.categoryId && !category) {
      throw new Error("Category was not found.");
    }
    
    // Validate units
    if (input.units.length) {
      const unitIds = input.units.map((unit) => unit.unitId);
      const activeUnits = await Unit.countDocuments({ _id: { $in: unitIds }, isActive: true });
      if (activeUnits !== unitIds.length) {
        throw new Error("One of the selected units is unavailable.");
      }
    }
    
    // Generate SKU
    const prefix = skuCategoryPrefix(category?.name);
    let sku = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      sku = `${prefix}-${randomBytes(3).toString("hex").toUpperCase()}`;
      const existing = await Product.findOne({ sku }).lean();
      if (!existing) break;
      sku = "";
    }
    if (!sku) throw new Error("A unique SKU could not be generated. Please try again.");
    
    const id = crypto.randomUUID();
    const product = await Product.create({
      _id: id,
      name: input.name,
      sku,
      barcode: input.barcode || null,
      brand: input.brand || null,
      categoryId: input.categoryId || null,
      baseUnitId: input.baseUnitId,
      purchasePrice: 0,
      sellingPrice: 0,
      stockOnHand: 0,
      lowStockThreshold: input.lowStockThreshold,
      tracksExpiry: false,
      tracksBatch: false,
    });
    
    // Create product units
    if (input.units.length) {
      await import('@/models').then(m =>
        m.ProductUnit.create(
          input.units.map((unit) => ({
            _id: crypto.randomUUID(),
            productId: id,
            ...unit,
          }))
        )
      );
    }
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "product.created",
      entityType: "product",
      entityId: id,
      metadata: { sku: product.sku },
    });
    
    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Base unit was not found." || 
        error.message === "Category was not found." ||
        error.message === "One of the selected units is unavailable." ||
        error.message === "A unique SKU could not be generated. Please try again.") {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    }
    if (error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "SKU or barcode is already in use." } }, { status: 409 });
    }
    throw error;
  }
}

class ProductCreationError extends Error {}

function skuCategoryPrefix(categoryName?: string | null) {
  const words = (categoryName ?? "").toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  if (words.length > 1) return words.map((word) => word[0]).join("").slice(0, 2) || "PR";
  return words[0]?.slice(0, 2) || "PR";
}
