import { describe, it, expect } from "vitest";
import { todayStr, addDays, formatShort, diffDays } from "../lib/dates";

describe("dates", () => {
  it("todayStr formats a Date as YYYY-MM-DD (UTC)", () => {
    expect(todayStr(new Date("2026-09-03T15:00:00Z"))).toBe("2026-09-03");
  });
  it("addDays adds whole days across month boundary", () => {
    expect(addDays("2026-09-03", 30)).toBe("2026-10-03");
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });
  it("addDays with 1 gives tomorrow", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("formatShort renders 'Mon D'", () => {
    expect(formatShort("2026-09-03")).toBe("Sep 3");
  });
  it("diffDays counts whole days a-b", () => {
    expect(diffDays("2026-09-10", "2026-09-03")).toBe(7);
    expect(diffDays("2026-09-03", "2026-09-10")).toBe(-7);
  });
});
