import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { AuditLog, User } from "@/models";

export async function GET(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_SETTINGS);
  if ("response" in guard) return guard.response;
  
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const actorId = searchParams.get("actorId");
  
  let query: any = {};
  if (entityType) query.entityType = entityType;
  if (actorId) query.actorId = actorId;
  
  const logs = await AuditLog.find(query)
    .populate('actorId', 'id fullName email')
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();
  
  // Map actorId to actor for compatibility
  const logsWithActor = logs.map(log => ({
    ...log,
    id: log._id,
    actor: log.actorId
  }));
  
  return NextResponse.json({ logs: logsWithActor });
}
