import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Sale from "@/models/Sale";
import Purchase from "@/models/Purchase";
import PaymentMethod from "@/models/PaymentMethod";
import SalePayment from "@/models/SalePayment";
import PurchasePayment from "@/models/PurchasePayment";
import AuditLog from "@/models/AuditLog";
import Customer from "@/models/Customer";
import Supplier from "@/models/Supplier";
import Settings from "@/models/Settings";
import { invalidBody } from "@/lib/http/api-response";
import { paymentCollectionSchema as collectionSchema } from "@/lib/validation/api";

export async function POST(request: Request) {
  const guard = await authorized(Permission.COLLECT_PAYMENTS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = collectionSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  const { invoiceType, invoiceId, paymentMethodId, reference, notes, clientRequestId } = parsed.data;
  const amount = parseFloat(parseFloat(parsed.data.amount).toFixed(2));

  if (clientRequestId) {
    const replay = await replayPayment(clientRequestId, invoiceType, guard.user.id);
    if (replay) return replay;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const method = await PaymentMethod.findOne({ _id: paymentMethodId, isEnabled: true }).session(session).lean();
    if (!method) throw new CollectionError("The selected payment method is unavailable.");
    
    if (invoiceType === "sale") {
      const sale = await Sale.findById(invoiceId).session(session).lean();
      if (!sale || sale.dueAmount < amount) throw new CollectionError("Sale was not found or the amount exceeds its remaining balance.");
      
      const payment = await SalePayment.create([{
        clientRequestId, saleId: sale._id, methodId: method._id, collectedById: guard.user.id, amount, reference: reference || null, notes: notes || null
      }], { session });
      
      await Sale.findByIdAndUpdate(
        sale._id,
        { $inc: { paidAmount: amount, dueAmount: -amount } },
        { session }
      );
      
      await AuditLog.create([{
        actorId: guard.user.id, action: "sale.payment_collected", entityType: "sale", entityId: sale._id, 
        metadata: { amount: amount.toFixed(2) }
      }], { session });
      
      await session.commitTransaction();
      const receipt = await buildReceipt("sale", sale, method.name, amount, reference || null, guard.user.fullName, payment[0].paidAt);
      return NextResponse.json({ payment: payment[0], receipt }, { status: 201 });
    }
    
    // Purchase payment
    const purchase = await Purchase.findById(invoiceId).session(session).lean();
    if (!purchase || purchase.dueAmount < amount) throw new CollectionError("Purchase was not found or the amount exceeds its remaining balance.");
    
    const payment = await PurchasePayment.create([{
      clientRequestId, purchaseId: purchase._id, methodId: method._id, madeById: guard.user.id, amount, reference: reference || null, notes: notes || null
    }], { session });
    
    await Purchase.findByIdAndUpdate(
      purchase._id,
      { $inc: { paidAmount: amount, dueAmount: -amount } },
      { session }
    );
    
    await AuditLog.create([{
      actorId: guard.user.id, action: "purchase.payment_paid", entityType: "purchase", entityId: purchase._id, 
      metadata: { amount: amount.toFixed(2) }
    }], { session });
    
    await session.commitTransaction();
    const receipt = await buildReceipt("purchase", purchase, method.name, amount, reference || null, guard.user.fullName, payment[0].paidAt);
    return NextResponse.json({ payment: payment[0], receipt }, { status: 201 });
  } catch (error) {
    await session.abortTransaction();
    
    if (clientRequestId && error && typeof error === "object" && "code" in error && error.code === 11000) {
      const replay = await replayPayment(clientRequestId, invoiceType, guard.user.id);
      if (replay) return replay;
    }
    if (error instanceof CollectionError) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    }
    throw error;
  } finally {
    session.endSession();
  }
}

class CollectionError extends Error {}

async function buildReceipt(
  invoiceType: "sale" | "purchase",
  invoice: { invoiceNumber: string; dueAmount?: number; customerId?: string; supplierId?: string },
  methodName: string,
  amount: number,
  reference: string | null,
  recordedBy: string,
  paidAt: Date,
) {
  const contactId = invoiceType === "sale" ? invoice.customerId : invoice.supplierId;
  const contactQuery = invoiceType === "sale" ? Customer.findById(contactId) : Supplier.findById(contactId);
  const [settings, contactDoc] = await Promise.all([
    Settings.findById("shop").select("shopName address phone currencyCode").lean(),
    contactId ? contactQuery.select("name phoneE164").lean() : Promise.resolve(null),
  ]);
  const contact = contactDoc as { name?: string; phoneE164?: string | null } | null;
  return {
    kind: invoiceType,
    shopName: settings?.shopName ?? "StockPilot",
    shopAddress: settings?.address ?? null,
    shopPhone: settings?.phone ?? null,
    currencyCode: settings?.currencyCode ?? "USD",
    contactName: contact?.name ?? "",
    contactPhone: contact?.phoneE164 ?? null,
    invoiceNumber: invoice.invoiceNumber,
    amount: amount.toFixed(2),
    balanceDue: Math.max(0, Number(invoice.dueAmount ?? 0) - amount).toFixed(2),
    methodName,
    reference,
    recordedBy,
    paidAt,
  };
}

async function replayPayment(clientRequestId: string, invoiceType: "sale" | "purchase", actorId: string) {
  const payment = invoiceType === "sale"
    ? await SalePayment.findOne({ clientRequestId }).lean()
    : await PurchasePayment.findOne({ clientRequestId }).lean();
    
  if (!payment) return null;
  const paymentActorId = invoiceType === "sale"
    ? (payment as any).collectedById
    : (payment as any).madeById;
    
  if (paymentActorId !== actorId) return NextResponse.json({ error: { code: "CONFLICT", message: "This payment request key has already been used." } }, { status: 409 });
  return NextResponse.json({ payment: { ...payment, id: payment._id }, alreadyProcessed: true });
}
