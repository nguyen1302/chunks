import { describe, it, expect } from "vitest";
import { mapExpression, mapReviewExample } from "../lib/notion";

const exprPage = {
  id: "expr-1",
  created_time: "2026-08-20T10:00:00.000Z",
  properties: {
    Expression: { title: [{ plain_text: "run into a problem" }] },
    Meaning: { rich_text: [{ plain_text: "gặp phải một vấn đề" }] },
    "Original Example": { rich_text: [{ plain_text: "I ran into a problem." }] },
    Source: { rich_text: [{ plain_text: "YouTube" }] },
    "Last Review": { date: { start: "2026-09-01" } },
    "Review Count": { number: 3 },
    "Review Due": { date: { start: "2026-09-04" } },
    "Review Level": { number: 2 },
  },
};

describe("mapExpression", () => {
  it("maps a Notion page to an Expression", () => {
    expect(mapExpression(exprPage)).toEqual({
      id: "expr-1",
      text: "run into a problem",
      meaning: "gặp phải một vấn đề",
      example: "I ran into a problem.",
      source: "YouTube",
      lastReview: "2026-09-01",
      reviewCount: 3,
      reviewDue: "2026-09-04",
      level: 2,
      added: "2026-08-20",
    });
  });
  it("handles empty optional fields and null level/date", () => {
    const bare = {
      id: "e2",
      created_time: "2026-08-20T10:00:00.000Z",
      properties: {
        Expression: { title: [] },
        Meaning: { rich_text: [] },
        "Original Example": { rich_text: [] },
        Source: { rich_text: [] },
        "Last Review": { date: null },
        "Review Count": { number: null },
        "Review Due": { date: { start: "2026-08-20" } },
        "Review Level": { number: null },
      },
    };
    const m = mapExpression(bare);
    expect(m.source).toBe("");
    expect(m.lastReview).toBeNull();
    expect(m.reviewCount).toBe(0);
    expect(m.level).toBe(0);
  });
});

describe("mapReviewExample", () => {
  it("maps a Notion page to a ReviewExample", () => {
    const page = {
      id: "re-1",
      properties: {
        Example: { title: [{ plain_text: "I ran into a problem deploying." }] },
        "Review Date": { date: { start: "2026-09-03" } },
        Result: { select: { name: "Remembered" } },
        Expression: { relation: [{ id: "expr-1" }] },
      },
    };
    expect(mapReviewExample(page)).toEqual({
      id: "re-1",
      sentence: "I ran into a problem deploying.",
      reviewDate: "2026-09-03",
      result: "Remembered",
      expressionId: "expr-1",
    });
  });
  it("maps a backfilled example (no Result) to result null", () => {
    const page = {
      id: "re-2",
      properties: {
        Example: { title: [{ plain_text: "An old sentence I wrote." }] },
        "Review Date": { date: { start: "2026-09-01" } },
        Result: { select: null },
        Expression: { relation: [{ id: "expr-1" }] },
      },
    };
    expect(mapReviewExample(page).result).toBeNull();
  });
});
