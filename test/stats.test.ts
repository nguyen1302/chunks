import { describe, it, expect } from "vitest";
import { masteryBucket, computeStreak } from "../lib/stats";

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
