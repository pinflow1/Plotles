// The question we are waiting on, and how a short answer to it is read.
// What is stored is only the draft (what the person said so far). When the answer comes, we work out
// again what we were asking, from the same checks that asked it, so the stored text is never trusted
// to say what the question was. An answer we cannot read as an answer is treated as a new message.

import { validateInterpretation } from "../nlp/interpretation";
import type { RecordSale } from "../nlp/interpretation";
import { matchProduct } from "../nlp/matcher";
import type { Need } from "../nlp/validate-sale";
import type { QueryInterpretation, QueryNeed } from "../reports/answer";
import { isCancel, parseCount, parseIndex, parseName, parseYesNo } from "./text";

export type Pending =
  | { type: "sale"; original: string; draft: RecordSale }
  | { type: "confirm_sale"; original: string; draft: RecordSale }
  | { type: "confirm_undo"; original: string; saleId: string }
  | {
      type: "confirm_fix";
      original: string;
      saleId: string;
      itemId: string;
      oldQuantity: number;
      oldAmount: number;
      newQuantity: number | null;
      newAmount: number | null;
    }
  | { type: "query"; original: string; query: QueryInterpretation };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 && v.length <= 2000 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const numOrNull = (v: unknown): number | null | undefined => (v === null ? null : (num(v) ?? undefined));

/** Reads what the database gives back. Anything that is not exactly one of ours is "nothing waiting". */
export function parsePending(raw: unknown): Pending | null {
  if (!isObj(raw)) return null;
  const original = str(raw.original);
  if (original === null) return null;
  const type = raw.type;

  if (type === "sale" || type === "confirm_sale") {
    const d = validateInterpretation(raw.draft);
    return d.ok && d.value.intent === "record_sale" ? { type, original, draft: d.value } : null;
  }
  if (type === "confirm_undo") {
    const saleId = str(raw.saleId);
    return saleId === null ? null : { type, original, saleId };
  }
  if (type === "confirm_fix") {
    const saleId = str(raw.saleId);
    const itemId = str(raw.itemId);
    const oldQuantity = num(raw.oldQuantity);
    const oldAmount = num(raw.oldAmount);
    const newQuantity = numOrNull(raw.newQuantity);
    const newAmount = numOrNull(raw.newAmount);
    if (saleId === null || itemId === null || oldQuantity === null || oldAmount === null) return null;
    if (newQuantity === undefined || newAmount === undefined || (newQuantity === null && newAmount === null)) return null;
    return { type, original, saleId, itemId, oldQuantity, oldAmount, newQuantity, newAmount };
  }
  if (type === "query") {
    const q = validateInterpretation(raw.query);
    if (!q.ok) return null;
    const i = q.value.intent;
    const isQuery = i === "query_stock" || i === "query_low_stock" || i === "query_restock_list" || i === "query_sales";
    return isQuery ? { type, original, query: q.value as QueryInterpretation } : null;
  }
  return null;
}

// ---------- reading a short answer ----------

type Known = Array<{ id: string; name: string; aliases: string[] }>;

/**
 * The answer to "which product?" or "which person?". A short plain name is taken as it comes. A reply with
 * numbers in it, or more than three words, is a new message (a whole sale typed again, say) unless it is
 * clearly something we know ("a4 paper"). Otherwise the whole sentence would be taken for a product name.
 */
function nameAnswer(reply: string, known: Known, max = 60): string | null {
  const name = parseName(reply, max);
  if (name === null) return null;
  const plain = name.split(/\s+/).length <= 3 && !/\d/.test(name);
  return plain || matchProduct(name, known).kind !== "none" ? name : null;
}

// ---------- answers to a sale question ----------

export type SaleAnswer = { kind: "patched"; draft: RecordSale } | { kind: "cancel" } | { kind: "none" };

const NONE: { kind: "none" } = { kind: "none" };
const CANCEL: { kind: "cancel" } = { kind: "cancel" };

function withItem(draft: RecordSale, index: number, change: Partial<RecordSale["items"][number]>): SaleAnswer {
  if (index < 0 || index >= draft.items.length) return NONE;
  const items = draft.items.map((it, i) => (i === index ? { ...it, ...change } : it));
  return { kind: "patched", draft: { ...draft, items } };
}

/** Which of these did the person pick? A number ("2") or the name ("white paper"). */
function pick(reply: string, candidates: Array<{ id: string; name: string }>): { id: string; name: string } | null {
  const n = parseIndex(reply, candidates.length);
  if (n !== null) return candidates[n - 1];
  const m = matchProduct(
    reply,
    candidates.map((c) => ({ ...c, aliases: [] as string[] })),
  );
  return m.kind === "match" ? m.product : null;
}

/** Puts a short answer into the draft, according to what we asked. */
export function answerSaleQuestion(draft: RecordSale, need: Need, reply: string, known: Known = []): SaleAnswer {
  if (need.kind === "split_total") return NONE;
  const i = need.itemIndex;
  switch (need.kind) {
    case "product_missing":
    case "product_unknown": {
      if (isCancel(reply)) return CANCEL;
      const name = nameAnswer(reply, known);
      return name === null ? NONE : withItem(draft, i, { product_text: name });
    }
    case "product_choice": {
      if (isCancel(reply)) return CANCEL;
      const chosen = pick(reply, need.candidates);
      return chosen === null ? NONE : withItem(draft, i, { product_text: chosen.name });
    }
    case "product_confirm": {
      const yn = parseYesNo(reply);
      if (yn === "yes") return withItem(draft, i, { product_text: need.candidate.name });
      if (yn === "no") return withItem(draft, i, { product_text: null }); // we will ask which product it was
      return NONE;
    }
    case "quantity": {
      if (isCancel(reply)) return CANCEL;
      const q = parseCount(reply);
      return q === null ? NONE : withItem(draft, i, { quantity: q });
    }
    case "amount":
    case "amount_conflict": {
      if (isCancel(reply)) return CANCEL;
      const t = reply.trim();
      // Anything short with a digit is an attempt at an amount. If it cannot be read, we ask again.
      if (t.length > 30 || !/\d/.test(t)) return NONE;
      return withItem(draft, i, { amount_text: t, amount: null, amount_basis: /\b(each|per|@)\b|@/i.test(t) ? "per_unit" : "total" });
    }
  }
}

// ---------- answers to a question about stock or sales ----------

export type QueryAnswer = { kind: "patched"; query: QueryInterpretation } | { kind: "cancel" } | { kind: "none" };

function withName(q: QueryInterpretation, field: "product_text" | "staff_text", value: string): QueryAnswer {
  if (field === "staff_text") {
    return q.intent === "query_sales" ? { kind: "patched", query: { ...q, staff_text: value } } : NONE;
  }
  if (q.intent === "query_stock" || q.intent === "query_sales") return { kind: "patched", query: { ...q, product_text: value } };
  return NONE;
}

/** Puts a short answer into the question, according to what we asked. */
export function answerQueryQuestion(
  q: QueryInterpretation,
  need: QueryNeed,
  reply: string,
  known: { products: Known; staff: Known } = { products: [], staff: [] },
): QueryAnswer {
  const field = need.kind.startsWith("staff") ? "staff_text" : "product_text";
  switch (need.kind) {
    case "product_unknown":
    case "staff_unknown": {
      if (isCancel(reply)) return CANCEL;
      const name = nameAnswer(reply, field === "staff_text" ? known.staff : known.products, 40);
      return name === null ? NONE : withName(q, field, name);
    }
    case "product_choice":
    case "staff_choice": {
      if (isCancel(reply)) return CANCEL;
      const chosen = pick(reply, need.candidates);
      return chosen === null ? NONE : withName(q, field, chosen.name);
    }
    case "product_confirm":
    case "staff_confirm": {
      const yn = parseYesNo(reply);
      if (yn === "yes") return withName(q, field, need.candidate.name);
      return yn === "no" ? CANCEL : NONE;
    }
  }
}
