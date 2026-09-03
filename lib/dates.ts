const MS = 86400000;

export function todayStr(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, n: number): string {
  const t = Date.parse(dateStr + "T00:00:00Z");
  return new Date(t + n * MS).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const ta = Date.parse(a + "T00:00:00Z");
  const tb = Date.parse(b + "T00:00:00Z");
  return Math.round((ta - tb) / MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}
