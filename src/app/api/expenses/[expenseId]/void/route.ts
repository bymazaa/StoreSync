import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Expense, { IExpense } from "@/models/Expense";
import AuditLog from "@/models/AuditLog";
import { invalidBody } from "@/lib/http/api-response";
import { z } from "zod";
import { expenseVoidSchema as voidSchema } from "@/lib/validation/api";
import { randomUUID } from "crypto";


export async function POST(request: Request, { params }: { params: Promise<{ expenseId: string }> }) {
  const guard = await authorized(Permission.MANAGE_EXPENSES);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { expenseId } = await params;
  if (!z.uuid().safeParse(expenseId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid expense ID." } }, { status: 400 });
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = voidSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);

  try {
    const existing = await Expense.findById(expenseId).lean() as IExpense | null;
    if (!existing) throw new ExpenseVoidError("Expense was not found.", 404);
    if (existing.voidedAt) throw new ExpenseVoidError("This expense has already been voided.", 409);
    
    const voided = await Expense.findByIdAndUpdate(
      expenseId,
      { voidedAt: new Date(), voidedById: guard.user.id, voidReason: parsed.data.reason },
      { returnDocument: "after" }
    ).lean() as IExpense;
    
    await AuditLog.create({
      _id: randomUUID(),
      actorId: guard.user.id, action: "expense.voided", entityType: "expense", entityId: expenseId,
      metadata: { amount: existing.amount.toFixed(2), reason: parsed.data.reason },
    });
    
    return NextResponse.json({ expense: voided });
  } catch (error) {
    if (error instanceof ExpenseVoidError) {
      const code = error.status === 404 ? "NOT_FOUND" : error.status === 409 ? "CONFLICT" : "BAD_REQUEST";
      return NextResponse.json({ error: { code, message: error.message } }, { status: error.status });
    }
    throw error;
  }
}

class ExpenseVoidError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
