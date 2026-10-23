import { NextResponse } from "next/server";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { Supplier, Settings, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { supplierSchema } from "@/lib/validation/api";


export async function GET(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.CREATE_PURCHASES);
  if ("response" in guard) return guard.response;
  
  const searchParams = new URL(request.url).searchParams;
  const q = searchParams.get("q")?.trim();
  const includeInactive = searchParams.get("includeInactive") === "true";
  
  const query: any = {};
  if (!includeInactive) query.isActive = true;
  
  if (q) {
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { phoneE164: { $regex: q } },
      { email: { $regex: q, $options: 'i' } },
      { address: { $regex: q, $options: 'i' } },
    ];
  }
  
  const suppliers = await Supplier.find(query)
    .sort({ name: 1 })
    .limit(100)
    .lean();
  
  const suppliersWithId = suppliers.map(supplier => ({ ...supplier, id: supplier._id }));
  
  return NextResponse.json({ suppliers: suppliersWithId });
}

export async function POST(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.CREATE_PURCHASES);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  const settings = await Settings.findById("shop").select("countryCode").lean();
  let phoneE164: string | null = null;
  
  if (parsed.data.phone) {
    const phone = parsePhoneNumberFromString(parsed.data.phone, (settings?.countryCode ?? "US") as CountryCode);
    if (!phone?.isValid()) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Enter a valid supplier phone number for the shop country." } }, { status: 400 });
    }
    phoneE164 = phone.number;
  }
  
  try {
    const id = crypto.randomUUID();
    const supplier = await Supplier.create({
      _id: id,
      name: parsed.data.name,
      phoneE164,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    });
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "supplier.created",
      entityType: "supplier",
      entityId: id,
    });
    
    return NextResponse.json({ supplier: { ...supplier.toObject(), id: supplier._id } }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      const existingSupplier = phoneE164 ? await Supplier.findOne({ phoneE164 }).lean() : null;
      return NextResponse.json({ error: { code: "CONFLICT", message: "A supplier with this phone number already exists." }, supplier: existingSupplier ? { ...existingSupplier, id: existingSupplier._id } : null }, { status: 409 });
    }
    throw error;
  }
}
