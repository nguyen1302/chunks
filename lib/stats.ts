import { diffDays } from "./dates";

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
