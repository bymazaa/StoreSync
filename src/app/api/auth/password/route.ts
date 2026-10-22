import { randomUUID } from "crypto";
import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { clearAuthCookies } from "@/lib/auth/cookies";
import connectDB from "@/lib/db";
import User, { IUser } from "@/models/User";
import RefreshSession from "@/models/RefreshSession";
import AuditLog from "@/models/AuditLog";
import { apiError, invalidBody } from "@/lib/http/api-response";
import { passwordSchema } from "@/lib/validation/api";

export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) return apiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  
  await connectDB();
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);

  const user = await User.findById(session.id).select("_id passwordHash").lean() as Pick<IUser, "_id" | "passwordHash"> | null;
  if (!user || !(await compare(parsed.data.currentPassword, user.passwordHash))) {
    return apiError(401, "UNAUTHENTICATED", "Current password is incorrect.");
  }
  
  const passwordHash = await hash(parsed.data.newPassword, 12);
  const currentSessionVersion = (await User.findById(session.id).select("sessionVersion").lean())?.sessionVersion || 0;
  
  // Update user with new password and increment session version
  await User.findByIdAndUpdate(
    user._id,
    { passwordHash, sessionVersion: currentSessionVersion + 1 }
  );
  
  // Revoke all refresh sessions
  await RefreshSession.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date() }
  );
  
  // Log the change
  await AuditLog.create({
    _id: randomUUID(),
    actorId: user._id, action: "auth.password_changed", entityType: "user", entityId: user._id
  });

  const response = NextResponse.json({ ok: true, message: "Password updated. Sign in again with your new password." });
  clearAuthCookies(response);
  return response;
}
