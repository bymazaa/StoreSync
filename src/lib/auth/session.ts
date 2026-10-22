import { cookies } from "next/headers";

import { Permission } from "@/types";
import connectDB from "@/lib/db";
import { User, RolePermission } from "@/models";
import { apiError } from "@/lib/http/api-response";
import { ACCESS_COOKIE, verifyAccessToken } from "./tokens";



export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!token) {
    return null;
  }

  let claims;

  try {
    claims = await verifyAccessToken(token);
  } catch {
    return null;
  }

  if (!claims) {
    return null;
  }

  await connectDB();

  const user = await User.findOne({
    _id: claims.userId,
    isActive: true,
  })
    .select("_id fullName email role sessionVersion")
    .lean();

  if (!user || user.sessionVersion !== claims.sessionVersion) {
    return null;
  }

  const rolePermissions = await RolePermission.find({
    role: user.role,
  })
    .select("permission")
    .lean();

  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    rolePermissions: rolePermissions.map((rp) => ({
      permission: rp.permission,
    })),
  };
}



export async function requireAnyPermission(permissions: Permission[] = []) {
  const user = await getCurrentUser();
  if (!user) return { response: apiError(401, "UNAUTHENTICATED", "Please sign in to continue.") } as const;
  if (permissions.length && !permissions.some((permission) => user.rolePermissions.some((entry) => entry.permission === permission))) {
    return { response: apiError(403, "FORBIDDEN", "You do not have permission to perform this action.") } as const;
  }
  return { user } as const;
}

export async function requirePermission(permission: Permission) {
  return requireAnyPermission([permission]);
}
