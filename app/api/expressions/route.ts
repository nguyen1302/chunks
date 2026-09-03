import { NextResponse } from "next/server";
import { createExpression, getExpressionsWithStats } from "@/lib/notion";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getExpressionsWithStats());
  } catch (err) {
    return errorResponse("Failed to load expressions", err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = (body?.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Expression is required" }, { status: 400 });
    const created = await createExpression(
      {
        text,
        meaning: (body?.meaning ?? "").trim(),
        example: (body?.example ?? "").trim(),
        source: (body?.source ?? "").trim(),
      },
      todayStr(),
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return errorResponse("Failed to create expression", err);
  }
}
