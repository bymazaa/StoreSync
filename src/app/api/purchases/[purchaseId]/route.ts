import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Purchase, { IPurchase } from "@/models/Purchase";
import PurchaseItem from "@/models/PurchaseItem";
import PurchasePayment from "@/models/PurchasePayment";
import PaymentMethod from "@/models/PaymentMethod";
import PurchaseReturn from "@/models/PurchaseReturn";
import PurchaseReturnItem from "@/models/PurchaseReturnItem";
import Supplier from "@/models/Supplier";
import User from "@/models/User";
import Product from "@/models/Product";
import Unit from "@/models/Unit";
import InventoryBatch from "@/models/InventoryBatch";
import Settings from "@/models/Settings";
import { z } from "zod";

export async function GET(_request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const guard = await authorizedAny([Permission.VIEW_REPORTS, Permission.CREATE_PURCHASES]);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { purchaseId } = await params;
  if (!z.uuid().safeParse(purchaseId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid purchase ID." } }, { status: 400 });
  
  const purchase = await Purchase.findById(purchaseId).lean() as IPurchase | null;
  if (!purchase) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Purchase invoice was not found." } }, { status: 404 });
  
  // Fetch all related data
  const [supplier, createdBy, items, payments, returns] = await Promise.all([
    purchase.supplierId ? Supplier.findById(purchase.supplierId).lean() : null,
    User.findById(purchase.createdById).select("_id fullName").lean(),
    PurchaseItem.find({ purchaseId }).lean(),
    PurchasePayment.find({ purchaseId }).sort({ paidAt: 1 }).lean(),
    PurchaseReturn.find({ purchaseId }).sort({ returnedAt: 1 }).lean()
  ]);
  
  // Fetch return items
  const returnIds = returns.map(r => r._id);
  const returnItems = returnIds.length > 0 
    ? await PurchaseReturnItem.find({ returnId: { $in: returnIds } }).lean()
    : [];
  
  const itemUnitIds = [...new Set(items.map(i => i.unitId))];
  const returnItemUnitIds = [...new Set(returnItems.map(i => i.unitId))];
  const paymentMethodIds = [...new Set(payments.map(p => p.methodId))];
  const makerIds = [...new Set(payments.map(p => p.madeById))];
  const returnerIds = [...new Set(returns.map(r => r.createdById))];
  const productIds = [...new Set(items.map(i => i.productId))];
  const [itemUnits, returnItemUnits, paymentMethods, makers, returners, products] = await Promise.all([
    Unit.find({ _id: { $in: itemUnitIds } }).lean(),
    Unit.find({ _id: { $in: returnItemUnitIds } }).lean(),
    PaymentMethod.find({ _id: { $in: paymentMethodIds } }).lean(),
    User.find({ _id: { $in: makerIds } }).select("_id fullName").lean(),
    User.find({ _id: { $in: returnerIds } }).select("_id fullName").lean(),
    Product.find({ _id: { $in: productIds } }).select("_id sku barcode").lean(),
  ]);
  const itemUnitMap = new Map(itemUnits.map(u => [u._id, u]));
  const returnItemUnitMap = new Map(returnItemUnits.map(u => [u._id, u]));
  const paymentMethodMap = new Map(paymentMethods.map(m => [m._id, m]));
  const makerMap = new Map(makers.map(u => [u._id, u]));
  const returnerMap = new Map(returners.map(u => [u._id, u]));
  const productMap = new Map(products.map(p => [p._id, p]));
  
  const returnItemsByReturn = new Map<string, any[]>();
  returnItems.forEach(item => {
    const existing = returnItemsByReturn.get(item.returnId) || [];
    existing.push({ ...item, id: item._id, unit: returnItemUnitMap.get(item.unitId) || null });
    returnItemsByReturn.set(item.returnId, existing);
  });
  
  const returnsWithItems = returns.map(ret => ({
    ...ret,
    id: ret._id,
    createdBy: returnerMap.get(ret.createdById) || null,
    items: returnItemsByReturn.get(ret._id) || []
  }));
  
  const paymentsWithRefs = payments.map(p => ({
    ...p,
    id: p._id,
    method: paymentMethodMap.get(p.methodId) || null,
    madeBy: makerMap.get(p.madeById) || null,
  }));
  
  // Fetch inventory batches for items
  const itemIds = items.map(i => i._id);
  const batches = await InventoryBatch.find({ purchaseItemId: { $in: itemIds } }).lean();
  const batchesByItem = new Map<string, any[]>();
  batches.forEach(batch => {
    const existing = batchesByItem.get(batch.purchaseItemId) || [];
    existing.push({ ...batch, id: batch._id });
    batchesByItem.set(batch.purchaseItemId, existing);
  });
  
  const itemsWithDetails = items.map(item => ({
    ...item,
    id: item._id,
    unit: itemUnitMap.get(item.unitId) || null,
    product: productMap.get(item.productId) || null,
    inventoryBatches: batchesByItem.get(item._id) || []
  }));
  
  const shop = await Settings.findById("shop").select("shopName logoUrl address phone").lean();
  
  return NextResponse.json({ 
    purchase: { ...purchase, id: purchase._id, supplier, createdBy, items: itemsWithDetails, payments: paymentsWithRefs, returns: returnsWithItems }, 
    shop 
  });
}
