import { ObjectId } from "mongodb";
import type { Expression, ExpressionWithStats, ReviewExample, ReviewResult, Stats } from "./types";
import { computeNextReview, newExpressionFields } from "./schedule";
import { attachStats, computeStats } from "./stats";
import {
  expressionsCol,
  reviewExamplesCol,
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

export async function getDueExpressions(today: string, limit = 20): Promise<Expression[]> {
  const col = await expressionsCol();
  const docs = await col
    .find({ reviewDue: { $lte: today } })
    .sort({ reviewDue: 1 })
    .limit(limit)
    .toArray();
  return docs.map(mapExpression);
}

export async function getExpression(id: string): Promise<Expression> {
  const col = await expressionsCol();
  const doc = await col.findOne({ _id: oid(id) });
  if (!doc) throw new Error(`Expression ${id} not found`);
  return mapExpression(doc);
}

export async function createExpression(
  input: { text: string; meaning: string; example: string; source: string; synonyms?: string[] },
  today: string,
): Promise<Expression> {
  const f = newExpressionFields(today);
  const doc: ExpressionDoc = {
    text: input.text,
    meaning: input.meaning,
    example: input.example,
    source: input.source,
    synonyms: input.synonyms ?? [],
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
  input: { text: string; meaning: string; example: string; source: string; synonyms: string[] },
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
