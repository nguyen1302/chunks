import { NextResponse } from "next/server";
import { getDueExpressions } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const tag = new URL(req.url).searchParams.get("tag") || undefined;
    const items = await getDueExpressions(todayStr(), 20, tag);
    return NextResponse.json(items);
  } catch (err) {
    return errorResponse("Failed to load review queue", err);
  }
}
