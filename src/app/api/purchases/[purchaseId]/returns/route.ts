import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Permission, PurchaseStatus, ReturnStatus } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Purchase, { IPurchase } from "@/models/Purchase";
import PurchaseItem from "@/models/PurchaseItem";
import PurchaseReturn, { IPurchaseReturn } from "@/models/PurchaseReturn";
import PurchaseReturnItem from "@/models/PurchaseReturnItem";
import Product from "@/models/Product";
import InventoryBatch from "@/models/InventoryBatch";
import StockMovement from "@/models/StockMovement";
import PaymentMethod from "@/models/PaymentMethod";
import PurchasePayment from "@/models/PurchasePayment";
import AuditLog from "@/models/AuditLog";
import Unit from "@/models/Unit";
import { invalidBody } from "@/lib/http/api-response";
import { purchaseReturnSchema as schema } from "@/lib/validation/api";
import { usesWholeQuantity } from "@/lib/quantity";

// Helper to convert Decimal128/string to number
const toNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString());
};

// Helper to parse decimal string input to number
const parseDecimalString = (val: string | number): number => {
  if (typeof val === 'number') return val;
  return parseFloat(val);
};


const money = (value: number) => parseFloat(value.toFixed(2));

async function replayPurchaseReturn(clientRequestId: string, actorId: string) {
  const prior = await PurchaseReturn.findOne({ clientRequestId }).lean() as IPurchaseReturn | null;
  if (!prior) return null;
  if (prior.createdById !== actorId) return NextResponse.json({ error: { code: "CONFLICT", message: "This return request key has already been used." } }, { status: 409 });
  
  // Populate related data
  const [items, purchase] = await Promise.all([
    PurchaseReturnItem.find({ returnId: prior._id }).lean(),
    Purchase.findById(prior.purchaseId).lean()
  ]);
  
  return NextResponse.json({ purchaseReturn: { ...prior, items, purchase }, alreadyProcessed: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const guard = await authorized(Permission.PROCESS_RETURNS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { purchaseId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  if (parsed.data.clientRequestId) {
    const replay = await replayPurchaseReturn(parsed.data.clientRequestId, guard.user.id);
    if (replay) return replay;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const purchase = await Purchase.findById(purchaseId).session(session).lean() as IPurchase | null;
    if (!purchase || (purchase.status !== PurchaseStatus.COMPLETED && purchase.status !== PurchaseStatus.PARTIALLY_RETURNED)) {
      throw new PurchaseReturnError("Only an active purchase can receive a supplier return.");
    }
    
    // Get purchase items with units
    const purchaseItems = await PurchaseItem.find({ purchaseId }).session(session).lean();
    const unitIds = [...new Set(purchaseItems.map(i => i.unitId))];
    const units = await Unit.find({ _id: { $in: unitIds } }).session(session).lean();
    const unitMap = new Map(units.map(u => [u._id, u]));
    
    const lines: Array<{
      item: any; quantity: number; baseQuantity: number;
      total: number; inventoryCost: number;
    }> = [];
    let subtotal = 0;
    
    for (const requested of parsed.data.items) {
      const item = purchaseItems.find((entry) => entry._id === requested.purchaseItemId);
      if (!item) throw new PurchaseReturnError("A selected purchase item does not belong to this invoice.");
      
      // Calculate previously returned quantity
      const previousReturns = await PurchaseReturnItem.find({ 
        purchaseItemId: item._id,
        returnId: { $in: await PurchaseReturn.find({ purchaseId, status: ReturnStatus.COMPLETED }).distinct("_id").session(session) }
      }).session(session).lean();
      
      const quantity = parseDecimalString(requested.quantity);
      const unit = unitMap.get(item.unitId);
      if (usesWholeQuantity(unit!.name, unit!.symbol) && !Number.isInteger(quantity)) {
        throw new PurchaseReturnError("Return quantities for counted units must be whole numbers.");
      }
      if (!usesWholeQuantity(unit!.name, unit!.symbol) && quantity.toString().split('.')[1]?.length > 2) {
        throw new PurchaseReturnError("Measured return quantities can have at most two decimal places.");
      }
      
      const baseQuantity = parseFloat((quantity * item.conversionToBase).toFixed(6));
      const previouslyReturnedQty = previousReturns.reduce((sum: number, ret: any) => sum + toNumber(ret.baseQuantity), 0);
      if (previouslyReturnedQty + baseQuantity > item.baseQuantity) {
        throw new PurchaseReturnError("Return quantity exceeds the quantity purchased.");
      }
      
      const gross = money(item.unitCost * quantity);
      subtotal += gross;
      lines.push({ item, quantity, baseQuantity, total: gross, inventoryCost: 0 });
    }
    
    const discountShare = purchase.subtotal > 0 ? purchase.discountAmount / purchase.subtotal : 0;
    const additionalCostShare = purchase.subtotal > 0 ? purchase.additionalCost / purchase.subtotal : 0;
    let total = 0;
    
    for (const line of lines) {
      line.total = money(line.total - line.total * discountShare + line.total * additionalCostShare);
      line.inventoryCost = line.total;
      total += line.total;
    }
    
    total = money(total);
    if (total < 0 || total > purchase.total) throw new PurchaseReturnError("Return amount is not valid for this invoice.");
    const dueReduction = Math.min(purchase.dueAmount, total);
    const refundAmount = money(total - dueReduction);
    
    let refundMethod = null;
    if (refundAmount > 0) {
      if (!parsed.data.refundMethodId) throw new PurchaseReturnError("Choose a payment method for the supplier refund.");
      refundMethod = await PaymentMethod.findOne({ _id: parsed.data.refundMethodId, isEnabled: true }).session(session).lean();
      if (!refundMethod) throw new PurchaseReturnError("The selected refund method is unavailable.");
    }
    
    const returnNumber = `PR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await PurchaseReturn.create([{
      clientRequestId: parsed.data.clientRequestId,
      returnNumber, purchaseId: purchase._id, createdById: guard.user.id,
      status: ReturnStatus.COMPLETED, reason: parsed.data.reason || null, total,
    }], { session });
    
    const returnDoc = created[0];

    const returnedByProduct = new Map<string, { quantity: number; cost: number; product: { stockOnHand: number; purchasePrice: number } }>();
    
    for (const line of lines) {
      await PurchaseReturnItem.create([{
        returnId: returnDoc._id, purchaseItemId: line.item._id, unitId: line.item.unitId,
        quantity: line.quantity, baseQuantity: line.baseQuantity, unitCost: line.item.unitCost, lineTotal: line.total,
      }], { session });
      
      // Update inventory batches
      let remaining = line.baseQuantity;
      const batches = await InventoryBatch.find({ 
        purchaseItemId: line.item._id, 
        availableQuantity: { $gt: 0 } 
      })
      .sort({ expiresAt: 1, createdAt: 1 })
      .session(session)
      .lean();
      
      for (const batch of batches) {
        if (remaining <= 0) break;
        const allocation = Math.min(batch.availableQuantity, remaining);
        await InventoryBatch.findByIdAndUpdate(
          batch._id,
          { $inc: { availableQuantity: -allocation } },
          { session }
        );
        remaining -= allocation;
      }
      
      if (remaining > 0) {
        throw new PurchaseReturnError("Some of this purchase's stock has already been sold or adjusted and cannot be returned to the supplier.");
      }
      
      const product = await Product.findById(line.item.productId).select("stockOnHand purchasePrice").session(session).lean();
      const aggregate = returnedByProduct.get(line.item.productId) ?? {
        quantity: 0, cost: 0, product: product!,
      };
      aggregate.quantity += line.baseQuantity;
      aggregate.cost += line.inventoryCost;
      returnedByProduct.set(line.item.productId, aggregate);
    }
    
    for (const [productId, aggregate] of returnedByProduct) {
      if (aggregate.product.stockOnHand < aggregate.quantity) {
        throw new PurchaseReturnError("Not enough remaining stock for this supplier return.");
      }
      
      const remainingStock = aggregate.product.stockOnHand - aggregate.quantity;
      const remainingValue = aggregate.product.stockOnHand * aggregate.product.purchasePrice - aggregate.cost;
      const newCost = remainingStock > 0 && remainingValue > 0
        ? parseFloat((remainingValue / remainingStock).toFixed(6))
        : aggregate.product.purchasePrice;
      
      await Product.findByIdAndUpdate(
        productId,
        { stockOnHand: remainingStock, purchasePrice: newCost },
        { session }
      );
      
      await StockMovement.create([{
        productId, actorId: guard.user.id, direction: "OUT", reason: "SUPPLIER_RETURN",
        quantity: aggregate.quantity, balanceAfter: remainingStock,
        costPerBaseUnit: parseFloat((aggregate.cost / aggregate.quantity).toFixed(6)),
        sourceType: "purchase_return", sourceId: returnDoc._id,
        note: parsed.data.reason ? `${returnNumber} · ${parsed.data.reason}` : returnNumber,
      }], { session });
    }
    
    if (refundAmount > 0 && refundMethod) {
      await PurchasePayment.create([{
        purchaseId: purchase._id, methodId: refundMethod._id, madeById: guard.user.id, 
        amount: -refundAmount, notes: `Refund for ${returnNumber}`
      }], { session });
    }
    
    // Check if all items returned
    const completedReturns = await PurchaseReturnItem.find({
      returnId: { $in: (await PurchaseReturn.find({ purchaseId, status: ReturnStatus.COMPLETED }).distinct("_id").session(session)) }
    }).session(session).lean();
    
    const returnedByItem = new Map<string, number>();
    for (const returned of completedReturns) {
      returnedByItem.set(returned.purchaseItemId, (returnedByItem.get(returned.purchaseItemId) ?? 0) + returned.baseQuantity);
    }
    
    const allItemsReturned = purchaseItems.every((item) => (returnedByItem.get(item._id) ?? 0) >= item.baseQuantity);
    const remainingTotal = money(purchase.total - total);
    
    await Purchase.findByIdAndUpdate(purchase._id, {
      total: remainingTotal,
      paidAmount: purchase.paidAmount - refundAmount,
      dueAmount: purchase.dueAmount - dueReduction,
      status: allItemsReturned ? PurchaseStatus.RETURNED : PurchaseStatus.PARTIALLY_RETURNED,
    }, { session });
    
    await AuditLog.create([{
      actorId: guard.user.id, action: "purchase.returned", entityType: "purchase_return", entityId: returnDoc._id,
      metadata: { returnNumber, total: total.toFixed(2), refundAmount: refundAmount.toFixed(2) },
    }], { session });
    
    await session.commitTransaction();
    
    // Fetch complete return for response
    const [items, purchaseData] = await Promise.all([
      PurchaseReturnItem.find({ returnId: returnDoc._id }).lean(),
      Purchase.findById(purchase._id).lean()
    ]);
    
    return NextResponse.json({ purchaseReturn: { ...returnDoc.toObject(), items, purchase: purchaseData } }, { status: 201 });
  } catch (error) {
    await session.abortTransaction();
    
    if (parsed.data.clientRequestId && error && typeof error === "object" && "code" in error && error.code === 11000) {
      const replay = await replayPurchaseReturn(parsed.data.clientRequestId, guard.user.id);
      if (replay) return replay;
    }
    if (error instanceof PurchaseReturnError) return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    throw error;
  } finally {
    session.endSession();
  }
}

class PurchaseReturnError extends Error {}
