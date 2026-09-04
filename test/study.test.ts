import { describe, it, expect } from "vitest";
import { nextBatch, levelRank } from "../lib/study";

const dormant = [
  { word: "a", level: "A1", order: 0 },
  { word: "b", level: "A1", order: 1 },
  { word: "c", level: "A2", order: 2 },
  { word: "d", level: "B1", order: 3 },
];

describe("levelRank", () => {
  it("orders CEFR bands", () => {
    expect(levelRank("A1")).toBeLessThan(levelRank("A2"));
    expect(levelRank("B1")).toBeLessThan(levelRank("B2"));
  });
});

describe("nextBatch", () => {
  it("takes the first N dormant words by order", () => {
    const b = nextBatch(dormant, { newPerDay: 2, startLevel: "A1", lastActivatedDate: null }, "2026-09-04");
    expect(b.map((w) => w.word)).toEqual(["a", "b"]);
  });
  it("returns [] if already activated today", () => {
    expect(nextBatch(dormant, { newPerDay: 2, startLevel: "A1", lastActivatedDate: "2026-09-04" }, "2026-09-04")).toEqual([]);
  });
  it("respects startLevel (skips lower bands)", () => {
    const b = nextBatch(dormant, { newPerDay: 5, startLevel: "B1", lastActivatedDate: null }, "2026-09-04");
    expect(b.map((w) => w.word)).toEqual(["d"]);
  });
  it("caps at how many dormant remain", () => {
    const b = nextBatch(dormant, { newPerDay: 100, startLevel: "A1", lastActivatedDate: null }, "2026-09-04");
    expect(b.length).toBe(4);
  });
});
