import { prisma } from "@/lib/prisma";
import { buildStreakAndHeatmap, type HeatmapDay } from "@/lib/streak-calc";

export type { HeatmapDay };

// Per-day word totals for a bit over the last year, as plain calendar dates
// exactly as they were logged (the writer's own day — see the chapter route).
// The streak and the 90-day grid are built from these in the browser,
// because only the browser knows what "today" is for the writer; the server
// clock is UTC and would put late-night writing in the wrong cell.
export async function getWritingDays(userId: string): Promise<HeatmapDay[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 400);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.writingLog.findMany({
    where: { userId, date: { gte: since } },
    select: { date: true, words: true },
  });

  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + row.words);
  }
  return Array.from(byDay, ([date, words]) => ({ date, words }));
}

// Kept for /api/stats, which nothing in the app calls: same numbers, counted
// against UTC's "today". The Dashboard doesn't use this.
export async function getStreakAndHeatmap(userId: string): Promise<{ streak: number; heatmap: HeatmapDay[] }> {
  return buildStreakAndHeatmap(await getWritingDays(userId), new Date().toISOString().slice(0, 10));
}
