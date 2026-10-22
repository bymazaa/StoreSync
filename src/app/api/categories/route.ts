import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized, authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { Category, Product, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { categorySchema } from "@/lib/validation/api";


export async function GET(request: Request) {
  await connectDB();
  const guard = await authorizedAny([Permission.MANAGE_PRODUCTS, Permission.CREATE_SALES, Permission.CREATE_PURCHASES]);
  if ("response" in guard) return guard.response;
  
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true"
    && guard.user.rolePermissions.some((entry) => entry.permission === Permission.MANAGE_PRODUCTS);
  
  const categories = await Category.find(includeInactive ? {} : { isActive: true })
    .sort({ name: 1 })
    .lean();
  
  // Count products for each category
  const categoriesWithCount = await Promise.all(
    categories.map(async (cat) => {
      const productCount = await Product.countDocuments({ categoryId: cat._id });
      return { ...cat, id: cat._id, _count: { products: productCount } };
    })
  );
  
  return NextResponse.json({ categories: categoriesWithCount });
}

export async function POST(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_PRODUCTS);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  
  try {
    const id = crypto.randomUUID();
    
    if (parsed.data.parentId) {
      const parent = await Category.findOne({ _id: parsed.data.parentId, isActive: true }).lean();
      if (!parent) {
        return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Parent category was not found." } }, { status: 400 });
      }
    }
    
    const category = await Category.create({ _id: id, ...parsed.data });
    
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "category.created",
      entityType: "category",
      entityId: id,
    });
    
    return NextResponse.json({ category }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "That category name already exists." } }, { status: 409 });
    }
    throw error;
  }
}
