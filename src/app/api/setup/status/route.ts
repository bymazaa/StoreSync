import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User, Settings } from "@/models";

export async function GET() {
  await connectDB();
  const [userCount, settings] = await Promise.all([
    User.countDocuments({}),
    Settings.findById("shop").select("shopName").lean(),
  ]);
  return NextResponse.json({ 
    setupRequired: userCount === 0, 
    shopName: settings?.shopName ?? "StockPilot" 
  });
}
