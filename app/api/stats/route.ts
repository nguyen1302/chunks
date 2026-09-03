import { NextResponse } from "next/server";
import { getStats } from "@/lib/notion";
import { todayStr } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getStats(todayStr()));
  } catch {
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
