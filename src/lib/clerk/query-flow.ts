// Answering questions about stock and sales, with the rule about who may see what:
//   everyone  stock, prices, low stock, the restock list
//   the owner all sales, by product or by person ("me" means the owner's own)
//   staff     their own sales only
// The numbers come from the database (see reports/answer.ts); this file only decides what is allowed.

import { matchProduct } from "../nlp/matcher";
import { todayInLagos } from "../nlp/prompt";
import { answerQuery } from "../reports/answer";
import type { QueryInterpretation } from "../reports/answer";
import { answerQueryQuestion } from "./pending";
import type { Pending } from "./pending";
import { MSG } from "./replies";
import type { ClerkContext, ClerkUser } from "./store";
import type { FlowCtx, Reply } from "./types";

type Person = { id: string; name: string };
type Scoped = { ok: true; query: QueryInterpretation; staff: Person[] } | { ok: false; text: string };

const SELF = new Set(["me", "my", "mine", "myself", "i"]);
const OURS = new Set(["DB_ERROR", "BAD_REPLY", "INTERNAL_ERROR"]);

/** Applies the rules above. Sales questions are narrowed to the person asking when they must be. */
export function scopeQuery(user: ClerkUser, ctx: ClerkContext, q: QueryInterpretation): Scoped {
  const everyone = ctx.staff.map(({ id, name }) => ({ id, name }));
  if (q.intent !== "query_sales") return { ok: true, query: q, staff: everyone };

  const asksForSelf = q.staff_text !== null && SELF.has(q.staff_text.trim().toLowerCase());
  if (user.role === "admin") {
    return { ok: true, query: asksForSelf ? { ...q, staff_text: user.name } : q, staff: everyone };
  }

  // Staff: only their own sales, whatever the question says.
  if (q.group_by === "staff") return { ok: false, text: MSG.onlyOwn };
  if (q.staff_text !== null && !asksForSelf) {
    const named = matchProduct(q.staff_text, [{ id: user.id, name: user.name, aliases: [] }]);
    if (named.kind !== "match") return { ok: false, text: MSG.onlyOwn };
  }
  return { ok: true, query: { ...q, staff_text: user.name }, staff: [{ id: user.id, name: user.name }] };
}

function context(f: FlowCtx, staff: Person[]) {
  return { db: f.db, today: todayInLagos(f.now), products: f.ctx.products, staff };
}

export async function runQuery(f: FlowCtx, q: QueryInterpretation): Promise<Reply> {
  const s = scopeQuery(f.user, f.ctx, q);
  if (!s.ok) return { text: s.text, outcome: "rejected" };
  const out = await answerQuery(context(f, s.staff), s.query);
  switch (out.status) {
    case "answer":
      return { text: out.text, outcome: "answered" };
    case "ask":
      // The question we remember is the one the person asked, not the narrowed copy.
      return { text: out.question, outcome: "asked", pending: { type: "query", original: f.original, query: q } };
    case "reject":
      return {
        text: out.message,
        outcome: OURS.has(out.code) ? "error" : "rejected",
        note: out.detail === undefined ? out.code : `${out.code}: ${out.detail}`,
      };
  }
}

/** The person answered a question about their question. null = that was not an answer. */
export async function resumeQuery(f: FlowCtx, p: Extract<Pending, { type: "query" }>, reply: string): Promise<Reply | null> {
  const s = scopeQuery(f.user, f.ctx, p.query);
  if (!s.ok) return null;
  const out = await answerQuery(context(f, s.staff), s.query);
  if (out.status !== "ask") return null;
  const a = answerQueryQuestion(p.query, out.need, reply, {
    products: f.ctx.products,
    staff: s.staff.map((x) => ({ ...x, aliases: [] as string[] })),
  });
  if (a.kind === "none") return null;
  if (a.kind === "cancel") return { text: MSG.cancelled, outcome: "cancelled" };
  return runQuery({ ...f, original: p.original }, a.query);
}
