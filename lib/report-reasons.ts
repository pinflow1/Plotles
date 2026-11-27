// Why someone can report a writer, a story or a message. One list, shared by
// the report form and the API, so the two can't drift apart.
export const REPORT_REASONS = [
  { id: "spam", label: "Spam or advertising" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate speech or threats" },
  { id: "sexual", label: "Sexually explicit content" },
  { id: "impersonation", label: "Pretending to be someone else" },
  { id: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && REPORT_REASONS.some((r) => r.id === value);
}

export function reasonLabel(id: string): string {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
}

/** Longest "tell us more" text a report may carry. */
export const REPORT_DETAILS_MAX = 500;
