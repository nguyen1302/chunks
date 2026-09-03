import { NextResponse } from "next/server";
import { getHistory } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await getHistory(id);
    return NextResponse.json(history);
  } catch {
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
