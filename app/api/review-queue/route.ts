import { NextResponse } from "next/server";
import { getDueExpressions } from "@/lib/notion";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getDueExpressions(todayStr());
    return NextResponse.json(items);
  } catch (err) {
    return errorResponse("Failed to load review queue", err);
  }
}
