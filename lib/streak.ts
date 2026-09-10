import { prisma } from "@/lib/prisma";

export type HeatmapDay = { date: string; words: number };

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getStreakAndHeatmap(userId: string): Promise<{ streak: number; heatmap: HeatmapDay[] }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 400);

  const rows = await prisma.writingLog.findMany({
    where: { userId, date: { gte: since } },
    select: { date: true, words: true },
  });

  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = toDateKey(row.date);
    byDay.set(key, (byDay.get(key) ?? 0) + row.words);
  }

  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  const todayKey = toDateKey(cursor);
  if ((byDay.get(todayKey) ?? 0) <= 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while ((byDay.get(toDateKey(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const heatmap: HeatmapDay[] = [];
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - 89);
  for (let i = 0; i < 90; i++) {
    const key = toDateKey(day);
    heatmap.push({ date: key, words: Math.max(0, byDay.get(key) ?? 0) });
    day.setUTCDate(day.getUTCDate() + 1);
  }

  return { streak, heatmap };
}
