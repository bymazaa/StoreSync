import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Expense, { IExpense } from "@/models/Expense";
import PaymentMethod from "@/models/PaymentMethod";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";
import { invalidBody } from "@/lib/http/api-response";
import { expenseSchema } from "@/lib/validation/api";
import { apiError } from "@/lib/http/api-response";
import { reportDateRange, zonedDayStartUtc } from "@/lib/date-time";
import Settings from "@/models/Settings";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  const guard = await authorized(Permission.VIEW_REPORTS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const settings = await Settings.findById("shop").select("timezone").lean();
  let dateRange;
  try { dateRange = reportDateRange(from, to, settings?.timezone ?? "America/New_York"); }
  catch (error) { return apiError(400, "BAD_REQUEST", error instanceof Error ? error.message : "Invalid date range."); }
  
  const expenses = await Expense.find({ 
    voidedAt: null, 
    ...(dateRange ? { expenseDate: dateRange } : {}) 
  })
  .sort({ expenseDate: -1 })
  .limit(2000)
  .lean();
  
  // Populate method and createdBy manually
  const methodIds = [...new Set(expenses.filter(e => e.methodId).map(e => e.methodId!))];
  const userIds = [...new Set(expenses.map(e => e.createdById))];
  
  const [methods, users] = await Promise.all([
    methodIds.length > 0 ? PaymentMethod.find({ _id: { $in: methodIds } }).lean() : [],
    User.find({ _id: { $in: userIds } }).select("_id fullName").lean()
  ]);
  
  const methodMap = new Map(methods.map(m => [m._id, m]));
  const userMap = new Map(users.map(u => [u._id, u]));
  
  const expensesWithRelations = expenses.map(expense => ({
    ...expense,
    id: expense._id,
    method: expense.methodId ? methodMap.get(expense.methodId) || null : null,
    createdBy: userMap.get(expense.createdById) || null
  }));
  
  return NextResponse.json({ expenses: expensesWithRelations });
}

export async function POST(request: Request) {
  const guard = await authorized(Permission.MANAGE_EXPENSES);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  

  // Handle case where methodId is sent as code/name instead of UUID
  if (body && typeof body === "object" && "methodId" in body) {
    const normalized = { ...body };
    if (normalized.methodId && typeof normalized.methodId === "string") {
      // Check if it's already a UUID
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!uuidPattern.test(normalized.methodId)) {
        // It's not a UUID, so look it up by code or name
        const method = await PaymentMethod.findOne({ 
          $or: [
            { code: normalized.methodId.toUpperCase() },
            { code: normalized.methodId.toLowerCase() },
            { name: new RegExp(`^${normalized.methodId}$`, "i") }
          ]
        }).lean();
        if (method) {
          normalized.methodId = method._id;
          console.log("Resolved methodId from", body.methodId, "to", method._id);
        } else {
          normalized.methodId = null;
          console.log("Could not resolve methodId:", body.methodId, "setting to null");
        }
      }
    }
    body = normalized;
  }
  
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    console.log("Validation errors:", JSON.stringify(parsed.error.issues, null, 2));
    const firstError = parsed.error.issues[0];
    const message = firstError 
      ? `${firstError.path.join(".")}: ${firstError.message}` 
      : "Please check the submitted information.";
    return apiError(400, "BAD_REQUEST", message);
  }
  
  if (parsed.data.clientRequestId) {
    const replay = await replayExpense(parsed.data.clientRequestId, guard.user.id);
    if (replay) return replay;
  }
  
  const settings = await Settings.findById("shop").select("timezone").lean();
  const timeZone = settings?.timezone ?? "America/New_York";
  const expenseDate = parsed.data.expenseDate
    ? (/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.expenseDate)
      ? zonedDayStartUtc(parsed.data.expenseDate, timeZone)
      : new Date(parsed.data.expenseDate))
    : new Date();
  
  try {
    if (parsed.data.methodId) {
      const method = await PaymentMethod.findOne({ _id: parsed.data.methodId, isEnabled: true }).lean();
      if (!method) throw new ExpenseInputError("The selected payment method is unavailable.");
    }
    
    const created = await Expense.create({
      _id: randomUUID(),
      clientRequestId: parsed.data.clientRequestId,
      title: parsed.data.title,
      category: parsed.data.category || null,
      amount: parseFloat(parseFloat(parsed.data.amount).toFixed(2)),
      expenseDate,
      methodId: parsed.data.methodId || null,
      createdById: guard.user.id,
      notes: parsed.data.notes || null,
    });
    
    await AuditLog.create({
      _id: randomUUID(),
      actorId: guard.user.id, action: "expense.created", entityType: "expense", entityId: created._id, 
      metadata: { amount: created.amount.toString() }
    });
    
    return NextResponse.json({ expense: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ExpenseInputError) return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    if (parsed.data.clientRequestId && error && typeof error === "object" && "code" in error && error.code === 11000) {
      const replay = await replayExpense(parsed.data.clientRequestId, guard.user.id);
      if (replay) return replay;
    }
    throw error;
  }
}

class ExpenseInputError extends Error {}

async function replayExpense(clientRequestId: string, actorId: string) {
  const prior = await Expense.findOne({ clientRequestId }).lean() as IExpense | null;
  if (!prior) return null;
  if (prior.createdById !== actorId) return NextResponse.json({ error: { code: "CONFLICT", message: "This expense request key has already been used." } }, { status: 409 });
  
  // Populate related data
  const [method, createdBy] = await Promise.all([
    prior.methodId ? PaymentMethod.findById(prior.methodId).lean() : null,
    User.findById(prior.createdById).select("_id fullName").lean()
  ]);
  
  const expenseWithRelations = { ...prior, method, createdBy };
  return NextResponse.json({ expense: expenseWithRelations, alreadyProcessed: true });
}
