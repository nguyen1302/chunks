import { NextResponse } from "next/server";
import { submitReview } from "@/lib/notion";
import { todayStr } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const expressionId = body?.expressionId;
    const sentence = (body?.sentence ?? "").trim();
    const result = body?.result;
    if (!expressionId || !sentence || (result !== "Remembered" && result !== "Forgot")) {
      return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
    }
    await submitReview({ expressionId, sentence, result }, todayStr());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
