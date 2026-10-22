import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Permission, ReturnStatus, SaleStatus } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Sale, { ISale } from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import SaleReturn, { ISaleReturn } from "@/models/SaleReturn";
import SaleReturnItem from "@/models/SaleReturnItem";
import Product from "@/models/Product";
import InventoryBatch from "@/models/InventoryBatch";
import StockMovement from "@/models/StockMovement";
import PaymentMethod from "@/models/PaymentMethod";
import SalePayment from "@/models/SalePayment";
import AuditLog from "@/models/AuditLog";
import Unit from "@/models/Unit";
import { invalidBody } from "@/lib/http/api-response";
import { saleReturnSchema as schema } from "@/lib/validation/api";
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

async function replaySaleReturn(clientRequestId: string, actorId: string) {
  const prior = await SaleReturn.findOne({ clientRequestId }).lean() as ISaleReturn | null;
  if (!prior) return null;
  if (prior.createdById !== actorId) return NextResponse.json({ error: { code: "CONFLICT", message: "This return request key has already been used." } }, { status: 409 });
  
  // Populate related data
  const [items, sale] = await Promise.all([
    SaleReturnItem.find({ returnId: prior._id }).lean(),
    Sale.findById(prior.saleId).lean()
  ]);
  
  return NextResponse.json({ saleReturn: { ...prior, items, sale }, alreadyProcessed: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const guard = await authorized(Permission.PROCESS_RETURNS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { saleId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  if (parsed.data.clientRequestId) {
    const replay = await replaySaleReturn(parsed.data.clientRequestId, guard.user.id);
    if (replay) return replay;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const sale = await Sale.findById(saleId).session(session).lean() as ISale | null;
    if (!sale || (sale.status !== SaleStatus.COMPLETED && sale.status !== SaleStatus.PARTIALLY_RETURNED)) {
      throw new ReturnError("Only an active sale can receive a return.");
    }
    
    // Get sale items with units
    const saleItems = await SaleItem.find({ saleId }).session(session).lean();
    const unitIds = [...new Set(saleItems.map(i => i.unitId))];
    const units = await Unit.find({ _id: { $in: unitIds } }).session(session).lean();
    const unitMap = new Map(units.map(u => [u._id, u]));
    
    const returnLines: Array<{
      item: any; product: { tracksBatch: boolean; tracksExpiry: boolean; stockOnHand: number };
      quantity: number; baseQuantity: number; amount: number;
      batchNumber: string | null; expiresAt: Date | null;
    }> = [];
    let total = 0;
    
    for (const requested of parsed.data.items) {
      const item = saleItems.find((entry) => entry._id === requested.saleItemId);
      if (!item) throw new ReturnError("A selected sale item does not belong to this invoice.");
      
      const quantity = parseDecimalString(requested.quantity);
      const unit = unitMap.get(item.unitId);
      if (usesWholeQuantity(unit!.name, unit!.symbol) && !Number.isInteger(quantity)) {
        throw new ReturnError("Return quantities for counted units must be whole numbers.");
      }
      if (!usesWholeQuantity(unit!.name, unit!.symbol) && quantity.toString().split('.')[1]?.length > 2) {
        throw new ReturnError("Measured return quantities can have at most two decimal places.");
      }
      
      // Calculate previously returned quantity
      const previousReturns = await SaleReturnItem.find({ 
        saleItemId: item._id,
        returnId: { $in: await SaleReturn.find({ saleId, status: ReturnStatus.COMPLETED }).distinct("_id").session(session) }
      }).session(session).lean();
      
      const baseQuantity = parseFloat((quantity * item.conversionToBase).toFixed(6));
      const alreadyReturned = previousReturns.reduce((sum: number, ret: any) => sum + toNumber(ret.baseQuantity), 0);
      if (alreadyReturned + baseQuantity > item.baseQuantity) throw new ReturnError("Return quantity exceeds the quantity sold.");
      
      const product = await Product.findById(item.productId).select("tracksBatch tracksExpiry stockOnHand").session(session).lean();
      if (product!.tracksBatch && !requested.batchNumber) throw new ReturnError("A batch number is required for this product return.");
      if (product!.tracksExpiry && !requested.expiresAt) throw new ReturnError("An expiry date is required for this product return.");
      
      const gross = money(item.unitPrice * quantity);
      const discountShare = sale.subtotal > 0 ? sale.discountAmount * gross / sale.subtotal : 0;
      const lineAmount = money(gross - discountShare);
      total += lineAmount;
      
      returnLines.push({
        item, product: product!, quantity, baseQuantity, amount: lineAmount,
        batchNumber: requested.batchNumber || null,
        expiresAt: requested.expiresAt ? new Date(requested.expiresAt) : null,
      });
    }
    
    total = money(total);
    if (total < 0 || total > sale.total) throw new ReturnError("Return amount is not valid for this invoice.");
    const dueReduction = Math.min(sale.dueAmount, total);
    const refundAmount = money(total - dueReduction);
    
    let refundMethod = null;
    if (refundAmount > 0) {
      if (!parsed.data.refundMethodId) throw new ReturnError("Choose a payment method for the customer refund.");
      refundMethod = await PaymentMethod.findOne({ _id: parsed.data.refundMethodId, isEnabled: true }).session(session).lean();
      if (!refundMethod) throw new ReturnError("The selected refund method is unavailable.");
    }

    const returnNumber = `SR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await SaleReturn.create([{
      clientRequestId: parsed.data.clientRequestId,
      returnNumber, saleId: sale._id, createdById: guard.user.id, status: ReturnStatus.COMPLETED,
      reason: parsed.data.reason || null, total, refundAmount,
    }], { session });
    
    const returnDoc = created[0];
    
    for (const line of returnLines) {
      await SaleReturnItem.create([{
        returnId: returnDoc._id, saleItemId: line.item._id, unitId: line.item.unitId,
        quantity: line.quantity, baseQuantity: line.baseQuantity,
        unitAmount: line.item.unitPrice, lineTotal: line.amount,
      }], { session });
      
      await Product.findByIdAndUpdate(
        line.item.productId,
        { $inc: { stockOnHand: line.baseQuantity } },
        { session }
      );
      
      await InventoryBatch.create([{
        productId: line.item.productId, batchNumber: line.batchNumber, expiresAt: line.expiresAt,
        receivedQuantity: line.baseQuantity, availableQuantity: line.baseQuantity,
        costPerBaseUnit: line.item.costPerBaseUnit,
      }], { session });
      
      const updatedProduct = await Product.findById(line.item.productId).select("stockOnHand").session(session).lean();
      await StockMovement.create([{
        productId: line.item.productId, actorId: guard.user.id, direction: "IN", reason: "CUSTOMER_RETURN",
        quantity: line.baseQuantity, balanceAfter: updatedProduct!.stockOnHand,
        costPerBaseUnit: line.item.costPerBaseUnit, sourceType: "sale_return", sourceId: returnDoc._id,
        note: parsed.data.reason ? `${returnNumber} · ${parsed.data.reason}` : returnNumber,
      }], { session });
    }
    
    if (refundAmount > 0 && refundMethod) {
      await SalePayment.create([{
        saleId: sale._id, methodId: refundMethod._id, collectedById: guard.user.id,
        amount: -refundAmount, notes: `Refund for ${returnNumber}`,
      }], { session });
    }
    
    // Check if all items returned
    const completedReturns = await SaleReturnItem.find({
      returnId: { $in: (await SaleReturn.find({ saleId, status: ReturnStatus.COMPLETED }).distinct("_id").session(session)) }
    }).session(session).lean();
    
    const returnedByItem = new Map<string, number>();
    for (const returned of completedReturns) {
      returnedByItem.set(returned.saleItemId, (returnedByItem.get(returned.saleItemId) ?? 0) + returned.baseQuantity);
    }
    
    const allItemsReturned = saleItems.every((item) => (returnedByItem.get(item._id) ?? 0) >= item.baseQuantity);
    const remainingTotal = money(sale.total - total);
    
    await Sale.findByIdAndUpdate(sale._id, {
      total: remainingTotal,
      paidAmount: sale.paidAmount - refundAmount,
      dueAmount: sale.dueAmount - dueReduction,
      status: allItemsReturned ? SaleStatus.RETURNED : SaleStatus.PARTIALLY_RETURNED,
    }, { session });
    
    await AuditLog.create([{
      actorId: guard.user.id, action: "sale.returned", entityType: "sale_return", entityId: returnDoc._id,
      metadata: { returnNumber, total: total.toFixed(2), refundAmount: refundAmount.toFixed(2) },
    }], { session });
    
    await session.commitTransaction();
    
    // Fetch complete return for response
    const [items, saleData] = await Promise.all([
      SaleReturnItem.find({ returnId: returnDoc._id }).lean(),
      Sale.findById(sale._id).lean()
    ]);
    
    return NextResponse.json({ saleReturn: { ...returnDoc.toObject(), items, sale: saleData } }, { status: 201 });
  } catch (error) {
    await session.abortTransaction();
    
    if (parsed.data.clientRequestId && error && typeof error === "object" && "code" in error && error.code === 11000) {
      const replay = await replaySaleReturn(parsed.data.clientRequestId, guard.user.id);
      if (replay) return replay;
    }
    if (error instanceof ReturnError) return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    throw error;
  } finally {
    session.endSession();
  }
}

class ReturnError extends Error {}
