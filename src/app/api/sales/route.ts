import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { DiscountType, Permission, SaleStatus } from "@/types";
import { authorized, authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Sale, { ISale } from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import SalePayment from "@/models/SalePayment";
import Customer from "@/models/Customer";
import Product from "@/models/Product";
import ProductUnit from "@/models/ProductUnit";
import Unit from "@/models/Unit";
import InventoryBatch from "@/models/InventoryBatch";
import SaleItemBatch from "@/models/SaleItemBatch";
import StockMovement from "@/models/StockMovement";
import PaymentMethod from "@/models/PaymentMethod";
import AuditLog from "@/models/AuditLog";
import Settings from "@/models/Settings";
import User from "@/models/User";
import { invalidBody } from "@/lib/http/api-response";
import { apiError } from "@/lib/http/api-response";
import { saleSchema } from "@/lib/validation/api";
import { usesWholeQuantity } from "@/lib/quantity";
import { reportDateRange } from "@/lib/date-time";
import { z } from "zod";

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

function money(value: number) {
  return parseFloat(value.toFixed(2));
}

async function replaySaleResponse(clientRequestId: string, actorId: string) {
  const prior = await Sale.findOne({ clientRequestId }).lean() as ISale | null;
  if (!prior) return null;
  if (prior.createdById !== actorId) {
    return apiError(409, "CONFLICT", "This checkout request key has already been used.");
  }
  
  // Populate related data
  const [items, payments, customer] = await Promise.all([
    SaleItem.find({ saleId: prior._id }).lean(),
    SalePayment.find({ saleId: prior._id }).lean(),
    prior.customerId ? Customer.findById(prior.customerId).lean() : null
  ]);
  
  return NextResponse.json({ sale: { ...prior, id: prior._id, items, payments: payments.map(p => ({ ...p, id: p._id })), customer }, alreadyProcessed: true });
}

export async function GET(request: Request) {
  const guard = await authorizedAny([Permission.VIEW_REPORTS, Permission.CREATE_SALES]);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const customerId = searchParams.get("customerId");
  if (customerId && !z.uuid().safeParse(customerId).success) return apiError(400, "BAD_REQUEST", "Invalid customer ID.");
  
  const settings = await Settings.findById("shop").select("timezone").lean();
  let dateRange;
  try { dateRange = reportDateRange(from, to, settings?.timezone ?? "America/New_York"); }
  catch (error) { return apiError(400, "BAD_REQUEST", error instanceof Error ? error.message : "Invalid date range."); }
  
  const sales = await Sale.find({
    status: { $in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED] },
    ...(customerId ? { customerId } : {}),
    ...(dateRange ? { soldAt: dateRange } : {}),
  })
  .sort({ soldAt: -1 })
  .limit(200)
  .lean();
  
  // Populate related data manually
  const customerIds = [...new Set(sales.map(s => s.customerId).filter(Boolean))];
  const userIds = [...new Set(sales.map(s => s.createdById))];
  const [users, saleItems, salePayments] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("_id fullName").lean(),
    SaleItem.find({ saleId: { $in: sales.map(s => s._id) } }).lean(),
    SalePayment.find({ saleId: { $in: sales.map(s => s._id) } }).lean()
  ]);
  
  const customers = customerIds.length > 0 ? await Customer.find({ _id: { $in: customerIds } }).lean() : [];
  
  const customerMap = new Map(customers.map(c => [c._id, c]));
  const userMap = new Map(users.map(u => [u._id, u]));
  const itemsBySale = new Map<string, any[]>();
  const paymentsBySale = new Map<string, any[]>();
  
  saleItems.forEach(item => {
    const existing = itemsBySale.get(item.saleId) || [];
    existing.push(item);
    itemsBySale.set(item.saleId, existing);
  });
  
  salePayments.forEach(payment => {
    const existing = paymentsBySale.get(payment.saleId) || [];
    existing.push({ ...payment, id: payment._id });
    paymentsBySale.set(payment.saleId, existing);
  });
  
  const salesWithRelations = sales.map(sale => ({
    ...sale,
    customer: sale.customerId ? customerMap.get(sale.customerId) || null : null,
    createdBy: userMap.get(sale.createdById) || null,
    items: itemsBySale.get(sale._id) || [],
    payments: paymentsBySale.get(sale._id) || []
  }));
  
  const salesWithId = salesWithRelations.map(sale => ({ ...sale, id: sale._id }));
  
  return NextResponse.json({ sales: salesWithId });
}

export async function POST(request: Request) {
  const guard = await authorized(Permission.CREATE_SALES);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  const input = parsed.data;
  
  // Check discount permission
  if (input.discountType && input.discountValue && parseDecimalString(input.discountValue) > 0
      && !guard.user.rolePermissions.some((entry) => entry.permission === Permission.APPLY_DISCOUNTS)) {
    return apiError(403, "FORBIDDEN", "You do not have permission to apply discounts.");
  }

  // Repeated online checkout requests reuse this key so a lost response cannot create duplicate invoices.
  if (input.clientRequestId) {
    const replay = await replaySaleResponse(input.clientRequestId, guard.user.id);
    if (replay) return replay;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;
  
  try {
    const settings = await Settings.findById("shop").session(session);
    if (!settings) throw new Error("Shop settings have not been initialized.");

    const customer = input.customerId
      ? await Customer.findOne({ _id: input.customerId, isActive: true }).session(session).lean()
      : null;
    if (input.customerId && !customer) throw new SaleInputError("Customer was not found.");

    const lines: Array<{
      productId: string; unitId: string; productName: string; skuSnapshot: string;
      quantity: number; conversion: number; baseQuantity: number;
      unitPrice: number; cost: number; lineTotal: number;
      tracksBatch: boolean; tracksExpiry: boolean;
    }> = [];
    let subtotal = 0;

    for (const line of input.items) {
      const product = await Product.findById(line.productId).session(session).lean();
      if (!product || !product.isActive) throw new SaleInputError("One of the selected products is unavailable.");
      
      const quantity = parseDecimalString(line.quantity);
      
      // Get unit info
      let selectedUnit;
      let conversion = 1;
      if (line.unitId === product.baseUnitId) {
        const baseUnit = await Unit.findById(product.baseUnitId).session(session).lean();
        selectedUnit = baseUnit;
        conversion = 1;
      } else {
        const productUnit = await ProductUnit.findOne({ productId: product._id, unitId: line.unitId }).session(session).populate("unitId").lean();
        selectedUnit = productUnit?.unitId;
        conversion = productUnit?.conversionToBase || 0;
      }
      
      if (conversion <= 0) throw new SaleInputError("A selected unit is not configured for this product.");
      if (selectedUnit && usesWholeQuantity(selectedUnit.name, selectedUnit.symbol) && !Number.isInteger(quantity)) {
        throw new SaleInputError("Counted units must be sold in whole-number quantities.");
      }
      if (selectedUnit && !usesWholeQuantity(selectedUnit.name, selectedUnit.symbol) && quantity.toString().split('.')[1]?.length > 2) {
        throw new SaleInputError("Measured quantities can have at most two decimal places.");
      }
      
      const baseQuantity = parseFloat((quantity * conversion).toFixed(6));
      const sellingPriceNum = toNumber(product.sellingPrice);
      const purchasePriceNum = toNumber(product.purchasePrice);
      const overridePrice = line.unitPrice !== undefined ? parseDecimalString(line.unitPrice) : null;
      const unitPrice = overridePrice !== null ? overridePrice : parseFloat((sellingPriceNum * conversion).toFixed(4));
      const lineTotal = money(unitPrice * quantity);
      subtotal += lineTotal;
      
      lines.push({
        productId: product._id,
        unitId: line.unitId,
        productName: product.name,
        skuSnapshot: product.sku,
        quantity,
        conversion,
        baseQuantity,
        unitPrice,
        cost: purchasePriceNum,
        lineTotal,
        tracksBatch: product.tracksBatch,
        tracksExpiry: product.tracksExpiry,
      });
    }

    const discountType = input.discountType ?? null;
    const discountValue = input.discountValue ? parseDecimalString(input.discountValue) : 0;
    if (discountType === DiscountType.PERCENTAGE && discountValue > 100) {
      throw new SaleInputError("Discount percentage cannot be greater than 100.");
    }
    const discountAmount = discountType === DiscountType.PERCENTAGE
      ? money(subtotal * discountValue / 100)
      : discountType === DiscountType.FIXED_AMOUNT ? money(discountValue) : 0;
    if (discountAmount > subtotal) throw new SaleInputError("Discount cannot exceed the sale subtotal.");
    
    const total = money(subtotal - discountAmount);
    const paidAmount = money(parseDecimalString(input.paidAmount));
    if (paidAmount > total) throw new SaleInputError("Payment cannot exceed the invoice total.");
    const dueAmount = money(total - paidAmount);
    if (dueAmount > 0 && (!customer || !customer.phoneE164)) {
      throw new SaleInputError("Select a customer with a phone number before saving a sale with a balance due.");
    }
    if (paidAmount > 0) {
      if (!input.paymentMethodId) throw new SaleInputError("Select a payment method for the amount received.");
      const method = await PaymentMethod.findOne({ _id: input.paymentMethodId, isEnabled: true }).session(session).lean();
      if (!method) throw new SaleInputError("The selected payment method is unavailable.");
    }

    const invoiceNumber = `${settings.saleInvoicePrefix}-${String(settings.nextSaleNumber).padStart(6, "0")}`;
    await Settings.findByIdAndUpdate(settings._id, { $inc: { nextSaleNumber: 1 } }).session(session);
    
    const createdSale = await Sale.create([{
      invoiceNumber,
      clientRequestId: input.clientRequestId,
      customerId: customer?._id ?? null,
      createdById: guard.user.id,
      status: SaleStatus.COMPLETED,
      subtotal: money(subtotal),
      discountType,
      discountValue,
      discountAmount,
      total,
      paidAmount,
      dueAmount,
      notes: input.notes || null,
    }], { session });
    
    const saleDoc = createdSale[0];

    // Update stock and create movements
    const quantities = new Map<string, number>();
    for (const line of lines) {
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.baseQuantity);
    }
    
    for (const [productId, baseQuantity] of quantities) {
      const result = await Product.updateMany(
        { _id: productId, isActive: true, stockOnHand: { $gte: baseQuantity } },
        { $inc: { stockOnHand: -baseQuantity } },
        { session }
      );
      if (result.modifiedCount !== 1) throw new SaleInputError("Not enough stock to complete this sale.");
      
      const updatedProduct = await Product.findById(productId).select("stockOnHand").session(session).lean();
      const item = lines.find((entry) => entry.productId === productId)!;
      
      await StockMovement.create([{
        productId,
        actorId: guard.user.id,
        direction: "OUT",
        reason: "SALE",
        quantity: baseQuantity,
        balanceAfter: updatedProduct!.stockOnHand,
        costPerBaseUnit: item.cost,
        sourceType: "sale",
        sourceId: saleDoc._id,
      }], { session });
    }

    // Create sale items
    const createdItems: Array<{ saleItem: any; tracksExpiry: boolean }> = [];
    for (const line of lines) {
      const saleItem = await SaleItem.create([{
        saleId: saleDoc._id,
        productId: line.productId,
        unitId: line.unitId,
        productName: line.productName,
        skuSnapshot: line.skuSnapshot,
        quantity: line.quantity,
        conversionToBase: line.conversion,
        baseQuantity: line.baseQuantity,
        unitPrice: line.unitPrice,
        costPerBaseUnit: line.cost,
        lineTotal: line.lineTotal,
      }], { session });
      createdItems.push({ saleItem: saleItem[0], tracksExpiry: line.tracksExpiry });
    }
    
    // Handle batch allocations (FIFO)
    const fifoCosts = new Map<string, number>();
    const sortCriteria = settings.costingMethod === "FIFO"
      ? { createdAt: "asc" as const, expiresAt: "asc" as const }
      : { expiresAt: "asc" as const, createdAt: "asc" as const };
    
    for (const { saleItem, tracksExpiry } of createdItems) {
      let remaining = saleItem.baseQuantity;
      
      const batches = await InventoryBatch.find({
        productId: saleItem.productId,
        availableQuantity: { $gt: 0 },
        ...(tracksExpiry ? { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] } : {}),
      })
      .sort(sortCriteria)
      .session(session)
      .lean();
      
      let allocatedCost = 0;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const batchAvailable = toNumber(batch.availableQuantity);
        const allocation = Math.min(batchAvailable, remaining);
        
        const result = await InventoryBatch.updateMany(
          { _id: batch._id, availableQuantity: { $gte: allocation } },
          { $inc: { availableQuantity: -allocation } },
          { session }
        );
        if (result.modifiedCount !== 1) throw new SaleInputError("Stock changed while completing the sale. Please try again.");
        
        await SaleItemBatch.create([{
          saleItemId: saleItem._id,
          inventoryBatchId: batch._id,
          quantity: allocation,
        }], { session });
        
        allocatedCost += allocation * batch.costPerBaseUnit;
        remaining -= allocation;
      }
      if (remaining > 0) throw new SaleInputError("Batch stock is not available for one of the selected products.");
      fifoCosts.set(saleItem._id, parseFloat((allocatedCost / saleItem.baseQuantity).toFixed(6)));
    }
    
    if (settings.costingMethod === "FIFO") {
      for (const { saleItem } of createdItems) {
        await SaleItem.findByIdAndUpdate(
          saleItem._id,
          { costPerBaseUnit: fifoCosts.get(saleItem._id)! },
          { session }
        );
      }
      for (const [productId, baseQuantity] of quantities) {
        const productItems = createdItems.filter(({ saleItem }) => saleItem.productId === productId);
        const totalCost = productItems.reduce((sum, { saleItem }) => {
          return sum + saleItem.baseQuantity * fifoCosts.get(saleItem._id)!;
        }, 0);
        await StockMovement.updateMany(
          { productId, sourceType: "sale", sourceId: saleDoc._id },
          { costPerBaseUnit: parseFloat((totalCost / baseQuantity).toFixed(6)) },
          { session }
        );
      }
    }
    
    if (paidAmount > 0) {
      await SalePayment.create([{
        saleId: saleDoc._id,
        methodId: input.paymentMethodId!,
        collectedById: guard.user.id,
        amount: paidAmount,
        reference: input.paymentReference || null,
      }], { session });
    }
    
    await AuditLog.create([{
      _id: randomUUID(),
      actorId: guard.user.id,
      action: "sale.completed",
      entityType: "sale",
      entityId: saleDoc._id,
      metadata: { invoiceNumber, total: total.toFixed(2), dueAmount: dueAmount.toFixed(2) },
    }], { session });
    
    await session.commitTransaction();
    committed = true;
    
    // Fetch complete sale for response
    const [items, payments, customerData] = await Promise.all([
      SaleItem.find({ saleId: saleDoc._id }).lean(),
      SalePayment.find({ saleId: saleDoc._id }).lean(),
      saleDoc.customerId ? Customer.findById(saleDoc.customerId).lean() : null
    ]);
    
    return NextResponse.json({ sale: { ...saleDoc.toObject(), id: saleDoc._id, items, payments: payments.map(p => ({ ...p, id: p._id })), customer: customerData } }, { status: 201 });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    
    if (input.clientRequestId && error && typeof error === "object" && "code" in error && error.code === 11000) {
      const replay = await replaySaleResponse(input.clientRequestId, guard.user.id);
      if (replay) return replay;
    }
    if (error instanceof SaleInputError) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    }
    throw error;
  } finally {
    session.endSession();
  }
}

class SaleInputError extends Error {}
