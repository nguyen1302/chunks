import { NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    await saveSubscription({ endpoint, keys: { p256dh, auth } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("Failed to save subscription", err);
  }
}
