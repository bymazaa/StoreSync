import { NextResponse } from "next/server";
import zlib from "zlib";
import connectDB from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { UserRole } from "@/types";
import {
  Settings,
  User,
  RolePermission,
  Category,
  Unit,
  Product,
  ProductUnit,
  Supplier,
  Customer,
  Purchase,
  PurchaseItem,
  InventoryBatch,
  Sale,
  SaleItem,
  SaleItemBatch,
  PaymentMethod,
  SalePayment,
  PurchasePayment,
  SaleReturn,
  SaleReturnItem,
  PurchaseReturn,
  PurchaseReturnItem,
  StockMovement,
  Expense,
  AuditLog,
} from "@/models";

export async function GET(request: Request) {
  try {
    await connectDB();
    const user = await getCurrentUser();

    if (!user || user.role !== UserRole.OWNER) {
      return NextResponse.json(
        { error: { message: "Only the store OWNER is authorized to download database backups." } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "gzip"; // "gzip" or "json"

    // Fetch all collection data
    const [
      settings,
      users,
      rolePermissions,
      categories,
      units,
      products,
      productUnits,
      suppliers,
      customers,
      purchases,
      purchaseItems,
      inventoryBatches,
      sales,
      saleItems,
      saleItemBatches,
      paymentMethods,
      salePayments,
      purchasePayments,
      saleReturns,
      saleReturnItems,
      purchaseReturns,
      purchaseReturnItems,
      stockMovements,
      expenses,
      auditLogs,
    ] = await Promise.all([
      Settings.find({}).lean(),
      User.find({}).lean(),
      RolePermission.find({}).lean(),
      Category.find({}).lean(),
      Unit.find({}).lean(),
      Product.find({}).lean(),
      ProductUnit.find({}).lean(),
      Supplier.find({}).lean(),
      Customer.find({}).lean(),
      Purchase.find({}).lean(),
      PurchaseItem.find({}).lean(),
      InventoryBatch.find({}).lean(),
      Sale.find({}).lean(),
      SaleItem.find({}).lean(),
      SaleItemBatch.find({}).lean(),
      PaymentMethod.find({}).lean(),
      SalePayment.find({}).lean(),
      PurchasePayment.find({}).lean(),
      SaleReturn.find({}).lean(),
      SaleReturnItem.find({}).lean(),
      PurchaseReturn.find({}).lean(),
      PurchaseReturnItem.find({}).lean(),
      StockMovement.find({}).lean(),
      Expense.find({}).lean(),
      AuditLog.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    const backupPayload = {
      app: "stockpilot",
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: {
        Settings: settings.length,
        User: users.length,
        RolePermission: rolePermissions.length,
        Category: categories.length,
        Unit: units.length,
        Product: products.length,
        ProductUnit: productUnits.length,
        Supplier: suppliers.length,
        Customer: customers.length,
        Purchase: purchases.length,
        PurchaseItem: purchaseItems.length,
        InventoryBatch: inventoryBatches.length,
        Sale: sales.length,
        SaleItem: saleItems.length,
        SaleItemBatch: saleItemBatches.length,
        PaymentMethod: paymentMethods.length,
        SalePayment: salePayments.length,
        PurchasePayment: purchasePayments.length,
        SaleReturn: saleReturns.length,
        SaleReturnItem: saleReturnItems.length,
        PurchaseReturn: purchaseReturns.length,
        PurchaseReturnItem: purchaseReturnItems.length,
        StockMovement: stockMovements.length,
        Expense: expenses.length,
        AuditLog: auditLogs.length,
      },
      data: {
        Settings: settings,
        User: users,
        RolePermission: rolePermissions,
        Category: categories,
        Unit: units,
        Product: products,
        ProductUnit: productUnits,
        Supplier: suppliers,
        Customer: customers,
        Purchase: purchases,
        PurchaseItem: purchaseItems,
        InventoryBatch: inventoryBatches,
        Sale: sales,
        SaleItem: saleItems,
        SaleItemBatch: saleItemBatches,
        PaymentMethod: paymentMethods,
        SalePayment: salePayments,
        PurchasePayment: purchasePayments,
        SaleReturn: saleReturns,
        SaleReturnItem: saleReturnItems,
        PurchaseReturn: purchaseReturns,
        PurchaseReturnItem: purchaseReturnItems,
        StockMovement: stockMovements,
        Expense: expenses,
        AuditLog: auditLogs,
      },
    };

    // Update lastBackupAt timestamp in Settings
    const now = new Date();
    await Settings.findByIdAndUpdate("shop", { lastBackupAt: now });

    // Log the backup action
    const ipAddress = request.headers.get("x-real-ip")?.trim().slice(0, 64) || null;
    await AuditLog.create({
      actorId: user.id,
      action: "BACKUP_DOWNLOADED",
      entityType: "SYSTEM",
      metadata: {
        format,
        exportedAt: now.toISOString(),
        totalProducts: products.length,
        totalSales: sales.length,
      },
      ipAddress,
    }).catch(() => null);

    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);
    const jsonString = JSON.stringify(backupPayload);

    if (format === "json") {
      return new NextResponse(jsonString, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="stockpilot-backup-${dateStr}.json"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // Default: in-memory gzip compression (fast & compact for Vercel serverless)
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, "utf-8"));

    return new NextResponse(compressedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="stockpilot-backup-${dateStr}.json.gz"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Backup generation error:", error);
    return NextResponse.json(
      { error: { message: error.message || "Failed to generate database backup." } },
      { status: 500 }
    );
  }
}
