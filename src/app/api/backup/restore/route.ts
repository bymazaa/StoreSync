import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import mongoose, { type ClientSession } from "mongoose";
import { compare } from "bcryptjs";
import connectDB from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { UserRole } from "@/types";
import { getClientIp } from "@/lib/auth/login-history";
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

const MAX_REQUEST_BYTES = 4_500_000;
const MAX_FILE_BYTES = 4_000_000;
const MAX_DECOMPRESSED_BYTES = 64 * 1024 * 1024;

type BackupRecord = Record<string, unknown>;
type RestoreModel = {
  deleteMany(filter: Record<string, never>, options: { session: ClientSession }): Promise<unknown>;
  insertMany(records: BackupRecord[], options: { session: ClientSession; ordered: true }): Promise<unknown[]>;
};

function isRecord(value: unknown): value is BackupRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function restoreCollection(name: string, model: unknown) {
  return { name, model: model as RestoreModel };
}

const MODEL_REGISTRY = [
  restoreCollection("Settings", Settings),
  restoreCollection("User", User),
  restoreCollection("RolePermission", RolePermission),
  restoreCollection("Category", Category),
  restoreCollection("Unit", Unit),
  restoreCollection("Product", Product),
  restoreCollection("ProductUnit", ProductUnit),
  restoreCollection("Supplier", Supplier),
  restoreCollection("Customer", Customer),
  restoreCollection("InventoryBatch", InventoryBatch),
  restoreCollection("Purchase", Purchase),
  restoreCollection("PurchaseItem", PurchaseItem),
  restoreCollection("PurchasePayment", PurchasePayment),
  restoreCollection("Sale", Sale),
  restoreCollection("SaleItem", SaleItem),
  restoreCollection("SaleItemBatch", SaleItemBatch),
  restoreCollection("PaymentMethod", PaymentMethod),
  restoreCollection("SalePayment", SalePayment),
  restoreCollection("PurchaseReturn", PurchaseReturn),
  restoreCollection("PurchaseReturnItem", PurchaseReturnItem),
  restoreCollection("SaleReturn", SaleReturn),
  restoreCollection("SaleReturnItem", SaleReturnItem),
  restoreCollection("StockMovement", StockMovement),
  restoreCollection("Expense", Expense),
  restoreCollection("AuditLog", AuditLog),
];

function validationError(message: string) {
  return NextResponse.json({ error: { message } }, { status: 400 });
}

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

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: { message: "Vercel accepts request bodies up to 4.5 MB. Choose a backup file smaller than 4 MB." } },
        { status: 413 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return validationError("Could not read the uploaded form. Choose a valid backup file and try again.");
    }
    const uploadedFile = formData.get("file");
    const file = uploadedFile instanceof File ? uploadedFile : null;
    const passwordValue = formData.get("password");
    const confirmValue = formData.get("confirmText");
    const password = typeof passwordValue === "string" ? passwordValue.trim() : "";
    const confirmText = typeof confirmValue === "string" ? confirmValue.trim() : "";

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

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: { message: "Vercel restore supports backup files up to 4 MB. Larger backups require direct object-storage upload." } },
        { status: 413 }
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
        const decompressed = gunzipSync(fileBuffer, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
        jsonString = decompressed.toString("utf-8");
      } else {
        if (fileBuffer.length > MAX_DECOMPRESSED_BYTES) {
          return validationError("The backup expands beyond the supported 64 MB restore limit.");
        }
        jsonString = fileBuffer.toString("utf-8");
      }
    } catch {
      return NextResponse.json(
        { error: { message: "Could not decompress the backup. It may be corrupt or expand beyond the supported 64 MB restore limit." } },
        { status: 400 }
      );
    }

    // Validate the complete backup before starting any database writes.
    let backupObj: unknown;
    try {
      backupObj = JSON.parse(jsonString);
    } catch {
      return validationError("The decompressed backup is not valid JSON.");
    }

    if (!isRecord(backupObj)) return validationError("Invalid backup format: root must be a JSON object.");

    if (backupObj.app !== "stockpilot") {
      return validationError('This file is not a StockPilot backup (missing "stockpilot" signature).');
    }

    if (backupObj.version !== 1 || !isRecord(backupObj.data) || !isRecord(backupObj.counts)) {
      return validationError("Unsupported or incomplete backup format. Export a fresh StockPilot backup and try again.");
    }

    const recordsByCollection: Record<string, BackupRecord[]> = {};
    for (const { name } of MODEL_REGISTRY) {
      const records = backupObj.data[name];
      if (!Array.isArray(records)) {
        return validationError(`Incomplete backup: collection "${name}" is missing or invalid.`);
      }
      if (!records.every((record): record is BackupRecord => isRecord(record) && typeof record._id === "string" && record._id.length > 0)) {
        return validationError(`Invalid backup data in collection "${name}".`);
      }
      if (backupObj.counts[name] !== records.length) {
        return validationError(`Backup integrity check failed for collection "${name}".`);
      }
      recordsByCollection[name] = records;
    }

    if (!Number.isFinite(Date.parse(String(backupObj.exportedAt)))) {
      return validationError("Backup export date is invalid.");
    }
    if (!recordsByCollection.Settings.some((record) => record._id === "shop")) {
      return validationError('Backup is missing the required "shop" settings record.');
    }
    const usersInBackup = recordsByCollection.User;
    const hasOwner = usersInBackup.some((user) => user.role === UserRole.OWNER);
    if (!hasOwner) {
      return validationError("The backup contains no OWNER account, so it cannot be restored safely.");
    }

    const clientIp = getClientIp(request);
    const ipAddress = clientIp === "unknown" ? null : clientIp;
    const now = new Date();
    const session = await mongoose.startSession();
    let restoreSummary: Record<string, number> = {};

    try {
      await session.withTransaction(async () => {
        const summary: Record<string, number> = {};
        await RefreshSession.deleteMany({}, { session });
        await LoginThrottle.deleteMany({}, { session });

        for (const item of MODEL_REGISTRY) {
          const records = recordsByCollection[item.name];
          await item.model.deleteMany({}, { session });
          if (records.length > 0) {
            await item.model.insertMany(records, { session, ordered: true });
          }
          summary[item.name] = records.length;
        }

        // Invalidate access JWTs issued before this restore as well as refresh sessions.
        await User.updateMany({}, { $inc: { sessionVersion: 1 } }, { session });
        await Settings.findByIdAndUpdate("shop", { lastBackupAt: now }, { session });
        await AuditLog.create([{
          actorId: currentUser.id,
          action: "DATABASE_RESTORED",
          entityType: "SYSTEM",
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            backupExportedAt: backupObj.exportedAt,
            restoredCollections: MODEL_REGISTRY.length,
          },
          ipAddress,
        }], { session });
        restoreSummary = summary;
      }, {
        readPreference: "primary",
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        maxCommitTimeMS: 10_000,
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      success: true,
      message: "Database successfully restored from backup.",
      restoredAt: now.toISOString(),
      summary: restoreSummary,
    });
  } catch (error: unknown) {
    console.error("Database restore failed:", error);
    const message = error instanceof Error ? error.message : "";
    const errorCode = isRecord(error) ? error.code : undefined;
    if (errorCode === 20 || message.includes("Transaction numbers are only allowed")) {
      return NextResponse.json(
        { error: { message: "Database restore requires MongoDB Atlas or another replica-set deployment. No records were changed." } },
        { status: 503 },
      );
    }
    if (message.includes("Transaction exceeded lifetime limit") || message.includes("transactionLifetimeLimitSeconds")) {
      return NextResponse.json(
        { error: { message: "This backup is too large to restore within the database transaction limit. No records were changed." } },
        { status: 413 },
      );
    }
    return NextResponse.json(
      { error: { message: "Restore failed. The database transaction was rolled back, so existing records remain intact." } },
      { status: 500 }
    );
  }
}
