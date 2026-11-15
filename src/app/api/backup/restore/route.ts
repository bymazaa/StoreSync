import { NextResponse } from "next/server";
import zlib from "zlib";
import { compare } from "bcryptjs";
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
  RefreshSession,
  LoginThrottle,
} from "@/models";

export async function POST(request: Request) {
  try {
    await connectDB();
    const currentUser = await getCurrentUser();

    // 1. Owner authorization guard
    if (!currentUser || currentUser.role !== UserRole.OWNER) {
      return NextResponse.json(
        { error: { message: "Access denied. Only the store OWNER is permitted to restore the database." } },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const password = (formData.get("password") as string || "").trim();
    const confirmText = (formData.get("confirmText") as string || "").trim();

    // 2. Validate confirmation phrase
    if (confirmText.toUpperCase() !== "RESTORE") {
      return NextResponse.json(
        { error: { message: 'Confirmation failed. Please type "RESTORE" exactly to confirm.' } },
        { status: 400 }
      );
    }

    // 3. Password verification
    if (!password) {
      return NextResponse.json(
        { error: { message: "Owner password is required to perform a database restore." } },
        { status: 400 }
      );
    }

    const ownerRecord = await User.findById(currentUser.id).select("+passwordHash passwordHash").lean();
    if (!ownerRecord || !ownerRecord.passwordHash) {
      return NextResponse.json(
        { error: { message: "Owner account could not be verified." } },
        { status: 404 }
      );
    }

    const isPasswordValid = await compare(password, ownerRecord.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: { message: "Invalid owner password. Restore request rejected for security." } },
        { status: 401 }
      );
    }

    // 4. File existence & size check
    if (!file) {
      return NextResponse.json(
        { error: { message: "No backup file was uploaded." } },
        { status: 400 }
      );
    }

    const maxSizeBytes = 60 * 1024 * 1024; // 60MB limit
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: { message: "File exceeds maximum permitted size of 60MB." } },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (fileBuffer.length === 0) {
      return NextResponse.json(
        { error: { message: "The uploaded backup file is completely empty." } },
        { status: 400 }
      );
    }

    // 5. Decompression (Gzip / plain JSON detection)
    let jsonString: string;
    try {
      if (fileBuffer.length >= 2 && fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b) {
        // Gzip compressed
        const decompressed = zlib.gunzipSync(fileBuffer);
        jsonString = decompressed.toString("utf-8");
      } else {
        // Assume UTF-8 JSON text
        jsonString = fileBuffer.toString("utf-8");
      }
    } catch {
      return NextResponse.json(
        { error: { message: "Failed to decompress file. File is either corrupted or not a valid gzip/JSON file." } },
        { status: 400 }
      );
    }

    // 6. JSON & Structure Integrity Checks
    let backupObj: any;
    try {
      backupObj = JSON.parse(jsonString);
    } catch {
      return NextResponse.json(
        { error: { message: "File syntax error: The decompressed content is not valid JSON." } },
        { status: 400 }
      );
    }

    if (!backupObj || typeof backupObj !== "object") {
      return NextResponse.json(
        { error: { message: "Invalid backup format: root must be a JSON object." } },
        { status: 400 }
      );
    }

    // Signature check
    if (backupObj.app !== "stockpilot") {
      return NextResponse.json(
        { error: { message: 'Security rejection: Missing "stockpilot" app signature. This file is not a verified StockPilot backup.' } },
        { status: 400 }
      );
    }

    if (!backupObj.data || typeof backupObj.data !== "object") {
      return NextResponse.json(
        { error: { message: 'Corrupted backup file: "data" dictionary is missing.' } },
        { status: 400 }
      );
    }

    // Mandatory collections check
    const requiredCollections = ["Settings", "User", "RolePermission", "Product"];
    for (const col of requiredCollections) {
      if (!Array.isArray(backupObj.data[col])) {
        return NextResponse.json(
          { error: { message: `Incomplete backup: Required collection "${col}" is missing from the file.` } },
          { status: 400 }
        );
      }
    }

    // Ensure at least 1 OWNER exists in the backup user list
    const usersInBackup = backupObj.data.User;
    const hasOwner = Array.isArray(usersInBackup) && usersInBackup.some((u: any) => u.role === UserRole.OWNER);
    if (!hasOwner) {
      return NextResponse.json(
        { error: { message: "Safety rejection: The backup file contains no OWNER account. Restoring it would permanently lock you out." } },
        { status: 400 }
      );
    }

    // 7. Database Overwrite & Restore
    const MODEL_REGISTRY: { name: string; model: any }[] = [
      { name: "Settings", model: Settings },
      { name: "User", model: User },
      { name: "RolePermission", model: RolePermission },
      { name: "Category", model: Category },
      { name: "Unit", model: Unit },
      { name: "Product", model: Product },
      { name: "ProductUnit", model: ProductUnit },
      { name: "Supplier", model: Supplier },
      { name: "Customer", model: Customer },
      { name: "InventoryBatch", model: InventoryBatch },
      { name: "Purchase", model: Purchase },
      { name: "PurchaseItem", model: PurchaseItem },
      { name: "PurchasePayment", model: PurchasePayment },
      { name: "Sale", model: Sale },
      { name: "SaleItem", model: SaleItem },
      { name: "SaleItemBatch", model: SaleItemBatch },
      { name: "PaymentMethod", model: PaymentMethod },
      { name: "SalePayment", model: SalePayment },
      { name: "PurchaseReturn", model: PurchaseReturn },
      { name: "PurchaseReturnItem", model: PurchaseReturnItem },
      { name: "SaleReturn", model: SaleReturn },
      { name: "SaleReturnItem", model: SaleReturnItem },
      { name: "StockMovement", model: StockMovement },
      { name: "Expense", model: Expense },
      { name: "AuditLog", model: AuditLog },
    ];

    // Wipe temporary sessions and throttles
    await RefreshSession.deleteMany({}).catch(() => null);
    await LoginThrottle.deleteMany({}).catch(() => null);

    const restoreSummary: Record<string, number> = {};

    // Restore each collection
    for (const item of MODEL_REGISTRY) {
      const records = backupObj.data[item.name];
      // 1. Delete all existing records
      await item.model.deleteMany({});
      // 2. Insert records if any exist
      if (Array.isArray(records) && records.length > 0) {
        await item.model.insertMany(records, { ordered: false });
        restoreSummary[item.name] = records.length;
      } else {
        restoreSummary[item.name] = 0;
      }
    }

    // Update lastBackupAt timestamp in restored Settings
    const now = new Date();
    await Settings.findByIdAndUpdate("shop", { lastBackupAt: now });

    // Record audit log for the restore event
    const ipAddress = request.headers.get("x-real-ip")?.trim().slice(0, 64) || null;
    await AuditLog.create({
      actorId: currentUser.id,
      action: "DATABASE_RESTORED",
      entityType: "SYSTEM",
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        backupExportedAt: backupObj.exportedAt,
        restoredCollections: Object.keys(restoreSummary).length,
      },
      ipAddress,
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: "Database successfully restored from backup.",
      restoredAt: now.toISOString(),
      summary: restoreSummary,
    });
  } catch (error: any) {
    console.error("Database restore failed:", error);
    return NextResponse.json(
      { error: { message: error.message || "An unexpected error occurred during database restore." } },
      { status: 500 }
    );
  }
}
