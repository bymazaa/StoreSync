import { NextResponse } from "next/server";
import { DiscountType, Permission, PurchaseStatus } from "@/types";
import { authorized, authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Purchase, { IPurchase } from "@/models/Purchase";
import PurchaseItem from "@/models/PurchaseItem";
import PurchasePayment from "@/models/PurchasePayment";
import Supplier from "@/models/Supplier";
import Product from "@/models/Product";
import ProductUnit from "@/models/ProductUnit";
import Unit from "@/models/Unit";
import InventoryBatch from "@/models/InventoryBatch";
import StockMovement from "@/models/StockMovement";
import PaymentMethod from "@/models/PaymentMethod";
import AuditLog from "@/models/AuditLog";
import Settings from "@/models/Settings";
import User from "@/models/User";
import { invalidBody } from "@/lib/http/api-response";
import { apiError } from "@/lib/http/api-response";
import { purchaseSchema } from "@/lib/validation/api";
import { usesWholeQuantity } from "@/lib/quantity";
import { z } from "zod";
import { reportDateRange } from "@/lib/date-time";

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

async function replayPurchaseResponse(clientRequestId: string, actorId: string) {
  const prior = await Purchase.findOne({ clientRequestId }).lean() as IPurchase | null;
  if (!prior) return null;
  if (prior.createdById !== actorId) return apiError(409, "CONFLICT", "This purchase request key has already been used.");
  
  // Populate related data
  const [items, payments, supplier] = await Promise.all([
    PurchaseItem.find({ purchaseId: prior._id }).lean(),
    PurchasePayment.find({ purchaseId: prior._id }).lean(),
    prior.supplierId ? Supplier.findById(prior.supplierId).lean() : null
  ]);
  
  return NextResponse.json({ purchase: { ...prior, id: prior._id, items, payments: payments.map(p => ({ ...p, id: p._id })), supplier }, alreadyProcessed: true });
}

export async function GET(request: Request) {
  const guard = await authorizedAny([Permission.VIEW_REPORTS, Permission.CREATE_PURCHASES]);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const supplierId = searchParams.get("supplierId");
  if (supplierId && !z.uuid().safeParse(supplierId).success) return apiError(400, "BAD_REQUEST", "Invalid supplier ID.");
  
  const settings = await Settings.findById("shop").select("timezone").lean();
  let dateRange;
  try { dateRange = reportDateRange(from, to, settings?.timezone ?? "America/New_York"); }
  catch (error) { return apiError(400, "BAD_REQUEST", error instanceof Error ? error.message : "Invalid date range."); }
  
  const purchases = await Purchase.find({
    status: { $in: [PurchaseStatus.COMPLETED, PurchaseStatus.PARTIALLY_RETURNED] },
    ...(supplierId ? { supplierId } : {}),
    ...(dateRange ? { purchasedAt: dateRange } : {}),
  })
  .sort({ purchasedAt: -1 })
  .limit(200)
  .lean();
  
  // Populate related data manually
  const supplierIds = [...new Set(purchases.map(p => p.supplierId).filter(Boolean))];
  const userIds = [...new Set(purchases.map(p => p.createdById))];
  const [users, purchaseItems, purchasePayments] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("_id fullName").lean(),
    PurchaseItem.find({ purchaseId: { $in: purchases.map(p => p._id) } }).lean(),
    PurchasePayment.find({ purchaseId: { $in: purchases.map(p => p._id) } }).lean()
  ]);
  
  const suppliers = supplierIds.length > 0 ? await Supplier.find({ _id: { $in: supplierIds } }).lean() : [];
  
  const supplierMap = new Map(suppliers.map(s => [s._id, s]));
  const userMap = new Map(users.map(u => [u._id, u]));
  const itemsByPurchase = new Map<string, any[]>();
  const paymentsByPurchase = new Map<string, any[]>();
  
  purchaseItems.forEach(item => {
    const existing = itemsByPurchase.get(item.purchaseId) || [];
    existing.push(item);
    itemsByPurchase.set(item.purchaseId, existing);
  });
  
  purchasePayments.forEach(payment => {
    const existing = paymentsByPurchase.get(payment.purchaseId) || [];
    existing.push({ ...payment, id: payment._id });
    paymentsByPurchase.set(payment.purchaseId, existing);
  });
  
  const purchasesWithRelations = purchases.map(purchase => ({
    ...purchase,
    supplier: purchase.supplierId ? supplierMap.get(purchase.supplierId) || null : null,
    createdBy: userMap.get(purchase.createdById) || null,
    items: itemsByPurchase.get(purchase._id) || [],
    payments: paymentsByPurchase.get(purchase._id) || []
  }));
  
  const purchasesWithId = purchasesWithRelations.map(purchase => ({ ...purchase, id: purchase._id }));
  
  return NextResponse.json({ purchases: purchasesWithId });
}

export async function POST(request: Request) {
  const guard = await authorized(Permission.CREATE_PURCHASES);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  if (!guard.user.rolePermissions.some((entry) => entry.permission === Permission.COMPLETE_PURCHASES)) {
    return apiError(403, "FORBIDDEN", "You do not have permission to complete purchases.");
  }
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) return invalidPurchaseBody(parsed.error.issues);
  const input = parsed.data;
  
  if (input.clientRequestId) {
    const replay = await replayPurchaseResponse(input.clientRequestId, guard.user.id);
    if (replay) return replay;
  }
  
  if (input.discountType && input.discountValue && parseDecimalString(input.discountValue) > 0
      && !guard.user.rolePermissions.some((entry) => entry.permission === Permission.APPLY_DISCOUNTS)) {
    return apiError(403, "FORBIDDEN", "You do not have permission to apply discounts.");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;
  
  try {
    const settings = await Settings.findById("shop").session(session);
    if (!settings) throw new PurchaseInputError("Shop settings have not been initialized.");
    
    const supplier = await Supplier.findOne({ _id: input.supplierId, isActive: true }).session(session).lean();
    if (!supplier) throw new PurchaseInputError("Supplier was not found.");

    const lines: Array<{
      product: { _id: string; name: string; sku: string; stockOnHand: number; purchasePrice: number; sellingPrice: number; tracksBatch: boolean; tracksExpiry: boolean };
      unitId: string; quantity: number; conversion: number; baseQuantity: number;
      unitCost: number; sellingPrice: number | null; baseCost: number; lineTotal: number;
      batchNumber: string | null; expiresAt: Date | null; trackBatch: boolean; trackExpiry: boolean; landedCostPerBaseUnit?: number;
    }> = [];
    let subtotal = 0;
    
    for (const line of input.items) {
      const product = await Product.findById(line.productId).session(session).lean();
      if (!product || !product.isActive) throw new PurchaseInputError("One of the selected products is unavailable.");
      
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
      
      if (conversion <= 0) throw new PurchaseInputError("A selected unit is not configured for this product.");
      if (selectedUnit && usesWholeQuantity(selectedUnit.name, selectedUnit.symbol) && !Number.isInteger(quantity)) {
        throw new PurchaseInputError("Counted units must be purchased in whole-number quantities.");
      }
      if (selectedUnit && !usesWholeQuantity(selectedUnit.name, selectedUnit.symbol) && quantity.toString().split('.')[1]?.length > 2) {
        throw new PurchaseInputError("Measured quantities can have at most two decimal places.");
      }
      
      const trackBatch = product.tracksBatch || line.trackBatch === true;
      const trackExpiry = product.tracksExpiry || line.trackExpiry === true;
      if (trackBatch && !line.batchNumber) throw new PurchaseInputError(`${product.name} requires a batch number.`);
      if (trackExpiry && !line.expiresAt) throw new PurchaseInputError(`${product.name} requires an expiry date.`);
      
      const unitCost = parseDecimalString(line.unitCost);
      const sellingPrice = parseDecimalString(line.sellingPrice);
      const lineTotal = money(unitCost * quantity);
      subtotal += lineTotal;
      
      lines.push({
        product,
        unitId: line.unitId,
        quantity,
        conversion,
        baseQuantity: parseFloat((quantity * conversion).toFixed(6)),
        unitCost,
        sellingPrice,
        baseCost: parseFloat((unitCost / conversion).toFixed(6)),
        lineTotal,
        batchNumber: line.batchNumber || null,
        expiresAt: line.expiresAt ? new Date(line.expiresAt) : null,
        trackBatch,
        trackExpiry,
      });
    }

    const discountType = input.discountType ?? null;
    const discountValue = input.discountValue ? parseDecimalString(input.discountValue) : 0;
    if (discountType === DiscountType.PERCENTAGE && discountValue > 100) throw new PurchaseInputError("Discount percentage cannot be greater than 100.");
    const discountAmount = discountType === DiscountType.PERCENTAGE
      ? money(subtotal * discountValue / 100)
      : discountType === DiscountType.FIXED_AMOUNT ? money(discountValue) : 0;
    if (discountAmount > subtotal) throw new PurchaseInputError("Discount cannot exceed the purchase subtotal.");
    
    const additionalCost = money(parseDecimalString(input.additionalCost));
    const total = money(subtotal - discountAmount + additionalCost);
    const paidAmount = money(parseDecimalString(input.paidAmount));
    if (paidAmount > total) throw new PurchaseInputError("Payment cannot exceed the invoice total.");
    const dueAmount = money(total - paidAmount);
    if (paidAmount > 0) {
      if (!input.paymentMethodId) throw new PurchaseInputError("Select a payment method for the amount paid.");
      const method = await PaymentMethod.findOne({ _id: input.paymentMethodId, isEnabled: true }).session(session).lean();
      if (!method) throw new PurchaseInputError("The selected payment method is unavailable.");
    }

    const invoiceNumber = `${settings.purchaseInvoicePrefix}-${String(settings.nextPurchaseNumber).padStart(6, "0")}`;
    await Settings.findByIdAndUpdate(settings._id, { $inc: { nextPurchaseNumber: 1 } }).session(session);
    
    const createdPurchase = await Purchase.create([{
      clientRequestId: input.clientRequestId,
      invoiceNumber,
      supplierInvoiceNumber: input.supplierInvoiceNumber || null,
      supplierId: supplier._id,
      createdById: guard.user.id,
      status: PurchaseStatus.COMPLETED,
      subtotal: money(subtotal),
      discountType,
      discountValue,
      discountAmount,
      additionalCost,
      total,
      paidAmount,
      dueAmount,
      notes: input.notes || null,
    }], { session });
    
    const purchaseDoc = createdPurchase[0];

    // Calculate landed costs
    const totalBaseQuantity = lines.reduce((total, line) => total + line.baseQuantity, 0);
    for (const line of lines) {
      const allocation = subtotal > 0
        ? line.lineTotal / subtotal
        : line.baseQuantity / totalBaseQuantity;
      const landedLineTotal = line.lineTotal
        - discountAmount * allocation
        + additionalCost * allocation;
      line.landedCostPerBaseUnit = parseFloat((landedLineTotal / line.baseQuantity).toFixed(6));
    }
    
    // Create purchase items and inventory batches
    for (const line of lines) {
      const landedCostPerBaseUnit = line.landedCostPerBaseUnit!;
      const purchaseItem = await PurchaseItem.create([{
        purchaseId: purchaseDoc._id,
        productId: line.product._id,
        unitId: line.unitId,
        productName: line.product.name,
        skuSnapshot: line.product.sku,
        quantity: line.quantity,
        conversionToBase: line.conversion,
        baseQuantity: line.baseQuantity,
        unitCost: line.unitCost,
        lineTotal: line.lineTotal,
        batchNumber: line.batchNumber,
        expiresAt: line.expiresAt,
      }], { session });
      
      await InventoryBatch.create([{
        productId: line.product._id,
        purchaseItemId: purchaseItem[0]._id,
        batchNumber: line.batchNumber,
        expiresAt: line.expiresAt,
        receivedQuantity: line.baseQuantity,
        availableQuantity: line.baseQuantity,
        costPerBaseUnit: landedCostPerBaseUnit,
      }], { session });
    }

    // Update product stock and create movements
    const inboundByProduct = new Map<string, { 
      quantity: number; 
      inventoryCost: number; 
      sellingPrice: number | null; 
      trackBatch: boolean; 
      trackExpiry: boolean; 
      product: (typeof lines)[number]["product"] 
    }>();
    
    for (const line of lines) {
      const aggregate = inboundByProduct.get(line.product._id) ?? {
        quantity: 0, inventoryCost: 0, sellingPrice: null, trackBatch: false, trackExpiry: false, product: line.product,
      };
      aggregate.quantity += line.baseQuantity;
      aggregate.inventoryCost += line.landedCostPerBaseUnit! * line.baseQuantity;
      aggregate.trackBatch ||= line.trackBatch;
      aggregate.trackExpiry ||= line.trackExpiry;
      aggregate.sellingPrice = line.sellingPrice;
      inboundByProduct.set(line.product._id, aggregate);
    }
    
    for (const [productId, aggregate] of inboundByProduct) {
      const incomingAverageCost = aggregate.inventoryCost / aggregate.quantity;
      const stockOnHandNum = toNumber(aggregate.product.stockOnHand);
      const purchasePriceNum = toNumber(aggregate.product.purchasePrice);
      const newAverageCost = stockOnHandNum === 0
        ? incomingAverageCost
        : parseFloat(((purchasePriceNum * stockOnHandNum + aggregate.inventoryCost) / 
            (stockOnHandNum + aggregate.quantity)).toFixed(6));
      
      const result = await Product.updateMany(
        { _id: productId, isActive: true },
        {
          $inc: { stockOnHand: aggregate.quantity },
          purchasePrice: newAverageCost,
          sellingPrice: aggregate.sellingPrice ?? aggregate.product.sellingPrice,
          tracksBatch: aggregate.trackBatch || aggregate.product.tracksBatch,
          tracksExpiry: aggregate.trackExpiry || aggregate.product.tracksExpiry,
        },
        { session }
      );
      if (result.modifiedCount !== 1) throw new PurchaseInputError("Stock could not be updated for a selected product.");
      
      const updatedProduct = await Product.findById(productId).select("stockOnHand").session(session).lean();
      await StockMovement.create([{
        productId,
        actorId: guard.user.id,
        direction: "IN",
        reason: "PURCHASE",
        quantity: aggregate.quantity,
        balanceAfter: updatedProduct!.stockOnHand,
        costPerBaseUnit: incomingAverageCost,
        sourceType: "purchase",
        sourceId: purchaseDoc._id,
      }], { session });
    }
    
    if (paidAmount > 0) {
      await PurchasePayment.create([{
        purchaseId: purchaseDoc._id,
        methodId: input.paymentMethodId!,
        madeById: guard.user.id,
        amount: paidAmount,
        reference: input.paymentReference || null,
      }], { session });
    }
    
    await AuditLog.create([{
      actorId: guard.user.id,
      action: "purchase.completed",
      entityType: "purchase",
      entityId: purchaseDoc._id,
      metadata: { invoiceNumber, total: total.toFixed(2), dueAmount: dueAmount.toFixed(2) },
    }], { session });
    
    await session.commitTransaction();
    committed = true;
    
    // Fetch complete purchase for response
    const [items, paymentDocs, supplierData] = await Promise.all([
      PurchaseItem.find({ purchaseId: purchaseDoc._id }).lean(),
      PurchasePayment.find({ purchaseId: purchaseDoc._id }).lean(),
      Supplier.findById(purchaseDoc.supplierId).lean()
    ]);
    const methodIds = [...new Set(paymentDocs.map((payment) => payment.methodId).filter(Boolean))] as string[];
    const methods = await PaymentMethod.find({ _id: { $in: methodIds } }).lean();
    const methodMap = new Map(methods.map((method) => [method._id, method]));
    const payments = paymentDocs.map((payment) => ({ ...payment, id: payment._id, method: payment.methodId ? methodMap.get(payment.methodId) ?? null : null }));
    
    return NextResponse.json({ purchase: { ...purchaseDoc.toObject(), id: purchaseDoc._id, items, payments, supplier: supplierData } }, { status: 201 });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    
    if (input.clientRequestId && error && typeof error === "object" && "code" in error && error.code === 11000) {
      const replay = await replayPurchaseResponse(input.clientRequestId, guard.user.id);
      if (replay) return replay;
    }
    if (error instanceof PurchaseInputError) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    }
    throw error;
  } finally {
    session.endSession();
  }
}

class PurchaseInputError extends Error {}

function invalidPurchaseBody(issues: z.ZodIssue[]) {
  const issue = issues[0];
  const [field, , itemField] = issue?.path ?? [];
  const fieldName = String(field ?? "");
  const itemName = String(itemField ?? "");

  let message = "Check the purchase details and try again.";
  if (fieldName === "supplierId") message = "Choose a supplier or enter a supplier name.";
  else if (fieldName === "supplierInvoiceNumber") message = "Supplier invoice number must be 100 characters or fewer.";
  else if (fieldName === "items" && issue?.path.length === 1) message = "Add at least one product to this purchase.";
  else if (fieldName === "items" && itemName === "productId") message = "Choose a product from the product list.";
  else if (fieldName === "items" && itemName === "unitId") message = "Choose a valid unit for the product.";
  else if (fieldName === "items" && itemName === "quantity") message = "Enter a valid quantity greater than zero.";
  else if (fieldName === "items" && itemName === "unitCost") message = "Enter a valid purchase cost for each product.";
  else if (fieldName === "items" && itemName === "sellingPrice") message = "Enter a selling price greater than zero for each product.";
  else if (fieldName === "items" && itemName === "batchNumber") message = "Enter a batch number for products that track batches.";
  else if (fieldName === "items" && itemName === "expiresAt") message = "Enter an expiry date for products that track expiry.";
  else if (fieldName === "discountValue") message = "Enter a discount greater than zero, or remove the discount.";
  else if (fieldName === "additionalCost") message = "Enter a valid non-negative additional cost.";
  else if (fieldName === "paidAmount") message = "Enter a valid amount paid.";
  else if (fieldName === "paymentMethodId") message = "Choose a payment method for the amount paid.";
  else if (issue) message = issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message;

  return apiError(400, "BAD_REQUEST", message);
}
