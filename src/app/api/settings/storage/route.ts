import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { Permission, UserRole } from "@/types";

const DEFAULT_STORAGE_CAPACITY_BYTES = 512 * 1024 * 1024;

export async function GET() {
  const guard = await authorized(Permission.MANAGE_SETTINGS);
  if ("response" in guard) return guard.response;
  if (guard.user.role !== UserRole.OWNER) {
    return NextResponse.json({ error: { message: "Only the shop owner can view database storage." } }, { status: 403 });
  }

  try {
    const mongoose = await connectDB();
    const database = mongoose.connection.db;
    if (!database) throw new Error("The database connection is not ready.");

    const stats = await database.stats();
    const dataBytes = Number(stats.dataSize ?? 0);
    const indexBytes = Number(stats.indexSize ?? 0);
    const configuredValue = process.env.MONGODB_STORAGE_LIMIT_MB?.trim();
    const configuredCapacity = Number(configuredValue || (DEFAULT_STORAGE_CAPACITY_BYTES / (1024 * 1024))) * 1024 * 1024;
    const hasConfiguredCapacity = Boolean(configuredValue) && Number.isFinite(configuredCapacity) && configuredCapacity > 0;
    const capacityBytes = hasConfiguredCapacity ? configuredCapacity : DEFAULT_STORAGE_CAPACITY_BYTES;
    const capacitySource = hasConfiguredCapacity ? "configured" : "default";

    return NextResponse.json(
      {
        dataBytes,
        indexBytes,
        usedBytes: dataBytes + indexBytes,
        capacityBytes,
        capacitySource,
        measuredAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: { message: "Storage metrics could not be read. Check the database user's stats permissions." } },
      { status: 503 },
    );
  }
}
