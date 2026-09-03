import { NextResponse } from "next/server";
import { updateExpression } from "@/lib/notion";
import { parseSynonyms } from "@/lib/synonyms";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Edit an expression's content fields (Expression/Meaning/Example/Source/Synonyms).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const text = (body?.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Expression is required" }, { status: 400 });
    const updated = await updateExpression(id, {
      text,
      meaning: (body?.meaning ?? "").trim(),
      example: (body?.example ?? "").trim(),
      source: (body?.source ?? "").trim(),
      synonyms: parseSynonyms(body?.synonyms ?? ""),
    });
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse("Failed to update expression", err);
  }
}
