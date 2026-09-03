import { describe, it, expect } from "vitest";
import { parseSynonyms, formatSynonyms } from "../lib/synonyms";

describe("parseSynonyms", () => {
  it("splits on commas and trims", () => {
    expect(parseSynonyms("cut down, whittle down ,narrow")).toEqual([
      "cut down",
      "whittle down",
      "narrow",
    ]);
  });
  it("splits on newlines too", () => {
    expect(parseSynonyms("cut down\nwhittle down\nnarrow")).toEqual([
      "cut down",
      "whittle down",
      "narrow",
    ]);
  });
  it("drops empties and de-duplicates (case-insensitive)", () => {
    expect(parseSynonyms("cut down, , cut down, Cut Down")).toEqual(["cut down"]);
  });
  it("returns [] for empty/whitespace", () => {
    expect(parseSynonyms("")).toEqual([]);
    expect(parseSynonyms("  ,  \n ")).toEqual([]);
  });
});

describe("formatSynonyms", () => {
  it("joins with a comma and space", () => {
    expect(formatSynonyms(["cut down", "narrow"])).toBe("cut down, narrow");
  });
  it("returns empty string for empty array", () => {
    expect(formatSynonyms([])).toBe("");
  });
});
