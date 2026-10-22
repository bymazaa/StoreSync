import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Sale, { ISale } from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import SalePayment from "@/models/SalePayment";
import PaymentMethod from "@/models/PaymentMethod";
import SaleReturn from "@/models/SaleReturn";
import SaleReturnItem from "@/models/SaleReturnItem";
import Customer from "@/models/Customer";
import User from "@/models/User";
import Product from "@/models/Product";
import Unit from "@/models/Unit";
import InventoryBatch from "@/models/InventoryBatch";
import Settings from "@/models/Settings";
import { z } from "zod";

export async function GET(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const guard = await authorizedAny([Permission.VIEW_REPORTS, Permission.CREATE_SALES]);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { saleId } = await params;
  if (!z.uuid().safeParse(saleId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid sale ID." } }, { status: 400 });
  
  const sale = await Sale.findById(saleId).lean() as ISale | null;
  if (!sale) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Sale invoice was not found." } }, { status: 404 });
  
  // Fetch all related data
  const [customer, createdBy, items, payments, returns] = await Promise.all([
    sale.customerId ? Customer.findById(sale.customerId).lean() : null,
    User.findById(sale.createdById).select("_id fullName").lean(),
    SaleItem.find({ saleId }).lean(),
    SalePayment.find({ saleId }).sort({ paidAt: 1 }).lean(),
    SaleReturn.find({ saleId }).sort({ returnedAt: 1 }).lean()
  ]);
  
  // Fetch return items
  const returnIds = returns.map(r => r._id);
  const returnItems = returnIds.length > 0 
    ? await SaleReturnItem.find({ returnId: { $in: returnIds } }).lean()
    : [];
  
  const itemUnitIds = [...new Set(items.map(i => i.unitId))];
  const returnItemUnitIds = [...new Set(returnItems.map(i => i.unitId))];
  const paymentMethodIds = [...new Set(payments.map(p => p.methodId))];
  const collectorIds = [...new Set(payments.map(p => p.collectedById))];
  const returnerIds = [...new Set(returns.map(r => r.createdById))];
  const productIds = [...new Set(items.map(i => i.productId))];
  const [itemUnits, returnItemUnits, paymentMethods, collectors, returners, products] = await Promise.all([
    Unit.find({ _id: { $in: itemUnitIds } }).lean(),
    Unit.find({ _id: { $in: returnItemUnitIds } }).lean(),
    PaymentMethod.find({ _id: { $in: paymentMethodIds } }).lean(),
    User.find({ _id: { $in: collectorIds } }).select("_id fullName").lean(),
    User.find({ _id: { $in: returnerIds } }).select("_id fullName").lean(),
    Product.find({ _id: { $in: productIds } }).select("_id sku barcode tracksBatch tracksExpiry").lean(),
  ]);
  const itemUnitMap = new Map(itemUnits.map(u => [u._id, u]));
  const returnItemUnitMap = new Map(returnItemUnits.map(u => [u._id, u]));
  const paymentMethodMap = new Map(paymentMethods.map(m => [m._id, m]));
  const collectorMap = new Map(collectors.map(u => [u._id, u]));
  const returnerMap = new Map(returners.map(u => [u._id, u]));
  const productMap = new Map(products.map(p => [p._id, p]));
  
  const itemsWithProduct = items.map(item => ({
    ...item,
    id: item._id,
    unit: itemUnitMap.get(item.unitId) || null,
    product: productMap.get(item.productId) || null,
  }));
  
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
    collectedBy: collectorMap.get(p.collectedById) || null,
  }));
  
  const shop = await Settings.findById("shop").select("shopName logoUrl address phone").lean();
  
  return NextResponse.json({ 
    sale: { ...sale, id: sale._id, customer, createdBy, items: itemsWithProduct, payments: paymentsWithRefs, returns: returnsWithItems }, 
    shop 
  });
}
