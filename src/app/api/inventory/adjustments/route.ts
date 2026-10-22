import { NextResponse } from "next/server";
import { Permission, StockDirection } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Product from "@/models/Product";
import InventoryBatch from "@/models/InventoryBatch";
import StockMovement from "@/models/StockMovement";
import AuditLog from "@/models/AuditLog";
import Settings from "@/models/Settings";
import Unit from "@/models/Unit";
import { invalidBody } from "@/lib/http/api-response";
import { adjustmentSchema } from "@/lib/validation/api";
import { usesWholeQuantity } from "@/lib/quantity";

// Helper to convert Decimal128/string to number
const toNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString());
};

// Helper to parse decimal string input to number
const parseDecimalString = (val: string | number): number => {
  if (typeof val === 'number') return val;
  return parseFloat(val);
};

export async function POST(request: Request) {
  const guard = await authorized(Permission.ADJUST_STOCK);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = adjustmentSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  const input = parsed.data;
  
  if (input.clientRequestId) {
    const replay = await replayAdjustment(input.clientRequestId, guard.user.id);
    if (replay) return replay;
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const product = await Product.findById(input.productId).session(session).lean();
    if (!product || !product.isActive) throw new AdjustmentError("Product was not found.");
    
    const quantity = parseDecimalString(input.quantity);
    const baseUnit = await Unit.findById(product.baseUnitId).session(session).lean();
    if (usesWholeQuantity(baseUnit!.name, baseUnit!.symbol) && !Number.isInteger(quantity)) {
      throw new AdjustmentError("Counted units must be adjusted in whole-number quantities.");
    }
    if (!usesWholeQuantity(baseUnit!.name, baseUnit!.symbol) && quantity.toString().split('.')[1]?.length > 2) {
      throw new AdjustmentError("Measured quantities can have at most two decimal places.");
    }
    
    if (input.direction === StockDirection.IN && product.tracksBatch && !input.batchNumber) {
      throw new AdjustmentError("A batch number is required for this product.");
    }
    if (input.direction === StockDirection.IN && product.tracksExpiry && !input.expiresAt) {
      throw new AdjustmentError("An expiry date is required for this product.");
    }
    
    // Update stock
    let result;
    if (input.direction === StockDirection.IN) {
      result = await Product.findByIdAndUpdate(
        product._id,
        { $inc: { stockOnHand: quantity } },
        { session, returnDocument: "after" }
      );
    } else {
      // Check if enough stock
      const currentStock = toNumber(product.stockOnHand);
      if (currentStock < quantity) {
        throw new AdjustmentError("Not enough stock to make this adjustment.");
      }
      result = await Product.findByIdAndUpdate(
        product._id,
        { $inc: { stockOnHand: -quantity } },
        { session, returnDocument: "after" }
      );
    }
    
    if (!result) throw new AdjustmentError("Not enough stock to make this adjustment.");
    
    // Create inventory batch for IN adjustments
    if (input.direction === StockDirection.IN) {
      await InventoryBatch.create([{
        productId: product._id,
        batchNumber: input.batchNumber || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        receivedQuantity: quantity,
        availableQuantity: quantity,
        costPerBaseUnit: toNumber(product.purchasePrice),
      }], { session });
    }
    
    // Handle batch allocations for OUT adjustments
    if (input.direction === StockDirection.OUT) {
      let remaining = quantity;
      const settings = await Settings.findById("shop").select("costingMethod").session(session).lean();
      
      const sortCriteria = settings?.costingMethod === "FIFO"
        ? { createdAt: "asc" as const, expiresAt: "asc" as const }
        : { expiresAt: "asc" as const, createdAt: "asc" as const };
      
      const batches = await InventoryBatch.find({ 
        productId: product._id, 
        availableQuantity: { $gt: 0 } 
      })
      .sort(sortCriteria)
      .session(session)
      .lean();
      
      for (const batch of batches) {
        if (remaining <= 0) break;
        const batchAvailable = toNumber(batch.availableQuantity);
        const allocation = Math.min(batchAvailable, remaining);
        
        const changed = await InventoryBatch.updateMany(
          { _id: batch._id, availableQuantity: { $gte: allocation } },
          { $inc: { availableQuantity: -allocation } },
          { session }
        );
        if (changed.modifiedCount !== 1) throw new AdjustmentError("Batch stock changed. Please try again.");
        remaining -= allocation;
      }
      
      if (remaining > 0) throw new AdjustmentError("Tracked batch stock is not enough for this adjustment.");
    }
    
    const updated = await Product.findById(product._id).select("stockOnHand").session(session).lean();
    
    // Count existing movements
    const movementCount = await StockMovement.countDocuments({ productId: product._id }).session(session);
    
    const created = await StockMovement.create([{
      clientRequestId: input.clientRequestId,
      productId: product._id,
      actorId: guard.user.id,
      direction: input.direction,
      reason: input.direction === StockDirection.IN && movementCount === 0 ? "OPENING" : "ADJUSTMENT",
      quantity,
      balanceAfter: toNumber(updated!.stockOnHand),
      costPerBaseUnit: product.purchasePrice,
      note: input.note,
    }], { session });
    
    await AuditLog.create([{
      actorId: guard.user.id, action: "inventory.adjusted", entityType: "stock_movement", entityId: created[0]._id
    }], { session });
    
    await session.commitTransaction();
    
    return NextResponse.json({ movement: created[0] }, { status: 201 });
  } catch (error) {
    await session.abortTransaction();
    
    if (input.clientRequestId && error && typeof error === "object" && "code" in error && error.code === 11000) {
      const replay = await replayAdjustment(input.clientRequestId, guard.user.id);
      if (replay) return replay;
    }
    if (error instanceof AdjustmentError) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    }
    throw error;
  } finally {
    session.endSession();
  }
}

class AdjustmentError extends Error {}

async function replayAdjustment(clientRequestId: string, actorId: string) {
  const movement = await StockMovement.findOne({ clientRequestId }).lean();
  if (!movement) return null;
  if (movement.actorId !== actorId) return NextResponse.json({ error: { code: "CONFLICT", message: "This stock adjustment request key has already been used." } }, { status: 409 });
  return NextResponse.json({ movement, alreadyProcessed: true });
}
