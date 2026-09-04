import { NextResponse } from "next/server";
import { removeSubscription } from "@/lib/push";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const endpoint = body?.endpoint;
    if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("Failed to remove subscription", err);
  }
}
