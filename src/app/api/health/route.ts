import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/db-helpers";

/** Report readiness only when the database used by shop workflows is reachable. */
export async function GET() {
  try {
    const isConnected = await healthCheck();
    if (isConnected) {
      return NextResponse.json({ status: "ok" });
    } else {
      return NextResponse.json({ status: "unavailable" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
