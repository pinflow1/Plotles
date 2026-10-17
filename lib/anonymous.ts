// Story modes where participants go by "Anonymous Writer NN" instead of
// their pen name.
export const ANONYMOUS_MODES = ["anonymous_duo", "public_anonymous", "private_anonymous"];

// What the matched partner sees in place of the owner's pen name on an
// Anonymous Duo — both sides start out not knowing each other.
export const ANONYMOUS_OWNER_LABEL = "Anonymous Author";

// "Anonymous Writer 01" — the name a participant goes by on an anonymous
// story. The number is assigned when they join (see
// /api/collaboration-requests/[id]), so it stays the same if others come
// and go.
export function anonymousLabel(n: number | null | undefined): string {
  return n ? `Anonymous Writer ${String(n).padStart(2, "0")}` : "Anonymous Writer";
}
