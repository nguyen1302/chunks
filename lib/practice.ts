/**
 * Flashcard practice weighting — pure, no I/O.
 *
 * "Prioritize the not-yet-mastered" is modelled as a weighted-random draw:
 * weaker expressions get a bigger weight (higher chance) but every card keeps
 * a positive weight so the draw stays varied.
 */

export function weaknessWeight(e: { level: number; reviewCount: number; forgotRate: number }): number {
  let w = 1;
  if (e.reviewCount === 0) w += 3; // never reviewed → surface it
  w += (5 - Math.min(Math.max(e.level, 0), 5)) * 0.6; // lower level → weaker
  w += e.forgotRate * 3; // forgets more → weaker
  return Math.max(w, 0.2);
}

/**
 * Given a list of positive weights and r in [0, 1), return the index of the
 * bucket r falls into (cumulative-weight roulette). Returns -1 for an empty
 * list. r is clamped into [0, 1].
 */
export function pickWeightedIndex(weights: number[], r: number): number {
  if (weights.length === 0) return -1;
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const target = Math.min(Math.max(r, 0), 1) * total;
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (target < cum) return i;
  }
  return weights.length - 1;
}
