import { NextResponse } from "next/server";
import { getStudyProgress, updatePlan } from "@/lib/store";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getStudyProgress());
  } catch (err) {
    return errorResponse("Failed to load study plan", err);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    await updatePlan({
      enabled: !!body?.enabled,
      newPerDay: Number(body?.newPerDay ?? 12),
      startLevel: String(body?.startLevel ?? "A1"),
    });
    return NextResponse.json(await getStudyProgress());
  } catch (err) {
    return errorResponse("Failed to update study plan", err);
  }
}
