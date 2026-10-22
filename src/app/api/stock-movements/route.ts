import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorizedAny } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { StockMovement, Product, Unit, User } from "@/models";
import { apiError } from "@/lib/http/api-response";
import { reportDateRange } from "@/lib/date-time";
import { z } from "zod";

export async function GET(request: Request) {
  await connectDB();
  const guard = await authorizedAny([Permission.VIEW_REPORTS, Permission.ADJUST_STOCK, Permission.MANAGE_PRODUCTS]);
  if ("response" in guard) return guard.response;
  
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  
  if (productId && !z.uuid().safeParse(productId).success) {
    return apiError(400, "BAD_REQUEST", "Invalid product ID.");
  }
  
  const settings = await import('@/models').then(m => m.Settings.findById("shop").select("timezone").lean());
  let dateRange;
  try { 
    dateRange = reportDateRange(from, to, settings?.timezone ?? "America/New_York"); 
  } catch (error) { 
    return apiError(400, "BAD_REQUEST", error instanceof Error ? error.message : "Invalid date range."); 
  }
  
  let query: any = {};
  if (productId) query.productId = productId;
  if (dateRange) query.createdAt = dateRange;
  
  const movements = await StockMovement.find(query)
    .populate('productId', 'name sku')
    .populate('actorId', 'fullName')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  
  // Fetch base unit symbols separately
  const movementsWithUnit = await Promise.all(
    movements.map(async (movement) => {
      const product = await Product.findById(movement.productId._id).populate('baseUnitId', 'symbol').lean();
      return {
        id: movement._id,
        ...movement,
        product: {
          ...movement.productId,
          baseUnit: product?.baseUnitId
        },
        actor: movement.actorId || null
      };
    })
  );
  
  return NextResponse.json({ movements: movementsWithUnit });
}
