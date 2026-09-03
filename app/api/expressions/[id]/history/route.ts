import { NextResponse } from "next/server";
import { getHistory } from "@/lib/notion";
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
