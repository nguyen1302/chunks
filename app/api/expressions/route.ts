import { NextResponse } from "next/server";
import { createExpression, getExpressionsWithStats } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { parseSynonyms } from "@/lib/synonyms";
import { parseTags } from "@/lib/tags";
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
        synonyms: parseSynonyms(body?.synonyms ?? ""),
        tags: parseTags(body?.tags ?? ""),
      },
      todayStr(),
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return errorResponse("Failed to create expression", err);
  }
}
