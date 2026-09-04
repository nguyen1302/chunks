import { describe, it, expect } from "vitest";
import { parseTags } from "../lib/tags";

describe("parseTags", () => {
  it("lowercases, trims, splits on comma/newline, dedupes", () => {
    expect(parseTags("Work, travel\nWORK")).toEqual(["work", "travel"]);
  });
  it("returns [] for empty or whitespace", () => {
    expect(parseTags("  , \n ")).toEqual([]);
    expect(parseTags("")).toEqual([]);
  });
});
