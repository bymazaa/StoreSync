import { randomUUID } from "crypto";
import { hash } from "bcryptjs";
import type { UpdateQuery } from "mongoose";
import { NextResponse } from "next/server";
import { Permission, UserRole } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import User, { IUser } from "@/models/User";
import RefreshSession from "@/models/RefreshSession";
import AuditLog from "@/models/AuditLog";
import { Expense, Purchase, PurchasePayment, PurchaseReturn, Sale, SalePayment, SaleReturn, StockMovement } from "@/models";
import { apiError, invalidBody } from "@/lib/http/api-response";
import { userUpdateSchema as updateSchema } from "@/lib/validation/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await authorized(Permission.MANAGE_USERS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { userId } = await params;
  if (userId === guard.user.id) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Use another owner account to change or deactivate your own access." } }, { status: 400 });
  }
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  const passwordHash = parsed.data.password ? await hash(parsed.data.password, 12) : undefined;
  
  try {
    const existing = await User.findById(userId).select("role").lean() as Pick<IUser, "role"> | null;
    if (!existing || existing.role === UserRole.OWNER) throw new UserUpdateError("Owner account changes must be managed separately.");
    
    const updateData: UpdateQuery<IUser> = {};
    if (parsed.data.role) updateData.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (passwordHash) updateData.passwordHash = passwordHash;
    if (passwordHash || parsed.data.isActive === false) {
      const currentSessionVersion = (await User.findById(userId).select("sessionVersion").lean())?.sessionVersion || 0;
      updateData.sessionVersion = currentSessionVersion + 1;
    }
    
    const updated = await User.findByIdAndUpdate(
      userId,
      updateData,
      { returnDocument: "after", select: "_id fullName email role isActive updatedAt", runValidators: true }
    ).lean() as Pick<IUser, "_id" | "fullName" | "email" | "role" | "isActive" | "updatedAt">;
    
    if (parsed.data.isActive === false || passwordHash) {
      await RefreshSession.updateMany(
        { userId, revokedAt: null },
        { revokedAt: new Date() }
      );
    }
    
    await AuditLog.create({
      _id: randomUUID(),
      actorId: guard.user.id, action: "user.updated", entityType: "user", entityId: userId,
      metadata: { changedFields: Object.keys(parsed.data).filter((key) => key !== "password") },
    });
    
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof UserUpdateError) return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    throw error;
  }
}

// A staff account is only removable while it has never produced a record: invoices, payments and stock
// movements all name their author, and an author that no longer exists makes the paper trail unauditable.
export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await authorized(Permission.MANAGE_USERS);
  if ("response" in guard) return guard.response;
  await connectDB();

  const { userId } = await params;
  if (userId === guard.user.id) return apiError(400, "BAD_REQUEST", "You cannot delete the account you are signed in with.");

  const user = await User.findById(userId).select("_id fullName email role").lean() as Pick<IUser, "_id" | "fullName" | "email" | "role"> | null;
  if (!user) return apiError(404, "NOT_FOUND", "Staff account not found.");
  if (user.role === UserRole.OWNER) return apiError(400, "BAD_REQUEST", "Owner accounts are disabled, not deleted.");

  const [sales, saleReturns, collections, purchases, purchaseReturns, supplierPayments, movements, expenses] = await Promise.all([
    Sale.countDocuments({ createdById: userId }),
    SaleReturn.countDocuments({ createdById: userId }),
    SalePayment.countDocuments({ collectedById: userId }),
    Purchase.countDocuments({ createdById: userId }),
    PurchaseReturn.countDocuments({ createdById: userId }),
    PurchasePayment.countDocuments({ madeById: userId }),
    StockMovement.countDocuments({ actorId: userId }),
    Expense.countDocuments({ $or: [{ createdById: userId }, { voidedById: userId }] }),
  ]);
  const held: [string, number][] = [["sale", sales], ["customer return", saleReturns], ["payment collected", collections], ["purchase", purchases], ["supplier return", purchaseReturns], ["supplier payment", supplierPayments], ["stock movement", movements], ["expense", expenses]];
  const summary = held.filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`).join(", ");
  if (summary) return apiError(409, "CONFLICT", `${user.fullName} already left records (${summary}). Disable the account instead of deleting it, so those records keep their author.`);

  await RefreshSession.deleteMany({ userId });
  await User.findByIdAndDelete(userId);
  await AuditLog.create({
    _id: randomUUID(),
    actorId: guard.user.id, action: "user.deleted", entityType: "user", entityId: userId,
    metadata: { deletedAccount: `${user.fullName} <${user.email}>` },
  });

  return NextResponse.json({ ok: true, message: `${user.fullName} was deleted — the account had no records of its own.` });
}

class UserUpdateError extends Error {}