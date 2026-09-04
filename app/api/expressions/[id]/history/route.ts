import { NextResponse } from "next/server";
import { getHistory, addPastSentence } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await getHistory(id);
    return NextResponse.json(history);
  } catch (err) {
    return errorResponse("Failed to load history", err);
  }
}

// Backfill a past sentence (no review outcome) for this expression.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sentence = (body?.sentence ?? "").trim();
    if (!sentence) return NextResponse.json({ error: "Sentence is required" }, { status: 400 });
    const created = await addPastSentence({ expressionId: id, sentence }, todayStr());
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return errorResponse("Failed to add past sentence", err);
  }
}
