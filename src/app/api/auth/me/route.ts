import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { apiError } from "@/lib/http/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return NextResponse.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions: user.rolePermissions.map((entry) => entry.permission),
    },
  });
}
