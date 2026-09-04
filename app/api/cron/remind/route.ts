import { NextResponse } from "next/server";
import { getStats } from "@/lib/store";
import { sendToAll } from "@/lib/push";
import { todayStr } from "@/lib/dates";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily reminder. Protected by CRON_SECRET (Vercel Cron sends it as a Bearer).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const stats = await getStats(todayStr());
    const due = stats.activity.dueToday;
    if (due <= 0) return NextResponse.json({ skipped: true, due });
    const res = await sendToAll({
      title: "chunks",
      body: `${due} word${due === 1 ? "" : "s"} ready to review.`,
      url: "/",
    });
    return NextResponse.json({ due, ...res });
  } catch (err) {
    return errorResponse("Failed to send reminders", err);
  }
}
