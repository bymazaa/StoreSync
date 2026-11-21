import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Product, { IProduct } from "@/models/Product";
import ProductUnit from "@/models/ProductUnit";
import Category from "@/models/Category";
import Unit from "@/models/Unit";
import StockMovement from "@/models/StockMovement";
import AuditLog from "@/models/AuditLog";
import { invalidBody } from "@/lib/http/api-response";
import { productUpdateSchema } from "@/lib/validation/api";
import { z } from "zod";


export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const guard = await authorized(Permission.MANAGE_PRODUCTS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { productId } = await params;
  if (!z.uuid().safeParse(productId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid product ID." } }, { status: 400 });
  
  const product = await Product.findById(productId).lean() as IProduct | null;
  if (!product) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Product was not found." } }, { status: 404 });
  
  // Fetch related data
  const [category, baseUnit, units] = await Promise.all([
    Category.findById(product.categoryId).lean(),
    Unit.findById(product.baseUnitId).lean(),
    ProductUnit.find({ productId }).populate("unitId").lean()
  ]);
  
  return NextResponse.json({ 
    product: { ...product, id: product._id, category, baseUnit, units } 
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const guard = await authorized(Permission.MANAGE_PRODUCTS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { productId } = await params;
  if (!z.uuid().safeParse(productId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid product ID." } }, { status: 400 });
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = productUpdateSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  const { units, ...data } = parsed.data;
  
  try {
    const existing = await Product.findById(productId).lean() as IProduct | null;
    if (!existing) throw new ProductUpdateError("Product was not found.", 404);
    
    if (data.isActive === false && existing.stockOnHand > 0) {
      throw new ProductUpdateError("Move the product's remaining stock before archiving it.");
    }

    const nextBaseUnitId = data.baseUnitId ?? existing.baseUnitId;
    
    // Check if base unit can be changed
    if (nextBaseUnitId !== existing.baseUnitId) {
      const movementCount = await StockMovement.countDocuments({ productId });
      if (existing.stockOnHand > 0 || movementCount > 0) {
        throw new ProductUpdateError("Base unit cannot be changed after stock movements exist.");
      }
    }
    
    if (nextBaseUnitId !== existing.baseUnitId && !units) {
      const existingUnits = await ProductUnit.find({ productId }).lean();
      if (existingUnits.length > 0) {
        throw new ProductUpdateError("Update the product's package conversions in the same request as its base unit.");
      }
    }
    
    if (data.baseUnitId) {
      const baseUnit = await Unit.findOne({ _id: data.baseUnitId, isActive: true }).lean();
      if (!baseUnit) throw new ProductUpdateError("Base unit was not found.");
    }
    
    if (data.categoryId) {
      const category = await Category.findOne({ _id: data.categoryId, isActive: true }).lean();
      if (!category) throw new ProductUpdateError("Category was not found.");
    }
    
    // Calculate which fields actually changed compared to the existing product record
    const changedFields: string[] = [];
    if (data.name !== undefined && data.name.trim() !== (existing.name ?? '').trim()) {
      changedFields.push("name");
    }
    if (data.sku !== undefined && data.sku.trim() !== (existing.sku ?? '').trim()) {
      changedFields.push("sku");
    }
    if (data.barcode !== undefined) {
      const nextBarcode = data.barcode ? data.barcode.trim() : null;
      const currentBarcode = existing.barcode ? existing.barcode.trim() : null;
      if (nextBarcode !== currentBarcode) {
        changedFields.push("barcode");
      }
    }
    if (data.brand !== undefined) {
      const nextBrand = data.brand ? data.brand.trim() : null;
      const currentBrand = existing.brand ? existing.brand.trim() : null;
      if (nextBrand !== currentBrand) {
        changedFields.push("brand");
      }
    }
    if (data.categoryId !== undefined) {
      const nextCat = data.categoryId || null;
      const currentCat = existing.categoryId || null;
      if (nextCat !== currentCat) {
        changedFields.push("categoryId");
      }
    }
    if (data.baseUnitId !== undefined && String(data.baseUnitId) !== String(existing.baseUnitId)) {
      changedFields.push("baseUnitId");
    }
    if (data.purchasePrice !== undefined && Number(data.purchasePrice) !== Number(existing.purchasePrice)) {
      changedFields.push("purchasePrice");
    }
    if (data.sellingPrice !== undefined && Number(data.sellingPrice) !== Number(existing.sellingPrice)) {
      changedFields.push("sellingPrice");
    }
    if (data.lowStockThreshold !== undefined && Number(data.lowStockThreshold) !== Number(existing.lowStockThreshold)) {
      changedFields.push("lowStockThreshold");
    }
    if (data.tracksExpiry !== undefined && Boolean(data.tracksExpiry) !== Boolean(existing.tracksExpiry)) {
      changedFields.push("tracksExpiry");
    }
    if (data.tracksBatch !== undefined && Boolean(data.tracksBatch) !== Boolean(existing.tracksBatch)) {
      changedFields.push("tracksBatch");
    }
    if (data.isActive !== undefined && Boolean(data.isActive) !== Boolean(existing.isActive)) {
      changedFields.push("isActive");
    }

    let unitsChanged = false;
    if (units !== undefined) {
      const existingUnits = await ProductUnit.find({ productId }).lean();
      if (existingUnits.length !== units.length) {
        unitsChanged = true;
      } else {
        const existingMap = new Map(existingUnits.map((u) => [String(u.unitId), Number(u.conversionToBase)]));
        for (const u of units) {
          const conv = existingMap.get(String(u.unitId));
          if (conv === undefined || conv !== Number(u.conversionToBase)) {
            unitsChanged = true;
            break;
          }
        }
      }
      if (unitsChanged) {
        changedFields.push("units");
      }
    }

    // Update product first
    const updated = await Product.findByIdAndUpdate(
      productId,
      { ...data, ...(data.barcode !== undefined ? { barcode: data.barcode || null } : {}) },
      { returnDocument: "after", runValidators: true }
    ).lean() as IProduct;
    
    // Handle units update only if units changed
    if (units && unitsChanged) {
      if (units.some((unit) => unit.unitId === nextBaseUnitId)) {
        throw new ProductUpdateError("Base unit is configured automatically; choose other units only.");
      }
      
      const ids = [...new Set(units.map((unit) => unit.unitId))];
      const count = await Unit.countDocuments({ _id: { $in: ids }, isActive: true });
      if (count !== ids.length) throw new ProductUpdateError("One of the selected units is unavailable.");
      
      // Delete old units and create new ones
      await ProductUnit.deleteMany({ productId });
      await ProductUnit.create(units.map((unit) => ({ productId, ...unit })));
    }
    
    if (changedFields.length > 0) {
      await AuditLog.create({
        _id: randomUUID(),
        actorId: guard.user.id,
        action: "product.updated",
        entityType: "product",
        entityId: productId, 
        metadata: { changedFields }
      });
    }
    
    // Fetch related data for response
    const [category, baseUnit, productUnits] = await Promise.all([
      Category.findById(updated.categoryId).lean(),
      Unit.findById(updated.baseUnitId).lean(),
      ProductUnit.find({ productId }).populate("unitId").lean()
    ]);
    
    return NextResponse.json({ 
      product: { ...updated, id: updated._id, category, baseUnit, units: productUnits } 
    });
  } catch (error) {
    if (error instanceof ProductUpdateError) return NextResponse.json({ error: { code: error.status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message: error.message } }, { status: error.status });
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "SKU or barcode is already in use." } }, { status: 409 });
    }
    throw error;
  }
}

class ProductUpdateError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
