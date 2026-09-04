import { ObjectId } from "mongodb";
import type { Expression, ExpressionWithStats, ReviewExample, ReviewResult, Stats, StudyProgress } from "./types";
import { computeNextReview, newExpressionFields } from "./schedule";
import { attachStats, computeStats } from "./stats";
import { nextBatch, type StudyPlan } from "./study";
import {
  expressionsCol,
  reviewExamplesCol,
  wordbankCol,
  studyPlanCol,
  type ExpressionDoc,
  type ReviewExampleDoc,
} from "./db";

function oid(id: string): ObjectId {
  return new ObjectId(id);
}

function mapExpression(doc: ExpressionDoc): Expression {
  return {
    id: String(doc._id),
    text: doc.text ?? "",
    meaning: doc.meaning ?? "",
    example: doc.example ?? "",
    source: doc.source ?? "",
    synonyms: doc.synonyms ?? [],
    tags: doc.tags ?? [],
    lastReview: doc.lastReview ?? null,
    reviewCount: doc.reviewCount ?? 0,
    reviewDue: doc.reviewDue,
    level: doc.level ?? 0,
    added: doc.added,
  };
}

function mapReviewExample(doc: ReviewExampleDoc): ReviewExample {
  return {
    id: String(doc._id),
    sentence: doc.sentence ?? "",
    reviewDate: doc.reviewDate ?? "",
    result: doc.result ?? null,
    expressionId: doc.expressionId,
  };
}

export async function getDueExpressions(today: string, limit = 20, tag?: string): Promise<Expression[]> {
  const col = await expressionsCol();
  const filter: Record<string, unknown> = { reviewDue: { $lte: today } };
  if (tag) filter.tags = tag;
  const docs = await col.find(filter).sort({ reviewDue: 1 }).limit(limit).toArray();
  return docs.map(mapExpression);
}

export async function getExpression(id: string): Promise<Expression> {
  const col = await expressionsCol();
  const doc = await col.findOne({ _id: oid(id) });
  if (!doc) throw new Error(`Expression ${id} not found`);
  return mapExpression(doc);
}

export async function createExpression(
  input: { text: string; meaning: string; example: string; source: string; synonyms?: string[]; tags?: string[] },
  today: string,
): Promise<Expression> {
  const f = newExpressionFields(today);
  const doc: ExpressionDoc = {
    text: input.text,
    meaning: input.meaning,
    example: input.example,
    source: input.source,
    synonyms: input.synonyms ?? [],
    tags: input.tags ?? [],
    lastReview: f.lastReview,
    reviewCount: f.reviewCount,
    reviewDue: f.reviewDue,
    level: f.level,
    added: today,
  };
  const col = await expressionsCol();
  const res = await col.insertOne(doc);
  return mapExpression({ ...doc, _id: res.insertedId });
}

export async function updateExpression(
  id: string,
  input: { text: string; meaning: string; example: string; source: string; synonyms: string[]; tags: string[] },
): Promise<Expression> {
  const col = await expressionsCol();
  await col.updateOne(
    { _id: oid(id) },
    {
      $set: {
        text: input.text,
        meaning: input.meaning,
        example: input.example,
        source: input.source,
        synonyms: input.synonyms,
        tags: input.tags,
      },
    },
  );
  return getExpression(id);
}

export async function getHistory(expressionId: string): Promise<ReviewExample[]> {
  const col = await reviewExamplesCol();
  const docs = await col.find({ expressionId }).sort({ reviewDate: -1 }).toArray();
  return docs.map(mapReviewExample);
}

export async function submitReview(
  input: { expressionId: string; sentence?: string; result: ReviewResult },
  today: string,
): Promise<void> {
  const expr = await getExpression(input.expressionId);
  const next = computeNextReview({ level: expr.level, reviewCount: expr.reviewCount }, input.result, today);

  // 1) create a NEW review example ONLY when a sentence was written
  //    (Write mode). Cloze/Reverse modes grade without writing → no example.
  const sentence = (input.sentence ?? "").trim();
  if (sentence) {
    const examples = await reviewExamplesCol();
    await examples.insertOne({
      sentence,
      reviewDate: today,
      result: input.result,
      expressionId: input.expressionId,
    });
  }

  // 2) update the expression schedule (always)
  const exprs = await expressionsCol();
  await exprs.updateOne(
    { _id: oid(input.expressionId) },
    {
      $set: {
        level: next.level,
        reviewCount: next.reviewCount,
        reviewDue: next.reviewDue,
        lastReview: next.lastReview,
      },
    },
  );
}

// Backfill a past sentence (no graded result).
export async function addPastSentence(
  input: { expressionId: string; sentence: string },
  date: string,
): Promise<ReviewExample> {
  const col = await reviewExamplesCol();
  const doc: ReviewExampleDoc = {
    sentence: input.sentence,
    reviewDate: date,
    result: null,
    expressionId: input.expressionId,
  };
  const res = await col.insertOne(doc);
  return mapReviewExample({ ...doc, _id: res.insertedId });
}

export async function getExpressionsWithStats(): Promise<ExpressionWithStats[]> {
  const [exprCol, exCol] = [await expressionsCol(), await reviewExamplesCol()];
  const [exprs, examples] = await Promise.all([exprCol.find().toArray(), exCol.find().toArray()]);
  return attachStats(exprs.map(mapExpression), examples.map(mapReviewExample));
}

export async function getStats(today: string): Promise<Stats> {
  const [exprCol, exCol] = [await expressionsCol(), await reviewExamplesCol()];
  const [exprs, examples] = await Promise.all([exprCol.find().toArray(), exCol.find().toArray()]);
  return computeStats(exprs.map(mapExpression), examples.map(mapReviewExample), today);
}

// ---- Oxford 3000 study plan ----

const DEFAULT_PLAN: StudyPlan = {
  enabled: false,
  newPerDay: 12,
  startLevel: "A1",
  lastActivatedDate: null,
};
const LEVELS = ["A1", "A2", "B1", "B2"];

export async function getPlan(): Promise<StudyPlan> {
  const col = await studyPlanCol();
  const doc = await col.findOne({ _id: "plan" });
  if (!doc) return { ...DEFAULT_PLAN };
  return {
    enabled: !!doc.enabled,
    newPerDay: doc.newPerDay ?? 12,
    startLevel: doc.startLevel ?? "A1",
    lastActivatedDate: doc.lastActivatedDate ?? null,
  };
}

export async function updatePlan(input: {
  enabled: boolean;
  newPerDay: number;
  startLevel: string;
}): Promise<StudyPlan> {
  const col = await studyPlanCol();
  const newPerDay = Math.max(1, Math.min(30, Math.round(input.newPerDay)));
  const startLevel = LEVELS.includes(input.startLevel) ? input.startLevel : "A1";
  await col.updateOne(
    { _id: "plan" },
    { $set: { enabled: !!input.enabled, newPerDay, startLevel } },
    { upsert: true },
  );
  return getPlan();
}

/** Activate today's batch of new words (create Expressions from wordbank). */
export async function runDailyDrip(today: string): Promise<{ activated: number }> {
  const plan = await getPlan();
  if (!plan.enabled || plan.lastActivatedDate === today) return { activated: 0 };

  const wb = await wordbankCol();
  const dormant = await wb.find({ status: "dormant" }).sort({ order: 1 }).toArray();
  const batch = nextBatch(
    dormant.map((d) => ({ level: d.level, order: d.order, _id: d._id, doc: d })),
    plan,
    today,
  );

  for (const item of batch) {
    const d = item.doc;
    const created = await createExpression(
      {
        text: d.word,
        meaning: d.meaning_vi,
        example: d.example,
        source: `Oxford 3000 · ${d.level}`,
        synonyms: [],
        tags: [d.level.toLowerCase(), "oxford3000"],
      },
      today,
    );
    if (d.collocation) {
      await addPastSentence({ expressionId: created.id, sentence: d.collocation }, today);
    }
    await wb.updateOne({ _id: d._id }, { $set: { status: "active" } });
  }

  const col = await studyPlanCol();
  await col.updateOne({ _id: "plan" }, { $set: { lastActivatedDate: today } }, { upsert: true });
  return { activated: batch.length };
}

export async function getStudyProgress(): Promise<StudyProgress> {
  const plan = await getPlan();
  const wb = await wordbankCol();
  const exprCol = await expressionsCol();

  const totalsByLevel = new Map<string, number>();
  for (const l of LEVELS) totalsByLevel.set(l, 0);
  for (const doc of await wb.find({}, { projection: { level: 1 } }).toArray()) {
    totalsByLevel.set(doc.level, (totalsByLevel.get(doc.level) ?? 0) + 1);
  }
  const dormantRemaining = await wb.countDocuments({ status: "dormant" });

  const oxfordExprs = await exprCol.find({ tags: "oxford3000" }).toArray();
  const levels = LEVELS.map((level) => {
    const tag = level.toLowerCase();
    const inLevel = oxfordExprs.filter((e) => (e.tags ?? []).includes(tag));
    return {
      level,
      total: totalsByLevel.get(level) ?? 0,
      activated: inLevel.length,
      mastered: inLevel.filter((e) => (e.level ?? 0) >= 3).length,
    };
  });

  return {
    enabled: plan.enabled,
    newPerDay: plan.newPerDay,
    startLevel: plan.startLevel,
    levels,
    dormantRemaining,
  };
}
