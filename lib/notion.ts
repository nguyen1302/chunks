import { Client } from "@notionhq/client";
import type { Expression, ReviewExample, ReviewResult, Stats } from "./types";
import { computeNextReview, newExpressionFields } from "./schedule";
import { diffDays } from "./dates";

const DB_EXPR = () => requireEnv("NOTION_DB_EXPRESSIONS");
const DB_EXAMPLES = () => requireEnv("NOTION_DB_REVIEW_EXAMPLES");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

let _client: Client | null = null;
function notion(): Client {
  if (!_client) _client = new Client({ auth: requireEnv("NOTION_TOKEN") });
  return _client;
}

function plain(rich: any[] | undefined): string {
  return (rich ?? []).map((r) => r.plain_text).join("");
}

export function mapExpression(page: any): Expression {
  const p = page.properties;
  return {
    id: page.id,
    text: plain(p.Expression?.title),
    meaning: plain(p.Meaning?.rich_text),
    example: plain(p["Original Example"]?.rich_text),
    source: plain(p.Source?.rich_text),
    lastReview: p["Last Review"]?.date?.start ?? null,
    reviewCount: p["Review Count"]?.number ?? 0,
    reviewDue: p["Review Due"]?.date?.start ?? page.created_time.slice(0, 10),
    level: p["Review Level"]?.number ?? 0,
    added: page.created_time.slice(0, 10),
  };
}

export function mapReviewExample(page: any): ReviewExample {
  const p = page.properties;
  return {
    id: page.id,
    sentence: plain(p.Example?.title),
    reviewDate: p["Review Date"]?.date?.start ?? "",
    result: (p.Result?.select?.name ?? "Forgot") as ReviewResult,
    expressionId: p.Expression?.relation?.[0]?.id ?? "",
  };
}

function richText(s: string) {
  return s ? [{ text: { content: s } }] : [];
}

export async function getDueExpressions(today: string, limit = 20): Promise<Expression[]> {
  const res = await notion().databases.query({
    database_id: DB_EXPR(),
    filter: { property: "Review Due", date: { on_or_before: today } },
    sorts: [{ property: "Review Due", direction: "ascending" }],
    page_size: limit,
  });
  return res.results.map(mapExpression);
}

export async function getExpression(id: string): Promise<Expression> {
  const page = await notion().pages.retrieve({ page_id: id });
  return mapExpression(page);
}

export async function createExpression(
  input: { text: string; meaning: string; example: string; source: string },
  today: string,
): Promise<Expression> {
  const f = newExpressionFields(today);
  const page = await notion().pages.create({
    parent: { database_id: DB_EXPR() },
    properties: {
      Expression: { title: richText(input.text) },
      Meaning: { rich_text: richText(input.meaning) },
      "Original Example": { rich_text: richText(input.example) },
      Source: { rich_text: richText(input.source) },
      "Review Due": { date: { start: f.reviewDue } },
      "Review Count": { number: f.reviewCount },
      "Review Level": { number: f.level },
    },
  });
  return mapExpression(page);
}

export async function getHistory(expressionId: string): Promise<ReviewExample[]> {
  const res = await notion().databases.query({
    database_id: DB_EXAMPLES(),
    filter: { property: "Expression", relation: { contains: expressionId } },
    sorts: [{ property: "Review Date", direction: "descending" }],
    page_size: 100,
  });
  return res.results.map(mapReviewExample);
}

export async function submitReview(
  input: { expressionId: string; sentence: string; result: ReviewResult },
  today: string,
): Promise<void> {
  const expr = await getExpression(input.expressionId);
  const next = computeNextReview(
    { level: expr.level, reviewCount: expr.reviewCount },
    input.result,
    today,
  );
  // 1) create a NEW review example (never overwrite)
  await notion().pages.create({
    parent: { database_id: DB_EXAMPLES() },
    properties: {
      Example: { title: richText(input.sentence) },
      "Review Date": { date: { start: today } },
      Result: { select: { name: input.result } },
      Expression: { relation: [{ id: input.expressionId }] },
    },
  });
  // 2) update the expression schedule
  await notion().pages.update({
    page_id: input.expressionId,
    properties: {
      "Review Level": { number: next.level },
      "Review Count": { number: next.reviewCount },
      "Review Due": { date: { start: next.reviewDue } },
      "Last Review": { date: { start: next.lastReview } },
    },
  });
}

async function allPages(databaseId: string, filter?: any): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await notion().databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
      ...(filter ? { filter } : {}),
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

export async function getStats(today: string): Promise<Stats> {
  const exprPages = await allPages(DB_EXPR());
  const examplePages = await allPages(DB_EXAMPLES());
  const exprs = exprPages.map(mapExpression);
  const examples = examplePages.map(mapReviewExample);

  const total = exprs.length;
  const sentences = examples.length;

  let remembered = 0;
  for (const e of examples) if (e.result === "Remembered") remembered++;
  const rememberedRate = sentences ? remembered / sentences : 0;

  // per-expression tallies from examples
  const tally = new Map<string, { remembered: number; forgot: number }>();
  for (const e of examples) {
    const t = tally.get(e.expressionId) ?? { remembered: 0, forgot: 0 };
    if (e.result === "Remembered") t.remembered++;
    else t.forgot++;
    tally.set(e.expressionId, t);
  }
  const byId = new Map(exprs.map((x) => [x.id, x]));
  const needsAttention = [...tally.entries()]
    .map(([id, t]) => ({ id, ...t, total: t.remembered + t.forgot }))
    .filter((t) => t.total >= 2) // spec §7: require >= 2 completed reviews
    .map((t) => ({
      id: t.id,
      text: byId.get(t.id)?.text ?? "",
      remembered: t.remembered,
      forgot: t.forgot,
      forgotRate: t.forgot / t.total,
    }))
    .sort(
      (a, b) =>
        b.forgotRate - a.forgotRate ||
        b.forgot + b.remembered - (a.forgot + a.remembered),
    )
    .slice(0, 5);

  const last14Days = new Array(14).fill(0);
  for (const e of examples) {
    if (!e.reviewDate) continue;
    const d = diffDays(today, e.reviewDate); // days ago
    if (d >= 0 && d < 14) last14Days[13 - d] += 1;
  }

  return { total, sentences, rememberedRate, needsAttention, last14Days };
}
