// Restore the `chunks` database from an EJSON snapshot produced by backup.mjs.
// DESTRUCTIVE: replaces the current collections with the snapshot's contents.
//
// Usage:  node scripts/restore.mjs <path-to-snapshot.ejson> --yes
import { MongoClient } from "mongodb";
import { EJSON } from "bson";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const file = process.argv[2];
const confirmed = process.argv.includes("--yes");

if (!file) {
  console.error("Usage: node scripts/restore.mjs <snapshot.ejson> --yes");
  process.exit(1);
}
for (const line of readFileSync(join(projectRoot, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const dump = EJSON.parse(readFileSync(file, "utf8"));
  const names = Object.keys(dump.collections);
  const counts = names.map((n) => `${n}=${dump.collections[n].length}`).join(", ");
  console.log(`Snapshot exportedAt ${dump.exportedAt} → ${counts}`);
  if (!confirmed) {
    console.error("Refusing to restore without --yes (this REPLACES current data).");
    process.exit(1);
  }
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "chunks");
  for (const name of names) {
    await db.collection(name).deleteMany({});
    if (dump.collections[name].length) await db.collection(name).insertMany(dump.collections[name]);
    console.log(`Restored ${dump.collections[name].length} docs into ${name}`);
  }
  await client.close();
  console.log("Restore complete.");
}

main().catch((e) => {
  console.error("RESTORE ERROR:", e.message);
  process.exit(1);
});
