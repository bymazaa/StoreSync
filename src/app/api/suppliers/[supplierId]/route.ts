import { NextResponse } from "next/server";
import { Permission, PurchaseStatus } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Supplier, { ISupplier } from "@/models/Supplier";
import Purchase from "@/models/Purchase";
import PurchasePayment from "@/models/PurchasePayment";
import PaymentMethod from "@/models/PaymentMethod";
import AuditLog from "@/models/AuditLog";
import { invalidBody } from "@/lib/http/api-response";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { z } from "zod";
import { supplierUpdateSchema } from "@/lib/validation/api";
import Settings from "@/models/Settings";
import { randomUUID } from "crypto";


export async function GET(_request: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const guard = await authorized(Permission.CREATE_PURCHASES);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { supplierId } = await params;
  const supplier = await Supplier.findById(supplierId).lean() as ISupplier | null;
  if (!supplier) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Supplier was not found." } }, { status: 404 });
  
  const purchases = await Purchase.find({ supplierId }).sort({ purchasedAt: -1 }).limit(100).lean();
  const due = purchases.reduce((total, purchase) => {
    return (purchase.status === PurchaseStatus.COMPLETED || purchase.status === PurchaseStatus.PARTIALLY_RETURNED) ? total + (purchase.dueAmount || 0) : total;
  }, 0);
  
  const purchaseIds = purchases.map(p => p._id);
  const purchasePayments = purchaseIds.length > 0 ? await PurchasePayment.find({ purchaseId: { $in: purchaseIds } }).sort({ paidAt: -1 }).lean() : [];
  const methodIds = [...new Set(purchasePayments.map(p => p.methodId))];
  const methods = methodIds.length > 0 ? await PaymentMethod.find({ _id: { $in: methodIds } }).lean() : [];
  const methodMap = new Map(methods.map(m => [m._id, m]));
  const paymentsByPurchase = new Map<string, any[]>();
  purchasePayments.forEach(payment => {
    const existing = paymentsByPurchase.get(payment.purchaseId) || [];
    existing.push({ ...payment, id: payment._id, method: methodMap.get(payment.methodId) || null });
    paymentsByPurchase.set(payment.purchaseId, existing);
  });
  
  const history = purchases.map(purchase => ({
    ...purchase,
    id: purchase._id,
    payments: paymentsByPurchase.get(purchase._id) || [],
  }));
  
  return NextResponse.json({ supplier: { ...supplier, id: supplier._id, purchases: history }, balanceDue: due.toFixed(2) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const guard = await authorized(Permission.CREATE_PURCHASES);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { supplierId } = await params;
  if (!z.uuid().safeParse(supplierId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid supplier ID." } }, { status: 400 });
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = supplierUpdateSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);

  const settings = await Settings.findById("shop").select("countryCode").lean();
  let phoneE164: string | null | undefined;
  if (parsed.data.phone !== undefined) {
    if (!parsed.data.phone) phoneE164 = null;
    else {
      const country = (settings?.countryCode ?? "US") as CountryCode;
      const phone = parsePhoneNumberFromString(parsed.data.phone, country);
      if (!phone?.isValid()) return NextResponse.json({ error: { code: "BAD_REQUEST", message: `Enter a valid supplier phone number for ${country}.` } }, { status: 400 });
      phoneE164 = phone.number;
    }
  }
  
  const fields = { ...parsed.data };
  delete fields.phone;
  
  try {
    const existing = await Supplier.findById(supplierId).select("_id").lean();
    if (!existing) throw new SupplierUpdateError("Supplier was not found.", 404);
    
    if (fields.isActive === false) {
      const dueResult = await Purchase.aggregate([
        { $match: { supplierId, dueAmount: { $gt: 0 }, status: { $in: [PurchaseStatus.COMPLETED, PurchaseStatus.PARTIALLY_RETURNED] } } },
        { $group: { _id: null, totalDue: { $sum: "$dueAmount" } } }
      ]);
      const totalDue = dueResult[0]?.totalDue || 0;
      if (totalDue > 0) {
        throw new SupplierUpdateError("Settle this supplier's outstanding balance before archiving the account.");
      }
    }
    
    const updated = await Supplier.findByIdAndUpdate(
      supplierId,
      { ...fields, ...(phoneE164 !== undefined ? { phoneE164 } : {}) },
      { returnDocument: "after", runValidators: true }
    ).lean() as ISupplier;
    
    await AuditLog.create({
      _id: randomUUID(),
      actorId: guard.user.id, action: "supplier.updated", entityType: "supplier", entityId: supplierId,
      metadata: { changedFields: Object.keys(parsed.data) },
    });
    
    return NextResponse.json({ supplier: updated });
  } catch (error) {
    if (error instanceof SupplierUpdateError) return NextResponse.json({ error: { code: error.status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message: error.message } }, { status: error.status });
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "A supplier with this phone number already exists." } }, { status: 409 });
    }
    throw error;
  }
}

class SupplierUpdateError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
