import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { User, RolePermission, AuditLog, RefreshSession } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { parseUserAgent } from "@/lib/auth/login-history";
import { userCreateSchema as userSchema } from "@/lib/validation/api";

export async function GET() {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_USERS);
  if ("response" in guard) return guard.response;
  
  const users = await User.find({})
    .select("_id fullName email phoneE164 role isActive createdAt lastLoginAt loginHistory")
    .sort({ createdAt: -1 })
    .lean() as Array<{
      _id: string;
      fullName: string;
      email: string;
      phoneE164?: string | null;
      role: string;
      isActive: boolean;
      createdAt: Date;
      lastLoginAt?: Date | null;
      loginHistory?: Array<{
        _id?: string;
        id?: string;
        timestamp: Date;
        ip: string;
        device: string;
        location?: string;
      }>;
    }>;

  // Fallback to latest session createdAt if lastLoginAt is not yet populated
  const missingIds = users.filter((u) => !u.lastLoginAt).map((u) => u._id);
  const sessionMap: Record<string, Date> = {};
  if (missingIds.length > 0) {
    const sessions = await RefreshSession.aggregate<{ _id: string; latest: Date }>([
      { $match: { userId: { $in: missingIds } } },
      { $group: { _id: "$userId", latest: { $max: "$createdAt" } } },
    ]);
    for (const s of sessions) {
      sessionMap[s._id] = s.latest;
    }
  }

  // Fallback for users with empty loginHistory from RefreshSession
  const usersNeedingHistory = users.filter((u) => !u.loginHistory || u.loginHistory.length === 0);
  const sessionHistoryMap: Record<string, Array<{ _id: string; id: string; timestamp: Date; ip: string; device: string; location: string; userAgent?: string }>> = {};
  if (usersNeedingHistory.length > 0) {
    const userIds = usersNeedingHistory.map((u) => u._id);
    const sessions = await RefreshSession.find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .lean();

    for (const session of sessions) {
      if (!sessionHistoryMap[session.userId]) {
        sessionHistoryMap[session.userId] = [];
      }
      if (sessionHistoryMap[session.userId].length < 5) {
        const ip = session.ipAddress || 'unknown';
        sessionHistoryMap[session.userId].push({
          _id: session._id,
          id: session._id,
          timestamp: session.createdAt,
          ip,
          device: parseUserAgent(session.userAgent),
          location: ip === 'unknown' ? 'Unknown Location' : ip === '127.0.0.1' || ip.startsWith('192.168.') ? 'Localhost / Local Network' : 'Unknown Location',
          userAgent: session.userAgent || "",
        });
      }
    }
  }
  
  const rolePermissions = await RolePermission.find({})
    .sort({ role: 1, permission: 1 })
    .lean();
  
  return NextResponse.json({ 
    users: users.map(u => {
      const history = (u.loginHistory && u.loginHistory.length > 0)
        ? u.loginHistory.map(h => ({
            id: h.id || h._id || "",
            timestamp: h.timestamp,
            ip: h.ip,
            device: h.device,
            location: h.location || "Unknown Location",
            userAgent: (h as any).userAgent || "",
          }))
        : (sessionHistoryMap[u._id] || []);

      return {
        ...u,
        id: u._id,
        lastLoginAt: u.lastLoginAt || sessionMap[u._id] || (history[history.length - 1]?.timestamp) || null,
        loginHistory: history,
      };
    }), 
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
