export type Pace = {
  totalWords: number;
  goalWordCount: number;
  wordsRemaining: number;
  daysRemaining: number | null;
  dailyTarget: number | null;
  progress: number;
  overdue: boolean;
};

export function computePace(totalWords: number, goalWordCount: number | null, deadline: Date | string | null): Pace | null {
  if (!goalWordCount || goalWordCount <= 0) return null;

  const wordsRemaining = Math.max(0, goalWordCount - totalWords);
  const progress = Math.min(1, totalWords / goalWordCount);

  let daysRemaining: number | null = null;
  let dailyTarget: number | null = null;
  let overdue = false;

  if (deadline) {
    const end = new Date(deadline);
    end.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    daysRemaining = Math.round((end.getTime() - today.getTime()) / msPerDay);
    overdue = daysRemaining < 0 && wordsRemaining > 0;
    dailyTarget = wordsRemaining === 0 ? 0 : Math.ceil(wordsRemaining / Math.max(1, daysRemaining));
  }

  return { totalWords, goalWordCount, wordsRemaining, daysRemaining, dailyTarget, progress, overdue };
}
