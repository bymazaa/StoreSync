import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { RefreshSession, User } from "@/models";
import { apiError } from "@/lib/http/api-response";
import { assertSameOrigin, clearAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "@/lib/auth/tokens";

export async function POST(request: Request) {
  await connectDB();
  if (!assertSameOrigin(request)) return apiError(403, "FORBIDDEN", "Request origin is not allowed.");
  
  const currentToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!currentToken) return apiError(401, "UNAUTHENTICATED", "Please sign in again.");

  const currentHash = hashRefreshToken(currentToken);
  const session = await RefreshSession.findOne({ tokenHash: currentHash })
    .populate('userId')
    .lean();
  
  if (!session || !session.userId || session.revokedAt || session.expiresAt <= new Date() || !(session.userId as any).isActive) {
    const response = apiError(401, "UNAUTHENTICATED", "Please sign in again.");
    clearAuthCookies(response);
    return response;
  }

  const user = session.userId as any;
  const nextRefreshToken = createRefreshToken();
  const nextExpiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
  
  // Revoke old session atomically
  const result = await RefreshSession.updateOne(
    { _id: session._id, revokedAt: null, expiresAt: { $gt: new Date() } },
    { revokedAt: new Date() }
  );
  
  if (result.matchedCount !== 1) {
    const response = apiError(401, "UNAUTHENTICATED", "Please sign in again.");
    clearAuthCookies(response);
    return response;
  }
  
  // Create new refresh session
  await RefreshSession.create({
    _id: crypto.randomUUID(),
    userId: user._id,
    tokenHash: hashRefreshToken(nextRefreshToken),
    expiresAt: nextExpiresAt,
    userAgent: request.headers.get("user-agent")?.slice(0, 500),
    ipAddress: request.headers.get("x-real-ip")?.trim().slice(0, 64) || null,
  });
  
  const accessToken = await createAccessToken({ 
    id: user._id, 
    role: user.role, 
    sessionVersion: user.sessionVersion 
  });
  
  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, accessToken, nextRefreshToken);
  return response;
}
