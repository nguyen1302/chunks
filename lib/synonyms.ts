/** Parse a raw synonyms string (comma- or newline-separated) into a clean,
 * de-duplicated (case-insensitive) list, preserving first-seen order. */
export function parseSynonyms(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(/[,\n]/)) {
    const s = part.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Join a synonyms list back into the stored comma-separated string. */
export function formatSynonyms(list: string[]): string {
  return list.join(", ");
}
