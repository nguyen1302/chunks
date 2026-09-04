import { NextResponse } from "next/server";
import { runDailyDrip } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Activate today's batch of new Oxford-3000 words (idempotent per day).
export async function GET() {
  try {
    const res = await runDailyDrip(todayStr());
    return NextResponse.json(res);
  } catch (err) {
    return errorResponse("Failed to run daily study drip", err);
  }
}
