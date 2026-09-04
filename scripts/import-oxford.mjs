// Import the enriched Oxford 3000 into the Mongo `wordbank` collection
// (dormant). Re-runnable: upserts by word, never touches existing expressions.
// Run: node scripts/import-oxford.mjs
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const words = JSON.parse(readFileSync("data/oxford3000.json", "utf8"));
const enriched = JSON.parse(readFileSync("data/oxford3000-enriched.json", "utf8"));

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const wb = c.db(process.env.MONGODB_DB || "chunks").collection("wordbank");

let imported = 0,
  skippedNoContext = 0;
for (let i = 0; i < words.length; i++) {
  const w = words[i];
  const e = enriched[w.word];
  if (!e || !e.meaning_vi) {
    skippedNoContext++;
    continue; // only import words that have generated context
  }
  await wb.updateOne(
    { word: w.word },
    {
      $set: {
        word: w.word,
        pos: w.pos,
        level: w.level,
        meaning_vi: e.meaning_vi,
        example: e.example || "",
        collocation: e.collocation || "",
        source: "oxford3000",
        order: i, // already sorted A1->B2 then alpha
      },
      $setOnInsert: { status: "dormant" }, // don't reset an already-active word
    },
    { upsert: true },
  );
  imported++;
}

const total = await wb.countDocuments({ source: "oxford3000" });
const dormant = await wb.countDocuments({ source: "oxford3000", status: "dormant" });
console.log(`Imported/updated ${imported} words (skipped ${skippedNoContext} without context).`);
console.log(`wordbank now: ${total} total, ${dormant} dormant.`);
await c.close();
