import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { Unit, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { unitSchema } from "@/lib/validation/api";

export async function GET(request: Request) {
  await connectDB();
  const guard = await authorizedAny([Permission.MANAGE_PRODUCTS, Permission.CREATE_SALES, Permission.CREATE_PURCHASES]);
  if ("response" in guard) return guard.response;
  
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true"
    && guard.user.rolePermissions.some((entry) => entry.permission === Permission.MANAGE_PRODUCTS);
  
  const units = await Unit.find(includeInactive ? {} : { isActive: true })
    .sort({ name: 1 })
    .lean();
  
  const unitsWithId = units.map(unit => ({ ...unit, id: unit._id }));
  
  return NextResponse.json({ units: unitsWithId });
}

export async function POST(request: Request) {
  await connectDB();
  const guard = await authorizedAny([Permission.MANAGE_PRODUCTS]);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = unitSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  try {
    const id = crypto.randomUUID();
    const unit = await Unit.create({ _id: id, ...parsed.data });
    
    await AuditLog.create({ 
      _id: crypto.randomUUID(),
      actorId: guard.user.id, 
      action: "unit.created", 
      entityType: "unit", 
      entityId: id, 
      metadata: { code: unit.code } 
    });
    
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "A unit with this code already exists." } }, { status: 409 });
    }
    throw error;
  }
}
