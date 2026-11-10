import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { RefreshSession } from "@/models";
import { apiError } from "@/lib/http/api-response";
import { assertSameOrigin, clearAuthCookies } from "@/lib/auth/cookies";
import { hashRefreshToken, REFRESH_COOKIE } from "@/lib/auth/tokens";

export async function POST(request: Request) {
  await connectDB();
  if (!assertSameOrigin(request)) return apiError(403, "FORBIDDEN", "Request origin is not allowed.");
  
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await RefreshSession.updateMany(
      { tokenHash, revokedAt: null },
      { revokedAt: new Date() }
    );
  }
  
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response, request);
  return response;
}
