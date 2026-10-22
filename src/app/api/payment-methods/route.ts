import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized, authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { PaymentMethod, SalePayment, PurchasePayment, Expense, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { paymentMethodSchema, paymentMethodUpdateSchema } from "@/lib/validation/api";

export async function GET() {
  await connectDB();
  const guard = await authorizedAny([
    Permission.MANAGE_SETTINGS,
    Permission.CREATE_SALES,
    Permission.CREATE_PURCHASES,
    Permission.COLLECT_PAYMENTS,
  ]);
  if ("response" in guard) return guard.response;
  
  const isAdmin = guard.user.rolePermissions.some((entry) => entry.permission === Permission.MANAGE_SETTINGS);
  const methods = await PaymentMethod.find(isAdmin ? {} : { isEnabled: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  
  return NextResponse.json({ paymentMethods: methods.map(m => ({ ...m, id: m._id })) });
}

export async function POST(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_SETTINGS);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = paymentMethodSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  try {
    const id = crypto.randomUUID();
    const paymentMethod = await PaymentMethod.create({ _id: id, ...parsed.data });
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "payment_method.created",
      entityType: "payment_method",
      entityId: id,
    });
    
    return NextResponse.json({ paymentMethod }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "That payment method code already exists." } }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_SETTINGS);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = paymentMethodUpdateSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  const { id, ...data } = parsed.data;
  
  try {
    const existing = await PaymentMethod.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payment method was not found." } }, { status: 404 });
    }
    
    if (data.code !== undefined || data.kind !== undefined) {
      const [salePayments, purchasePayments, expenses] = await Promise.all([
        SalePayment.countDocuments({ methodId: id }),
        PurchasePayment.countDocuments({ methodId: id }),
        Expense.countDocuments({ methodId: id }),
      ]);
      
      if (salePayments + purchasePayments + expenses > 0) {
        return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Code and type cannot change after this method has been used." } }, { status: 400 });
      }
    }
    
    const updated = await PaymentMethod.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true }).lean();
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "payment_method.updated",
      entityType: "payment_method",
      entityId: id,
      metadata: { changedFields: Object.keys(data) },
    });
    
    return NextResponse.json({ paymentMethod: updated });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "That payment method code already exists." } }, { status: 409 });
    }
    throw error;
  }
}
