import { describe, it, expect } from "vitest";
import { weaknessWeight, pickWeightedIndex } from "../lib/practice";

const base = { level: 3, reviewCount: 5, forgotRate: 0 };

describe("weaknessWeight", () => {
  it("gives a never-reviewed expression a high weight", () => {
    const unreviewed = weaknessWeight({ level: 0, reviewCount: 0, forgotRate: 0 });
    const solid = weaknessWeight({ level: 5, reviewCount: 8, forgotRate: 0 });
    expect(unreviewed).toBeGreaterThan(solid);
  });
  it("weights lower level heavier than higher level", () => {
    const low = weaknessWeight({ ...base, level: 1 });
    const high = weaknessWeight({ ...base, level: 5 });
    expect(low).toBeGreaterThan(high);
  });
  it("weights higher forgot rate heavier", () => {
    const forgetful = weaknessWeight({ ...base, forgotRate: 1 });
    const reliable = weaknessWeight({ ...base, forgotRate: 0 });
    expect(forgetful).toBeGreaterThan(reliable);
  });
  it("never returns a non-positive weight (mastered still possible)", () => {
    expect(weaknessWeight({ level: 5, reviewCount: 20, forgotRate: 0 })).toBeGreaterThan(0);
  });
});

describe("pickWeightedIndex", () => {
  it("returns the first index when r=0", () => {
    expect(pickWeightedIndex([1, 1, 1], 0)).toBe(0);
  });
  it("lands in the correct bucket by cumulative weight", () => {
    // weights [1,3,1], total 5. r=0.5 -> cum 0.2..0.8 => index 1
    expect(pickWeightedIndex([1, 3, 1], 0.5)).toBe(1);
    // r just under 0.2 -> index 0
    expect(pickWeightedIndex([1, 3, 1], 0.19)).toBe(0);
    // r just over 0.8 -> index 2
    expect(pickWeightedIndex([1, 3, 1], 0.81)).toBe(2);
  });
  it("clamps r=1 to the last index", () => {
    expect(pickWeightedIndex([2, 2, 2], 1)).toBe(2);
  });
  it("returns -1 for an empty list", () => {
    expect(pickWeightedIndex([], 0.5)).toBe(-1);
  });
});
