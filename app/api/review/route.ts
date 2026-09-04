import { NextResponse } from "next/server";
import { submitReview } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

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
  } catch (err) {
    return errorResponse("Failed to submit review", err);
  }
}
