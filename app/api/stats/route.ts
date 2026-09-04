import { NextResponse } from "next/server";
import { getStats } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getStats(todayStr()));
  } catch (err) {
    return errorResponse("Failed to load stats", err);
  }
}
