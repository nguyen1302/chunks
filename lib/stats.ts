import { diffDays } from "./dates";
import type { Expression, ExpressionWithStats, ReviewExample, Stats } from "./types";

export type Mastery = "new" | "learning" | "solid" | "mastered";

/** Bucket an SR level into a mastery band. */
export function masteryBucket(level: number): Mastery {
  if (level <= 0) return "new";
  if (level <= 2) return "learning";
  if (level <= 4) return "solid";
  return "mastered";
}

/**
 * Current and best day-streaks from a list of activity dates (YYYY-MM-DD).
 * The current streak stays alive if the most recent activity is today or
 * yesterday; it resets to 0 once a full day is missed.
 */
export function computeStreak(dates: string[], today: string): { current: number; best: number } {
  const unique = [...new Set(dates)].sort(); // ascending
  if (unique.length === 0) return { current: 0, best: 0 };

  // best: longest run of consecutive calendar days
  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (diffDays(unique[i], unique[i - 1]) === 1) run++;
    else run = 1;
    if (run > best) best = run;
  }

  // current: walk back from the most recent active day, but only if that day
  // is today or yesterday.
  const last = unique[unique.length - 1];
  const gapFromToday = diffDays(today, last);
  let current = 0;
  if (gapFromToday === 0 || gapFromToday === 1) {
    current = 1;
    for (let i = unique.length - 1; i > 0; i--) {
      if (diffDays(unique[i], unique[i - 1]) === 1) current++;
      else break;
    }
  }

  return { current, best };
}

// ---- Aggregations shared by the data layer (pure; no I/O) ----

/** Per-expression graded tally (Remembered/Forgot only; nulls ignored). */
export function tallyByExpression(
  examples: ReviewExample[],
): Map<string, { remembered: number; forgot: number }> {
  const tally = new Map<string, { remembered: number; forgot: number }>();
  for (const e of examples) {
    if (e.result !== "Remembered" && e.result !== "Forgot") continue;
    const t = tally.get(e.expressionId) ?? { remembered: 0, forgot: 0 };
    if (e.result === "Remembered") t.remembered++;
    else t.forgot++;
    tally.set(e.expressionId, t);
  }
  return tally;
}

/** Attach per-expression review tallies; newest first. */
export function attachStats(
  exprs: Expression[],
  examples: ReviewExample[],
): ExpressionWithStats[] {
  const tally = tallyByExpression(examples);
  return exprs
    .map((x) => {
      const t = tally.get(x.id) ?? { remembered: 0, forgot: 0 };
      const graded = t.remembered + t.forgot;
      return { ...x, remembered: t.remembered, forgot: t.forgot, forgotRate: graded ? t.forgot / graded : 0 };
    })
    .sort((a, b) => (a.added < b.added ? 1 : -1));
}

/** Compute the full Progress stats blob from raw expressions + examples. */
export function computeStats(exprs: Expression[], examples: ReviewExample[], today: string): Stats {
  const total = exprs.length;
  const sentences = examples.length;

  let remembered = 0;
  let graded = 0;
  for (const e of examples) {
    if (e.result === "Remembered") {
      remembered++;
      graded++;
    } else if (e.result === "Forgot") {
      graded++;
    }
  }
  const forgot = graded - remembered;
  const rememberedRate = graded ? remembered / graded : 0;

  const mastery = { new: 0, learning: 0, solid: 0, mastered: 0 };
  for (const x of exprs) mastery[masteryBucket(x.level)]++;

  let reviewsToday = 0;
  let reviewsThisWeek = 0;
  for (const e of examples) {
    if (e.result !== "Remembered" && e.result !== "Forgot") continue;
    if (!e.reviewDate) continue;
    const ago = diffDays(today, e.reviewDate);
    if (ago === 0) reviewsToday++;
    if (ago >= 0 && ago < 7) reviewsThisWeek++;
  }
  const dueToday = exprs.filter((x) => x.reviewDue <= today).length;
  const activity = { reviewsToday, reviewsThisWeek, totalReviews: graded, dueToday };

  const streak = computeStreak(examples.map((e) => e.reviewDate).filter(Boolean), today);

  const tally = tallyByExpression(examples);
  const byId = new Map(exprs.map((x) => [x.id, x]));
  const needsAttention = [...tally.entries()]
    .map(([id, t]) => {
      const x = byId.get(id);
      return { id, ...t, total: t.remembered + t.forgot, level: x?.level ?? 0, due: x?.reviewDue ?? today, text: x?.text ?? "" };
    })
    .filter((t) => t.total >= 1 && (t.forgot > 0 || t.level < 3))
    .map((t) => ({
      id: t.id,
      text: t.text,
      remembered: t.remembered,
      forgot: t.forgot,
      forgotRate: t.forgot / t.total,
      level: t.level,
      due: t.due,
    }))
    .sort((a, b) => b.forgotRate - a.forgotRate || a.level - b.level || b.forgot - a.forgot)
    .slice(0, 8);

  const last14Days = new Array(14).fill(0);
  for (const e of examples) {
    if (!e.reviewDate) continue;
    const d = diffDays(today, e.reviewDate);
    if (d >= 0 && d < 14) last14Days[13 - d] += 1;
  }

  return { total, sentences, rememberedRate, remembered, forgot, mastery, activity, streak, needsAttention, last14Days };
}
