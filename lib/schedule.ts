import { addDays } from "./dates";
import type { ReviewResult, ScheduleUpdate } from "./types";

export function intervalDays(level: number): number {
  switch (level) {
    case 1:
      return 3;
    case 2:
      return 7;
    case 3:
      return 14;
    case 4:
    case 5:
      return 30;
    default:
      throw new Error(`no interval for level ${level}`);
  }
}

export function newExpressionFields(today: string) {
  return { level: 0, reviewCount: 0, reviewDue: today, lastReview: null as null };
}

export function computeNextReview(
  prev: { level: number; reviewCount: number },
  result: ReviewResult,
  today: string,
): ScheduleUpdate {
  const reviewCount = prev.reviewCount + 1;
  if (result === "Forgot") {
    return { level: prev.level, reviewCount, reviewDue: addDays(today, 1), lastReview: today };
  }
  const level = Math.min(prev.level + 1, 5);
  return { level, reviewCount, reviewDue: addDays(today, intervalDays(level)), lastReview: today };
}
