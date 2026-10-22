import { NextResponse } from "next/server";
import { Permission, SaleStatus } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Sale, { ISale } from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import SaleItemBatch from "@/models/SaleItemBatch";
import InventoryBatch from "@/models/InventoryBatch";
import Product from "@/models/Product";
import StockMovement from "@/models/StockMovement";
import AuditLog from "@/models/AuditLog";

export async function POST(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const guard = await authorized(Permission.PROCESS_RETURNS);
  if ("response" in guard) return guard.response;
  await connectDB();
  
  const { saleId } = await params;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const existing = await Sale.findById(saleId).lean() as ISale | null;
    if (!existing || existing.status !== SaleStatus.COMPLETED) throw new CancellationError("Only a completed sale can be cancelled.");
    if (existing.paidAmount > 0) throw new CancellationError("This sale has received a payment. Process a customer return instead of cancelling it.");

    // Get sale items
    const items = await SaleItem.find({ saleId }).session(session).lean();
    
    // Restore inventory batches
    const quantities = new Map<string, number>();
    for (const item of items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.baseQuantity);
      
      // Get batch allocations for this item
      const allocations = await SaleItemBatch.find({ saleItemId: item._id }).session(session).lean();
      for (const allocation of allocations) {
        await InventoryBatch.findByIdAndUpdate(
          allocation.inventoryBatchId,
          { $inc: { availableQuantity: allocation.quantity } },
          { session }
        );
      }
    }
    
    // Restore product stock and create movements
    for (const [productId, quantity] of quantities) {
      const result = await Product.updateMany(
        { _id: productId },
        { $inc: { stockOnHand: quantity } },
        { session }
      );
      if (result.modifiedCount !== 1) throw new CancellationError("Product stock could not be restored.");
      
      const product = await Product.findById(productId).select("stockOnHand purchasePrice").session(session).lean();
      await StockMovement.create([{
        productId,
        actorId: guard.user.id,
        direction: "IN",
        reason: "VOIDED_SALE",
        quantity,
        balanceAfter: product!.stockOnHand,
        costPerBaseUnit: product!.purchasePrice,
        sourceType: "sale_cancel",
        sourceId: existing._id,
      }], { session });
    }
    
    // Update sale status
    await Sale.findByIdAndUpdate(existing._id, { status: SaleStatus.CANCELLED, dueAmount: 0 }, { session });
    
    await AuditLog.create([{
      actorId: guard.user.id,
      action: "sale.cancelled",
      entityType: "sale",
      entityId: existing._id,
      metadata: { invoiceNumber: existing.invoiceNumber },
    }], { session });
    
    await session.commitTransaction();
    
    const updatedSale = await Sale.findById(existing._id).lean();
    return NextResponse.json({ sale: updatedSale });
  } catch (error) {
    await session.abortTransaction();
    if (error instanceof CancellationError) return NextResponse.json({ error: { code: "BAD_REQUEST", message: error.message } }, { status: 400 });
    throw error;
  } finally {
    session.endSession();
  }
}

class CancellationError extends Error {}
