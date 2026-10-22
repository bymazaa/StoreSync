import type { Permission } from "@/types";
import { requireAnyPermission } from "./session";

export async function authorized(permission: Permission) {
  const result = await requireAnyPermission([permission]);
  return "response" in result ? { response: result.response } : { user: result.user };
}

export async function authorizedAny(permissions: Permission[]) {
  const result = await requireAnyPermission(permissions);
  return "response" in result ? { response: result.response } : { user: result.user };
}
