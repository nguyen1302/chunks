import { describe, it, expect } from "vitest";
import { intervalDays, newExpressionFields, computeNextReview } from "../lib/schedule";

describe("intervalDays", () => {
  it("maps levels to the V1 ladder", () => {
    expect(intervalDays(1)).toBe(3);
    expect(intervalDays(2)).toBe(7);
    expect(intervalDays(3)).toBe(14);
    expect(intervalDays(4)).toBe(30);
    expect(intervalDays(5)).toBe(30);
  });
  it("throws for level 0 or below", () => {
    expect(() => intervalDays(0)).toThrow();
  });
});

describe("newExpressionFields", () => {
  it("starts at level 0, count 0, due today, no last review", () => {
    expect(newExpressionFields("2026-09-03")).toEqual({
      level: 0,
      reviewCount: 0,
      reviewDue: "2026-09-03",
      lastReview: null,
    });
  });
});

describe("computeNextReview — Remembered", () => {
  it("first remembered: level 0->1, +3 days, count+1", () => {
    expect(computeNextReview({ level: 0, reviewCount: 0 }, "Remembered", "2026-09-03")).toEqual({
      level: 1,
      reviewCount: 1,
      reviewDue: "2026-09-06",
      lastReview: "2026-09-03",
    });
  });
  it("level 1->2 gives +7 days", () => {
    expect(computeNextReview({ level: 1, reviewCount: 3 }, "Remembered", "2026-09-03")).toEqual({
      level: 2,
      reviewCount: 4,
      reviewDue: "2026-09-10",
      lastReview: "2026-09-03",
    });
  });
  it("caps at level 5 with +30 days", () => {
    expect(computeNextReview({ level: 5, reviewCount: 9 }, "Remembered", "2026-09-03")).toEqual({
      level: 5,
      reviewCount: 10,
      reviewDue: "2026-10-03",
      lastReview: "2026-09-03",
    });
  });
});

describe("computeNextReview — Forgot", () => {
  it("keeps level, count+1, due tomorrow", () => {
    expect(computeNextReview({ level: 3, reviewCount: 4 }, "Forgot", "2026-09-03")).toEqual({
      level: 3,
      reviewCount: 5,
      reviewDue: "2026-09-04",
      lastReview: "2026-09-03",
    });
  });
  it("forgot at level 0 stays level 0, due tomorrow", () => {
    expect(computeNextReview({ level: 0, reviewCount: 0 }, "Forgot", "2026-09-03")).toEqual({
      level: 0,
      reviewCount: 1,
      reviewDue: "2026-09-04",
      lastReview: "2026-09-03",
    });
  });
});
