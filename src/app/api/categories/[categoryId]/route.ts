import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Category, { ICategory } from "@/models/Category";
import AuditLog from "@/models/AuditLog";
import { invalidBody } from "@/lib/http/api-response";
import { z } from "zod";
import { categoryUpdateSchema } from "@/lib/validation/api";


export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const guard = await authorized(Permission.MANAGE_PRODUCTS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { categoryId } = await params;
  if (!z.uuid().safeParse(categoryId).success) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid category ID." } }, { status: 400 });
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = categoryUpdateSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);

  try {
    const existing = await Category.findById(categoryId).lean() as ICategory | null;
    if (!existing) throw new CategoryUpdateError("Category was not found.", 404);
    
    if (parsed.data.parentId === categoryId) throw new CategoryUpdateError("A category cannot be its own parent.");
    
    if (parsed.data.parentId) {
      let parent = await Category.findOne({ _id: parsed.data.parentId, isActive: true }).lean() as ICategory | null;
      if (!parent) throw new CategoryUpdateError("Parent category was not found.");
      
      // Check for circular reference
      while (parent) {
        if (parent._id === categoryId) throw new CategoryUpdateError("A category cannot be moved under one of its children.");
        parent = parent.parentId ? await Category.findById(parent.parentId).lean() as ICategory | null : null;
      }
    }
    
    const updated = await Category.findByIdAndUpdate(
      categoryId,
      parsed.data,
      { returnDocument: "after", runValidators: true }
    ).lean() as ICategory;
    
    await AuditLog.create({
      _id: randomUUID(),
      actorId: guard.user.id, action: "category.updated", entityType: "category", entityId: categoryId,
      metadata: { changedFields: Object.keys(parsed.data) },
    });
    
    return NextResponse.json({ category: updated });
  } catch (error) {
    if (error instanceof CategoryUpdateError) return NextResponse.json({ error: { code: error.status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message: error.message } }, { status: error.status });
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "That category name already exists." } }, { status: 409 });
    }
    throw error;
  }
}

class CategoryUpdateError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
