/** Parse a raw tags string (comma- or newline-separated) into a clean,
 * lowercased, de-duplicated list preserving first-seen order. */
export function parseTags(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(/[,\n]/)) {
    const s = part.trim().toLowerCase();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
