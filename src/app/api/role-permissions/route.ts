import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { RolePermission, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { rolePermissionsSchema as schema } from "@/lib/validation/api";

export async function PUT(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_USERS);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  const uniquePermissions = [...new Set(parsed.data.permissions)];
  
  // Delete existing permissions
  await RolePermission.deleteMany({ role: parsed.data.role });
  
  // Create new ones
  if (uniquePermissions.length) {
    await RolePermission.create(
      uniquePermissions.map((permission) => ({
        _id: crypto.randomUUID(),
        role: parsed.data.role,
        permission,
      }))
    );
  }
  
  // Log the change
  await AuditLog.create({
    _id: crypto.randomUUID(),
    actorId: guard.user.id,
    action: "role_permissions.updated",
    entityType: "role_permission",
    entityId: parsed.data.role,
    metadata: { permissions: uniquePermissions },
  });
  
  // Fetch updated permissions
  const rolePermissions = await RolePermission.find({ role: parsed.data.role })
    .sort({ permission: 1 })
    .lean();
  
  return NextResponse.json({ rolePermissions });
}
