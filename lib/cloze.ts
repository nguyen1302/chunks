function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Blank the first case-insensitive occurrence of `expression` in `example`
 * with "_____". Returns `found=false` (and the original text) when the
 * expression does not appear literally (e.g. conjugated forms).
 */
export function clozeExample(example: string, expression: string): { text: string; found: boolean } {
  const expr = expression.trim();
  if (!expr) return { text: example, found: false };
  const re = new RegExp(escapeRegExp(expr), "i");
  if (!re.test(example)) return { text: example, found: false };
  return { text: example.replace(re, "_____"), found: true };
}
