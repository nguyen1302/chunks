// Backs up the whole `chunks` MongoDB database to this machine as an EJSON
// snapshot (preserves ObjectId/Date types for exact restore). Keeps the most
// recent KEEP snapshots and prunes older ones.
//
// Manual run:  node scripts/backup.mjs
// Scheduled weekly via ~/Library/LaunchAgents/tech.bktech.chunks-backup.plist
import { MongoClient } from "mongodb";
import { EJSON } from "bson";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const BACKUP_DIR = process.env.BACKUP_DIR || join(homedir(), "chunks-backups");
const KEEP = 8;

// Load env from the project's .env
for (const line of readFileSync(join(projectRoot, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "chunks");

  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  const dump = { db: db.databaseName, exportedAt: new Date().toISOString(), collections: {} };
  let totalDocs = 0;
  for (const name of collections) {
    const docs = await db.collection(name).find().toArray();
    dump.collections[name] = docs;
    totalDocs += docs.length;
  }
  await client.close();

  const file = join(BACKUP_DIR, `chunks-${stamp()}.ejson`);
  writeFileSync(file, EJSON.stringify(dump, { relaxed: false }, 2));
  console.log(`Backed up ${totalDocs} docs from ${collections.length} collections → ${file}`);

  // prune old snapshots
  const snaps = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("chunks-") && f.endsWith(".ejson"))
    .sort();
  const excess = snaps.slice(0, Math.max(0, snaps.length - KEEP));
  for (const f of excess) {
    rmSync(join(BACKUP_DIR, f));
    console.log(`Pruned old snapshot ${f}`);
  }
}

main().catch((e) => {
  console.error("BACKUP ERROR:", e.message);
  process.exit(1);
});
