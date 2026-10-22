import { NextResponse } from "next/server";
import { Permission, PurchaseStatus } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Purchase, { IPurchase } from "@/models/Purchase";
import PurchaseItem from "@/models/PurchaseItem";
import InventoryBatch from "@/models/InventoryBatch";
import Product from "@/models/Product";
import StockMovement from "@/models/StockMovement";
import AuditLog from "@/models/AuditLog";

export async function POST(request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const guard = await authorized(Permission.PROCESS_RETURNS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { purchaseId } = await params;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const existing = await Purchase.findById(purchaseId).lean() as IPurchase | null;
    if (!existing || existing.status !== PurchaseStatus.COMPLETED) throw new CancellationError("Only a completed purchase can be cancelled.");
    if (existing.paidAmount > 0) throw new CancellationError("This purchase has a payment. Process a supplier return instead of cancelling it.");

    // Get purchase items with batches
    const items = await PurchaseItem.find({ purchaseId }).session(session).lean();
    
    const quantities = new Map<string, { quantity: number; cost: number; productId: string }>();
    
    for (const item of items) {
      let batchCost = 0;
      
      // Check and update batches
      const batches = await InventoryBatch.find({ purchaseItemId: item._id }).session(session).lean();
      for (const batch of batches) {
        if (batch.availableQuantity < batch.receivedQuantity) {
          throw new CancellationError("Purchased stock has already been sold or adjusted. Create a supplier return instead.");
        }
        batchCost += batch.costPerBaseUnit * batch.receivedQuantity;
        await InventoryBatch.findByIdAndUpdate(
          batch._id,
          { availableQuantity: 0 },
          { session }
        );
      }
      
      const aggregate = quantities.get(item.productId) ?? {
        quantity: 0, cost: 0, productId: item.productId,
      };
      aggregate.quantity += item.baseQuantity;
      aggregate.cost += batchCost;
      quantities.set(item.productId, aggregate);
    }
    
    for (const [productId, aggregate] of quantities) {
      const product = await Product.findById(productId).select("stockOnHand purchasePrice").session(session).lean();
      if (product!.stockOnHand < aggregate.quantity) {
        throw new CancellationError("Not enough remaining stock to reverse this purchase.");
      }
      
      const remainingStock = product!.stockOnHand - aggregate.quantity;
      const remainingValue = product!.stockOnHand * product!.purchasePrice - aggregate.cost;
      const newCost = remainingStock > 0 && remainingValue > 0
        ? parseFloat((remainingValue / remainingStock).toFixed(6))
        : product!.purchasePrice;
      
      await Product.findByIdAndUpdate(
        productId,
        { stockOnHand: remainingStock, purchasePrice: newCost },
        { session }
      );
      
      await StockMovement.create([{
        productId, actorId: guard.user.id, direction: "OUT", reason: "VOIDED_PURCHASE",
        quantity: aggregate.quantity, balanceAfter: remainingStock, costPerBaseUnit: newCost,
        sourceType: "purchase_cancel", sourceId: existing._id,
      }], { session });
    }
    
    await Purchase.findByIdAndUpdate(existing._id, { status: PurchaseStatus.CANCELLED, dueAmount: 0 }, { session });
    
    await AuditLog.create([{
      actorId: guard.user.id, action: "purchase.cancelled", entityType: "purchase", entityId: existing._id, 
      metadata: { invoiceNumber: existing.invoiceNumber }
    }], { session });
    
    await session.commitTransaction();
    
    const updated = await Purchase.findById(existing._id).lean();
    return NextResponse.json({ purchase: updated });
  } catch (error) {
    await session.abortTransaction();
    if (error instanceof CancellationError) return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    throw error;
  } finally {
    session.endSession();
  }
}

class CancellationError extends Error {}
