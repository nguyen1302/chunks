import { describe, it, expect } from "vitest";
import { clozeExample } from "../lib/cloze";

describe("clozeExample", () => {
  it("blanks the expression case-insensitively", () => {
    expect(clozeExample("I ran into a problem today.", "ran into a problem")).toEqual({
      text: "I _____ today.",
      found: true,
    });
  });
  it("matches regardless of case", () => {
    expect(clozeExample("Circle back later.", "circle back").found).toBe(true);
  });
  it("returns found=false when the expression is not present", () => {
    expect(clozeExample("We solved it.", "run into a problem")).toEqual({
      text: "We solved it.",
      found: false,
    });
  });
  it("handles regex-special characters in the expression", () => {
    expect(clozeExample("It costs $5 (roughly).", "$5 (roughly)").found).toBe(true);
  });
});
