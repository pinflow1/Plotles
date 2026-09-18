type HeatmapDay = { date: string; words: number };

function intensityClass(words: number, dailyGoalTotal: number): string {
  if (words <= 0) return "bg-active";
  if (dailyGoalTotal > 0) {
    const ratio = words / dailyGoalTotal;
    if (ratio >= 1) return "bg-strong";
    if (ratio >= 0.5) return "bg-strong/65";
    return "bg-strong/35";
  }
  return "bg-strong/55";
}

function toWeeks(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  if (days.length === 0) return [];
  const firstDow = new Date(days[0].date + "T00:00:00Z").getUTCDay();
  const padded: (HeatmapDay | null)[] = [...Array(firstDow).fill(null), ...days];
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}

export function StreakHeatmap({ streak, heatmap, dailyGoalTotal }: { streak: number; heatmap: HeatmapDay[]; dailyGoalTotal: number }) {
  const weeks = toWeeks(heatmap);

  return (
    <section className="mt-2 rounded-2xl bg-surface p-5">
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-3xl text-text">{streak}</span>
        <span className="text-sm text-text-soft">day{streak === 1 ? "" : "s"} in a row</span>
      </div>

      <div className="mt-4 flex gap-[3px] overflow-x-auto scrollbar-hide">
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {week.map((day, j) =>
              day ? (
                <div
                  key={j}
                  title={`${day.date}: ${day.words} word${day.words === 1 ? "" : "s"}`}
                  className={`h-[11px] w-[11px] rounded-[2px] ${intensityClass(day.words, dailyGoalTotal)}`}
                />
              ) : (
                <div key={j} className="h-[11px] w-[11px]" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-text-soft">
        Last 90 days{dailyGoalTotal > 0 ? " · full color means you hit that day's goal" : ""}
      </div>
    </section>
  );
}
