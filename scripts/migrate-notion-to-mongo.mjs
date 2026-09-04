// One-time migration: copy all data from Notion into MongoDB.
// Clears the target Mongo collections first, then inserts expressions (keeping
// a Notion-id -> Mongo-id map) and their review examples with remapped links.
//
// Run: node scripts/migrate-notion-to-mongo.mjs
import { Client } from "@notionhq/client";
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_EXPR = process.env.NOTION_DB_EXPRESSIONS;
const DB_EX = process.env.NOTION_DB_REVIEW_EXAMPLES;

const plain = (rich) => (rich ?? []).map((r) => r.plain_text).join("");
function parseSynonyms(raw) {
  const out = [], seen = new Set();
  for (const p of (raw ?? "").split(/[,\n]/)) {
    const s = p.trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

async function allPages(databaseId) {
  const out = [];
  let cursor;
  do {
    const res = await notion.databases.query({ database_id: databaseId, start_cursor: cursor, page_size: 100 });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

function mapExpr(page) {
  const p = page.properties;
  const added = page.created_time.slice(0, 10);
  return {
    text: plain(p.Expression?.title),
    meaning: plain(p.Meaning?.rich_text),
    example: plain(p["Original Example"]?.rich_text),
    source: plain(p.Source?.rich_text),
    synonyms: parseSynonyms(plain(p.Synonyms?.rich_text)),
    lastReview: p["Last Review"]?.date?.start ?? null,
    reviewCount: p["Review Count"]?.number ?? 0,
    reviewDue: p["Review Due"]?.date?.start ?? added,
    level: p["Review Level"]?.number ?? 0,
    added,
  };
}
function mapExample(page) {
  const p = page.properties;
  const name = p.Result?.select?.name;
  return {
    sentence: plain(p.Example?.title),
    reviewDate: p["Review Date"]?.date?.start ?? "",
    result: name === "Remembered" || name === "Forgot" ? name : null,
    notionExpressionId: p.Expression?.relation?.[0]?.id ?? "",
  };
}

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB || "chunks");
  const exprCol = db.collection("expressions");
  const exCol = db.collection("reviewExamples");

  console.log("Clearing target collections…");
  await exprCol.deleteMany({});
  await exCol.deleteMany({});

  console.log("Reading from Notion…");
  const [exprPages, exPages] = await Promise.all([allPages(DB_EXPR), allPages(DB_EX)]);
  console.log(`  ${exprPages.length} expressions, ${exPages.length} review examples`);

  // insert expressions, remember Notion id -> Mongo id
  const idMap = new Map();
  for (const page of exprPages) {
    const res = await exprCol.insertOne(mapExpr(page));
    idMap.set(page.id, res.insertedId.toString());
  }
  console.log(`Inserted ${idMap.size} expressions.`);

  // insert examples with remapped expressionId
  let inserted = 0, skipped = 0;
  for (const page of exPages) {
    const m = mapExample(page);
    const mongoId = idMap.get(m.notionExpressionId);
    if (!mongoId) { skipped++; continue; }
    await exCol.insertOne({
      sentence: m.sentence,
      reviewDate: m.reviewDate,
      result: m.result,
      expressionId: mongoId,
    });
    inserted++;
  }
  console.log(`Inserted ${inserted} review examples (skipped ${skipped} with no matching expression).`);

  await mongo.close();
  console.log("Done.");
}

main().catch((e) => { console.error("MIGRATION ERROR:", e.message); process.exit(1); });
