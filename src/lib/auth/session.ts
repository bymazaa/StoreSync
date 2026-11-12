import { cookies } from "next/headers";
import { connection } from "next/server";

import { Permission } from "@/types";
import connectDB from "@/lib/db";
import { RefreshSession, User, RolePermission } from "@/models";
import { apiError } from "@/lib/http/api-response";
import { ACCESS_COOKIE, hashRefreshToken, REFRESH_COOKIE, verifyAccessToken } from "./tokens";

async function loadUser(userId: string, sessionVersion?: number) {
  const user = await User.findOne({
    _id: userId,
    isActive: true,
  })
    .select("_id fullName email role sessionVersion")
    .lean();

  if (!user || (sessionVersion !== undefined && user.sessionVersion !== sessionVersion)) {
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

  return loadUser(claims.userId, claims.sessionVersion);
}

/**
 * Server components must not sign the shop out on a page reload: the 15-minute access token only
 * guards API calls, so rendering falls back to the multi-day refresh cookie. The session is read,
 * never rotated here — rotation stays in /api/auth/refresh, and password changes or disabling a
 * user revoke the refresh session, so this cannot outlive them.
 */
export async function getViewerUser() {
  await connection();
  const accessUser = await getCurrentUser();
  if (accessUser) return accessUser;

  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  await connectDB();

  const session = await RefreshSession.findOne({
    tokenHash: hashRefreshToken(refreshToken),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select("userId")
    .lean();

  if (!session?.userId) return null;

  return loadUser(String(session.userId));
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
