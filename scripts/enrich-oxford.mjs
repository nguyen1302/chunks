// Enrich the Oxford 3000 word list with Vietnamese meaning + example +
// collocation, by batching through the local `claude` CLI (uses the user's
// Claude Code login — no API key needed). Resumable: writes after each batch
// and skips words already enriched.
//
// Run: node scripts/enrich-oxford.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "data/oxford3000.json";
const OUT = "data/oxford3000-enriched.json";
const BATCH = 40;

const words = JSON.parse(readFileSync(SRC, "utf8"));
const enriched = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

function buildPrompt(batch) {
  const list = batch.map((w) => `${w.word} [${w.pos || "?"}]`).join("\n");
  return (
    `You are helping a Vietnamese learner study the Oxford 3000. For each English entry below (word with its part(s) of speech), produce a JSON object with:\n` +
    `"word" (exactly as given), "meaning_vi" (concise Vietnamese meaning; cover the main senses for the given POS), ` +
    `"example" (one natural English sentence using the word), "collocation" (one common collocation or chunk using the word).\n` +
    `Output ONLY a JSON array of these objects — no markdown fences, no commentary.\n\nEntries:\n${list}`
  );
}

function runClaude(prompt) {
  const out = execFileSync("claude", ["-p", prompt], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  // strip possible markdown fences
  const cleaned = out.replace(/```json\s*|\s*```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("no JSON array in output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const pending = words.filter((w) => !enriched[w.word]);
console.log(`${words.length} words total, ${pending.length} to enrich (${words.length - pending.length} done).`);

for (let i = 0; i < pending.length; i += BATCH) {
  const batch = pending.slice(i, i + BATCH);
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    try {
      const arr = runClaude(buildPrompt(batch));
      const norm = (s) => String(s).replace(/\s*\[[^\]]*\]\s*$/, "").trim().toLowerCase();
      const byWord = new Map(arr.map((x) => [norm(x.word), x]));
      let matched = 0;
      for (const w of batch) {
        const x = byWord.get(norm(w.word));
        if (x && x.meaning_vi) {
          enriched[w.word] = {
            meaning_vi: String(x.meaning_vi).trim(),
            example: String(x.example || "").trim(),
            collocation: String(x.collocation || "").trim(),
          };
          matched++;
        }
      }
      writeFileSync(OUT, JSON.stringify(enriched, null, 0));
      console.log(`batch ${Math.floor(i / BATCH) + 1}: matched ${matched}/${batch.length} (attempt ${attempt}); total done ${Object.keys(enriched).length}`);
      ok = matched >= Math.floor(batch.length * 0.6);
    } catch (e) {
      console.error(`batch ${Math.floor(i / BATCH) + 1} attempt ${attempt} failed:`, e.message.split("\n")[0]);
    }
  }
}

console.log(`DONE. enriched ${Object.keys(enriched).length}/${words.length} → ${OUT}`);
