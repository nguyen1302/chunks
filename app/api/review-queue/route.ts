import { NextResponse } from "next/server";
import { getDueExpressions } from "@/lib/notion";
import { todayStr } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getDueExpressions(todayStr());
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 });
  }
}
