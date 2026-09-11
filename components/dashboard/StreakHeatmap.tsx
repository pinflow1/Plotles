type HeatmapDay = { date: string; words: number };

function intensityClass(words: number): string {
  if (words <= 0) return "bg-active";
  if (words < 200) return "bg-strong/30";
  if (words < 600) return "bg-strong/60";
  return "bg-strong";
}

// Arrange the flat 90-day array into GitHub-style weekly columns, padding
// the first (partial) week so every column lines up Sun–Sat.
function toWeeks(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  if (days.length === 0) return [];
  const firstDow = new Date(days[0].date + "T00:00:00Z").getUTCDay();
  const padded: (HeatmapDay | null)[] = [...Array(firstDow).fill(null), ...days];
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}

export function StreakHeatmap({ streak, heatmap }: { streak: number; heatmap: HeatmapDay[] }) {
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
                <div key={j} title={`${day.date}: ${day.words} word${day.words === 1 ? "" : "s"}`} className={`h-[11px] w-[11px] rounded-[2px] ${intensityClass(day.words)}`} />
              ) : (
                <div key={j} className="h-[11px] w-[11px]" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-text-soft">Last 90 days</div>
    </section>
  );
}
