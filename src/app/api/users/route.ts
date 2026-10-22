import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { User, RolePermission, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { userCreateSchema as userSchema } from "@/lib/validation/api";

export async function GET() {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_USERS);
  if ("response" in guard) return guard.response;
  
  const users = await User.find({})
    .select("_id fullName email phoneE164 role isActive createdAt")
    .sort({ createdAt: -1 })
    .lean();
  
  const rolePermissions = await RolePermission.find({})
    .sort({ role: 1, permission: 1 })
    .lean();
  
  return NextResponse.json({ 
    users: users.map(u => ({ ...u, id: u._id })), 
    rolePermissions: rolePermissions.map(r => ({ ...r, id: r._id })) 
  });
}

export async function POST(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_USERS);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  try {
    const passwordHash = await hash(parsed.data.password, 12);
    const id = crypto.randomUUID();
    
    const user = await User.create({
      _id: id,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    });
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "user.created",
      entityType: "user",
      entityId: id,
    });
    
    return NextResponse.json({ 
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        role: user.role, 
        isActive: user.isActive, 
        createdAt: user.createdAt 
      } 
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "That email address is already in use." } }, { status: 409 });
    }
    throw error;
  }
}
