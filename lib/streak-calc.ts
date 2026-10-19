export type HeatmapDay = { date: string; words: number };

// A "day" here is a plain calendar date like "2026-10-17" — the day as the
// writer lived it, never a moment in time. Everything below treats those
// strings as abstract dates: the UTC arithmetic is only a way to count days,
// so time zones and daylight saving can't shift a cell.
const DAY_MS = 86_400_000;

function toMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// The browser's own calendar day (not UTC's).
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isValidDateKey(key: unknown): key is string {
  return typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key) && fromMs(toMs(key)) === key;
}

export function addDays(key: string, n: number): string {
  return fromMs(toMs(key) + n * DAY_MS);
}

// Whole days from b to a (positive when a is later).
export function dayDiff(a: string, b: string): number {
  return Math.round((toMs(a) - toMs(b)) / DAY_MS);
}

// 0 = Sunday … 6 = Saturday, for that calendar date.
export function weekdayOf(key: string): number {
  return new Date(toMs(key)).getUTCDay();
}

// The current streak and the last `span` days ending on `todayKey`, from
// per-day word totals. Today only counts once something has been written;
// until then the streak is still alive from yesterday.
export function buildStreakAndHeatmap(
  days: HeatmapDay[],
  todayKey: string,
  span = 90
): { streak: number; heatmap: HeatmapDay[] } {
  const byDay = new Map<string, number>();
  for (const d of days) byDay.set(d.date, (byDay.get(d.date) ?? 0) + d.words);

  let streak = 0;
  let cursor = (byDay.get(todayKey) ?? 0) > 0 ? todayKey : addDays(todayKey, -1);
  while ((byDay.get(cursor) ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const heatmap: HeatmapDay[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const key = addDays(todayKey, -i);
    heatmap.push({ date: key, words: Math.max(0, byDay.get(key) ?? 0) });
  }
  return { streak, heatmap };
}
