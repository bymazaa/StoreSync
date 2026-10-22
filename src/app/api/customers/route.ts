import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { Customer, Settings, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { customerSchema } from "@/lib/validation/api";


export async function GET(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.CREATE_SALES);
  if ("response" in guard) return guard.response;
  
  const searchParams = new URL(request.url).searchParams;
  const q = searchParams.get("q")?.trim();
  const includeInactive = searchParams.get("includeInactive") === "true";
  
  let query: any = {};
  if (!includeInactive) query.isActive = true;
  
  if (q) {
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { phoneE164: { $regex: q } },
      { email: { $regex: q, $options: 'i' } },
      { address: { $regex: q, $options: 'i' } },
    ];
  }
  
  const customers = await Customer.find(query)
    .sort({ name: 1 })
    .limit(50)
    .lean();
  
  const customersWithId = customers.map(customer => ({ ...customer, id: customer._id }));
  
  return NextResponse.json({ customers: customersWithId });
}

export async function POST(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.CREATE_SALES);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  const settings = await Settings.findById("shop").select("countryCode").lean();
  const country = (settings?.countryCode ?? "US") as CountryCode;
  const phone = parsed.data.phone ? parsePhoneNumberFromString(parsed.data.phone, country) : undefined;
  
  if (parsed.data.phone && !phone?.isValid()) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: `Enter a valid phone number for ${country}.` } }, { status: 400 });
  }

  try {
    const id = crypto.randomUUID();
    const customer = await Customer.create({
      _id: id,
      name: parsed.data.name,
      phoneE164: phone?.number ?? null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    });
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "customer.created",
      entityType: "customer",
      entityId: id,
      metadata: { phoneProvided: Boolean(customer.phoneE164) },
    });
    
    return NextResponse.json({ customer: { ...customer.toObject(), id: customer._id } }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      const existingCustomer = phone ? await Customer.findOne({ phoneE164: phone.number }).lean() : null;
      return NextResponse.json({ error: { code: "CONFLICT", message: "A customer with this phone number already exists." }, customer: existingCustomer ? { ...existingCustomer, id: existingCustomer._id } : null }, { status: 409 });
    }
    throw error;
  }
}
