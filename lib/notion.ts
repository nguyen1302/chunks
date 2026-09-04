import { Client } from "@notionhq/client";
import type { Expression, ExpressionWithStats, ReviewExample, ReviewResult, Stats } from "./types";
import { computeNextReview, newExpressionFields } from "./schedule";
import { diffDays } from "./dates";
import { parseSynonyms, formatSynonyms } from "./synonyms";
import { masteryBucket, computeStreak } from "./stats";

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
    synonyms: parseSynonyms(plain(p.Synonyms?.rich_text)),
    lastReview: p["Last Review"]?.date?.start ?? null,
    reviewCount: p["Review Count"]?.number ?? 0,
    reviewDue: p["Review Due"]?.date?.start ?? page.created_time.slice(0, 10),
    level: p["Review Level"]?.number ?? 0,
    added: page.created_time.slice(0, 10),
  };
}

export function mapReviewExample(page: any): ReviewExample {
  const p = page.properties;
  const resultName = p.Result?.select?.name;
  const result: ReviewResult | null =
    resultName === "Remembered" || resultName === "Forgot" ? resultName : null;
  return {
    id: page.id,
    sentence: plain(p.Example?.title),
    reviewDate: p["Review Date"]?.date?.start ?? "",
    result,
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
  input: { text: string; meaning: string; example: string; source: string; synonyms?: string[] },
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
      Synonyms: { rich_text: richText(formatSynonyms(input.synonyms ?? [])) },
      "Review Due": { date: { start: f.reviewDue } },
      "Review Count": { number: f.reviewCount },
      "Review Level": { number: f.level },
    },
  });
  return mapExpression(page);
}

// Update an expression's editable content fields (never touches review state).
export async function updateExpression(
  id: string,
  input: { text: string; meaning: string; example: string; source: string; synonyms: string[] },
): Promise<Expression> {
  const page = await notion().pages.update({
    page_id: id,
    properties: {
      Expression: { title: richText(input.text) },
      Meaning: { rich_text: richText(input.meaning) },
      "Original Example": { rich_text: richText(input.example) },
      Source: { rich_text: richText(input.source) },
      Synonyms: { rich_text: richText(formatSynonyms(input.synonyms)) },
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

  // graded reviews only (backfilled past sentences have null result)
  let remembered = 0;
  let graded = 0;
  for (const e of examples) {
    if (e.result === "Remembered") {
      remembered++;
      graded++;
    } else if (e.result === "Forgot") {
      graded++;
    }
  }
  const forgot = graded - remembered;
  const rememberedRate = graded ? remembered / graded : 0;

  // Mastery distribution by SR level.
  const mastery = { new: 0, learning: 0, solid: 0, mastered: 0 };
  for (const x of exprs) mastery[masteryBucket(x.level)]++;

  // Activity metrics.
  let reviewsToday = 0;
  let reviewsThisWeek = 0;
  for (const e of examples) {
    if (e.result !== "Remembered" && e.result !== "Forgot") continue; // graded only
    if (!e.reviewDate) continue;
    const ago = diffDays(today, e.reviewDate);
    if (ago === 0) reviewsToday++;
    if (ago >= 0 && ago < 7) reviewsThisWeek++;
  }
  const dueToday = exprs.filter((x) => x.reviewDue <= today).length;
  const activity = { reviewsToday, reviewsThisWeek, totalReviews: graded, dueToday };

  // Streak from any day with at least one review example.
  const streak = computeStreak(
    examples.map((e) => e.reviewDate).filter(Boolean),
    today,
  );

  const tally = tallyByExpression(examples);
  const byId = new Map(exprs.map((x) => [x.id, x]));
  const needsAttention = [...tally.entries()]
    .map(([id, t]) => {
      const x = byId.get(id);
      return { id, ...t, total: t.remembered + t.forgot, level: x?.level ?? 0, due: x?.reviewDue ?? today, text: x?.text ?? "" };
    })
    // only genuinely weak: has forgotten at least once, or still low level
    .filter((t) => t.total >= 1 && (t.forgot > 0 || t.level < 3))
    .map((t) => ({
      id: t.id,
      text: t.text,
      remembered: t.remembered,
      forgot: t.forgot,
      forgotRate: t.forgot / t.total,
      level: t.level,
      due: t.due,
    }))
    .sort((a, b) => b.forgotRate - a.forgotRate || a.level - b.level || b.forgot - a.forgot)
    .slice(0, 8);

  const last14Days = new Array(14).fill(0);
  for (const e of examples) {
    if (!e.reviewDate) continue;
    const d = diffDays(today, e.reviewDate); // days ago
    if (d >= 0 && d < 14) last14Days[13 - d] += 1;
  }

  return {
    total,
    sentences,
    rememberedRate,
    remembered,
    forgot,
    mastery,
    activity,
    streak,
    needsAttention,
    last14Days,
  };
}

// Per-expression graded tally (Remembered/Forgot only; nulls ignored).
function tallyByExpression(examples: ReviewExample[]): Map<string, { remembered: number; forgot: number }> {
  const tally = new Map<string, { remembered: number; forgot: number }>();
  for (const e of examples) {
    if (e.result !== "Remembered" && e.result !== "Forgot") continue;
    const t = tally.get(e.expressionId) ?? { remembered: 0, forgot: 0 };
    if (e.result === "Remembered") t.remembered++;
    else t.forgot++;
    tally.set(e.expressionId, t);
  }
  return tally;
}

export async function getExpressionsWithStats(): Promise<ExpressionWithStats[]> {
  const exprPages = await allPages(DB_EXPR());
  const examplePages = await allPages(DB_EXAMPLES());
  const exprs = exprPages.map(mapExpression);
  const tally = tallyByExpression(examplePages.map(mapReviewExample));
  return exprs
    .map((x) => {
      const t = tally.get(x.id) ?? { remembered: 0, forgot: 0 };
      const graded = t.remembered + t.forgot;
      return { ...x, remembered: t.remembered, forgot: t.forgot, forgotRate: graded ? t.forgot / graded : 0 };
    })
    .sort((a, b) => (a.added < b.added ? 1 : -1)); // newest first by default
}

// Backfill a past sentence for an expression: creates a Review Example with
// NO Result (it is not a graded review), so it never skews remembered rate.
export async function addPastSentence(
  input: { expressionId: string; sentence: string },
  date: string,
): Promise<ReviewExample> {
  const page = await notion().pages.create({
    parent: { database_id: DB_EXAMPLES() },
    properties: {
      Example: { title: richText(input.sentence) },
      "Review Date": { date: { start: date } },
      Expression: { relation: [{ id: input.expressionId }] },
    },
  });
  return mapReviewExample(page);
}
