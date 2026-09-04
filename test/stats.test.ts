import { describe, it, expect } from "vitest";
import { masteryBucket, computeStreak, computeStats, attachStats } from "../lib/stats";
import type { Expression, ReviewExample } from "../lib/types";

function expr(p: Partial<Expression> & { id: string }): Expression {
  return {
    id: p.id,
    text: p.text ?? p.id,
    meaning: p.meaning ?? "",
    example: p.example ?? "",
    source: p.source ?? "",
    synonyms: p.synonyms ?? [],
    lastReview: p.lastReview ?? null,
    reviewCount: p.reviewCount ?? 0,
    reviewDue: p.reviewDue ?? "2026-09-04",
    level: p.level ?? 0,
    added: p.added ?? "2026-09-01",
  };
}
function ex(p: Partial<ReviewExample> & { id: string; expressionId: string }): ReviewExample {
  return {
    id: p.id,
    sentence: p.sentence ?? "s",
    reviewDate: p.reviewDate ?? "2026-09-04",
    result: p.result ?? null,
    expressionId: p.expressionId,
  };
}

describe("masteryBucket", () => {
  it("buckets levels into new/learning/solid/mastered", () => {
    expect(masteryBucket(0)).toBe("new");
    expect(masteryBucket(1)).toBe("learning");
    expect(masteryBucket(2)).toBe("learning");
    expect(masteryBucket(3)).toBe("solid");
    expect(masteryBucket(4)).toBe("solid");
    expect(masteryBucket(5)).toBe("mastered");
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-09-04", "2026-09-03", "2026-09-02"], "2026-09-04")).toEqual({
      current: 3,
      best: 3,
    });
  });
  it("keeps current streak alive when the last activity was yesterday", () => {
    expect(computeStreak(["2026-09-03", "2026-09-02"], "2026-09-04")).toEqual({
      current: 2,
      best: 2,
    });
  });
  it("resets current to 0 when the last activity is older than yesterday", () => {
    expect(computeStreak(["2026-09-01", "2026-08-31"], "2026-09-04")).toEqual({
      current: 0,
      best: 2,
    });
  });
  it("finds the best streak across gaps and ignores duplicate dates", () => {
    const dates = ["2026-09-04", "2026-09-04", "2026-08-20", "2026-08-19", "2026-08-18", "2026-08-16"];
    expect(computeStreak(dates, "2026-09-04")).toEqual({ current: 1, best: 3 });
  });
  it("returns zeros for no activity", () => {
    expect(computeStreak([], "2026-09-04")).toEqual({ current: 0, best: 0 });
  });
});

describe("computeStats", () => {
  const exprs = [
    expr({ id: "a", level: 0, reviewDue: "2026-09-04" }), // due today, new
    expr({ id: "b", level: 2, reviewDue: "2026-09-10" }), // learning
    expr({ id: "c", level: 5, reviewDue: "2026-09-30" }), // mastered
  ];
  const examples = [
    ex({ id: "1", expressionId: "a", result: "Forgot", reviewDate: "2026-09-04" }),
    ex({ id: "2", expressionId: "a", result: "Remembered", reviewDate: "2026-09-03" }),
    ex({ id: "3", expressionId: "b", result: "Remembered", reviewDate: "2026-09-01" }),
    ex({ id: "4", expressionId: "c", result: null, reviewDate: "2026-09-02" }), // backfill, not graded
  ];
  const s = computeStats(exprs, examples, "2026-09-04");

  it("counts totals and graded rate", () => {
    expect(s.total).toBe(3);
    expect(s.sentences).toBe(4);
    expect(s.remembered).toBe(2);
    expect(s.forgot).toBe(1);
    expect(Math.round(s.rememberedRate * 100)).toBe(67); // 2/3 graded
  });
  it("buckets mastery", () => {
    expect(s.mastery).toEqual({ new: 1, learning: 1, solid: 0, mastered: 1 });
  });
  it("computes activity (graded only) and due today", () => {
    expect(s.activity.reviewsToday).toBe(1); // only the graded Forgot today
    expect(s.activity.totalReviews).toBe(3);
    expect(s.activity.dueToday).toBe(1);
  });
  it("flags only genuinely weak items in needsAttention", () => {
    const ids = s.needsAttention.map((n) => n.id);
    expect(ids).toContain("a"); // forgot>0
    expect(ids).toContain("b"); // level<3
    expect(ids).not.toContain("c"); // mastered, no forgot
  });
});

describe("attachStats", () => {
  it("attaches per-expression tally and sorts newest first", () => {
    const exprs = [expr({ id: "old", added: "2026-09-01" }), expr({ id: "new", added: "2026-09-03" })];
    const examples = [
      ex({ id: "1", expressionId: "old", result: "Forgot" }),
      ex({ id: "2", expressionId: "old", result: "Remembered" }),
    ];
    const res = attachStats(exprs, examples);
    expect(res[0].id).toBe("new");
    const old = res.find((r) => r.id === "old")!;
    expect(old.forgot).toBe(1);
    expect(old.remembered).toBe(1);
    expect(old.forgotRate).toBe(0.5);
  });
});
