import { MongoClient, type Db, type Collection, type ObjectId } from "mongodb";
import type { ReviewResult } from "./types";

// Raw MongoDB document shapes (dates stored as YYYY-MM-DD strings).
export interface ExpressionDoc {
  _id?: ObjectId;
  text: string;
  meaning: string;
  example: string;
  source: string;
  synonyms: string[];
  lastReview: string | null;
  reviewCount: number;
  reviewDue: string;
  level: number;
  added: string;
}

export interface ReviewExampleDoc {
  _id?: ObjectId;
  sentence: string;
  reviewDate: string;
  result: ReviewResult | null;
  expressionId: string; // hex string of the expression's _id
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

// Cache the client across lambda invocations (and dev hot-reloads) to avoid
// exhausting the connection pool on serverless.
const globalForMongo = globalThis as unknown as { _mongo?: Promise<MongoClient> };

function clientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongo) {
    const client = new MongoClient(requireEnv("MONGODB_URI"));
    globalForMongo._mongo = client.connect();
  }
  return globalForMongo._mongo;
}

let indexesEnsured = false;

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  const db = client.db(process.env.MONGODB_DB || "chunks");
  if (!indexesEnsured) {
    indexesEnsured = true;
    await Promise.all([
      db.collection("expressions").createIndex({ reviewDue: 1 }),
      db.collection("expressions").createIndex({ added: -1 }),
      db.collection("reviewExamples").createIndex({ expressionId: 1, reviewDate: -1 }),
    ]).catch(() => {
      indexesEnsured = false; // retry next call if index creation failed
    });
  }
  return db;
}

export async function expressionsCol(): Promise<Collection<ExpressionDoc>> {
  return (await getDb()).collection<ExpressionDoc>("expressions");
}

export async function reviewExamplesCol(): Promise<Collection<ReviewExampleDoc>> {
  return (await getDb()).collection<ReviewExampleDoc>("reviewExamples");
}
