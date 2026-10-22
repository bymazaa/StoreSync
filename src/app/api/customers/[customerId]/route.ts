import { NextResponse } from "next/server";
import { Permission, SaleStatus } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Customer, { ICustomer } from "@/models/Customer";
import Sale from "@/models/Sale";
import SalePayment from "@/models/SalePayment";
import PaymentMethod from "@/models/PaymentMethod";
import AuditLog from "@/models/AuditLog";
import { invalidBody } from "@/lib/http/api-response";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { z } from "zod";
import { customerUpdateSchema } from "@/lib/validation/api";
import Settings from "@/models/Settings";
import { randomUUID } from "crypto";


export async function GET(_request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const guard = await authorized(Permission.CREATE_SALES);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { customerId } = await params;
  const customer = await Customer.findById(customerId).lean() as ICustomer | null;
  if (!customer) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Customer was not found." } }, { status: 404 });
  
  const sales = await Sale.find({ customerId }).sort({ soldAt: -1 }).limit(100).lean();
  const due = sales.reduce((total, sale) => {
    return (sale.status === SaleStatus.COMPLETED || sale.status === SaleStatus.PARTIALLY_RETURNED) ? total + (sale.dueAmount || 0) : total;
  }, 0);
  
  const saleIds = sales.map(s => s._id);
  const salePayments = saleIds.length > 0 ? await SalePayment.find({ saleId: { $in: saleIds } }).sort({ paidAt: -1 }).lean() : [];
  const methodIds = [...new Set(salePayments.map(p => p.methodId))];
  const methods = methodIds.length > 0 ? await PaymentMethod.find({ _id: { $in: methodIds } }).lean() : [];
  const methodMap = new Map(methods.map(m => [m._id, m]));
  const paymentsBySale = new Map<string, any[]>();
  salePayments.forEach(payment => {
    const existing = paymentsBySale.get(payment.saleId) || [];
    existing.push({ ...payment, id: payment._id, method: methodMap.get(payment.methodId) || null });
    paymentsBySale.set(payment.saleId, existing);
  });
  
  const history = sales.map(sale => ({
    ...sale,
    id: sale._id,
    payments: paymentsBySale.get(sale._id) || [],
  }));
  
  return NextResponse.json({ customer: { ...customer, id: customer._id, sales: history }, balanceDue: due.toFixed(2) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const guard = await authorized(Permission.CREATE_SALES);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { customerId } = await params;
  if (!z.uuid().safeParse(customerId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid customer ID." } }, { status: 400 });
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = customerUpdateSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);

  const settings = await Settings.findById("shop").select("countryCode").lean();
  let phoneE164: string | null | undefined;
  if (parsed.data.phone !== undefined) {
    if (parsed.data.phone === null) phoneE164 = null;
    else {
      const country = (settings?.countryCode ?? "US") as CountryCode;
      const phone = parsePhoneNumberFromString(parsed.data.phone, country);
      if (!phone?.isValid()) return NextResponse.json({ error: { code: "BAD_REQUEST", message: `Enter a valid phone number for ${country}.` } }, { status: 400 });
      phoneE164 = phone.number;
    }
  }
  
  const fields = { ...parsed.data };
  delete fields.phone;
  
  try {
    const existing = await Customer.findById(customerId).select("_id").lean();
    if (!existing) throw new CustomerUpdateError("Customer was not found.", 404);
    
    if (phoneE164 === null || fields.isActive === false) {
      const dueResult = await Sale.aggregate([
        { $match: { customerId, dueAmount: { $gt: 0 }, status: { $in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED] } } },
        { $group: { _id: null, totalDue: { $sum: "$dueAmount" } } }
      ]);
      const totalDue = dueResult[0]?.totalDue || 0;
      if (totalDue > 0) {
        throw new CustomerUpdateError("Settle the customer's outstanding balance before removing their phone or archiving the account.");
      }
    }
    
    const updated = await Customer.findByIdAndUpdate(
      customerId,
      { ...fields, ...(phoneE164 !== undefined ? { phoneE164 } : {}) },
      { returnDocument: "after", runValidators: true }
    ).lean() as ICustomer;
    
    await AuditLog.create({
      _id: randomUUID(),
      actorId: guard.user.id, action: "customer.updated", entityType: "customer", entityId: customerId,
      metadata: { changedFields: Object.keys(parsed.data) },
    });
    
    return NextResponse.json({ customer: updated });
  } catch (error) {
    if (error instanceof CustomerUpdateError) return NextResponse.json({ error: { code: error.status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message: error.message } }, { status: error.status });
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "A customer with this phone number already exists." } }, { status: 409 });
    }
    throw error;
  }
}

class CustomerUpdateError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
