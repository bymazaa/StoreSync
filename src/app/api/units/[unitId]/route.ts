import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { Unit, ProductUnit, Product, PurchaseItem, SaleItem, SaleReturnItem, PurchaseReturnItem, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { unitUpdateSchema } from "@/lib/validation/api";
import { z } from "zod";

export async function PATCH(request: Request, { params }: { params: Promise<{ unitId: string }> }) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_PRODUCTS);
  if ("response" in guard) return guard.response;
  
  const { unitId } = await params;
  if (!z.uuid().safeParse(unitId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid unit ID." } }, { status: 400 });
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = unitUpdateSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  try {
    const existing = await Unit.findById(unitId).lean();
    if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unit was not found." } }, { status: 404 });

    // Check if unit is in use
    const changesDefinition = ["code", "name", "symbol"].some((key) => key in parsed.data);
    
    const [productUnits, baseProducts, purchaseItems, saleItems] = await Promise.all([
      ProductUnit.countDocuments({ unitId }),
      Product.countDocuments({ baseUnitId: unitId }),
      PurchaseItem.countDocuments({ unitId }),
      SaleItem.countDocuments({ unitId }),
    ]);
    
    const inUse = productUnits > 0 || baseProducts > 0 || purchaseItems > 0 || saleItems > 0;
    
    if (changesDefinition && inUse) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "A unit used by products or invoices cannot have its definition changed." } }, { status: 409 });
    }

    const unit = await Unit.findByIdAndUpdate(unitId, parsed.data, { returnDocument: "after", runValidators: true }).lean();
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "unit.updated",
      entityType: "unit",
      entityId: unitId,
      metadata: { changedFields: Object.keys(parsed.data) },
    });
    
    return NextResponse.json({ unit });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "A unit with this code already exists." } }, { status: 409 });
    }
    throw error;
  }
}
