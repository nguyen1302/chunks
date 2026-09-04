export type Cefr = "A1" | "A2" | "B1" | "B2";

const ORDER: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

export function levelRank(level: string): number {
  return ORDER[level] ?? 99;
}

export interface StudyPlan {
  enabled: boolean;
  newPerDay: number;
  startLevel: string; // "A1".."B2"
  lastActivatedDate: string | null; // "YYYY-MM-DD"
}

/**
 * Pick the next words to activate today: the first `newPerDay` dormant words
 * at/above `startLevel`, ordered by `order`. Returns [] if already activated
 * today. Pure — the caller handles `enabled` and persistence.
 */
export function nextBatch<T extends { level: string; order: number }>(
  dormant: T[],
  plan: { newPerDay: number; startLevel: string; lastActivatedDate: string | null },
  today: string,
): T[] {
  if (plan.lastActivatedDate === today) return [];
  const min = levelRank(plan.startLevel);
  return dormant
    .filter((w) => levelRank(w.level) >= min)
    .sort((a, b) => a.order - b.order)
    .slice(0, Math.max(0, plan.newPerDay));
}
