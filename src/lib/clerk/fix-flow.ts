// Undoing a sale and fixing one. Both show exactly what will change and wait for a YES.
// Who may change what:
//   staff   their own sales from the last 24 hours
//   owner   any sale. Naming a person ("undo Chidi's last sale") picks that person's sales;
//           otherwise it is the owner's own latest, or the shop's latest if the owner has none.
// The permission is checked again when the YES arrives, not just when we asked.

import { correctSaleItem, reverseSale } from "../engine/engine";
import type { CorrectSale, UndoSale } from "../nlp/interpretation";
import { matchProduct } from "../nlp/matcher";
import { MAX_AMOUNT, parseNaira } from "../nlp/money";
import { MAX_QUANTITY } from "../nlp/validate-sale";
import { formatNaira, orList } from "../reports/format";
import type { Pending } from "./pending";
import { engineProblem, fixed, fixPrompt, MSG, undone, undoPrompt } from "./replies";
import { recentSales } from "./store";
import type { PastItem, PastSale } from "./store";
import { mentionedPeople, parseYesNo, whenLabel } from "./text";
import type { FlowCtx, Reply } from "./types";

/** Staff can change their own sales for this long after making them. */
export const FIX_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOOK_BACK = 10;

const refuse = (text: string): Reply => ({ text, outcome: "rejected" });
const isReply = (x: unknown): x is Reply => typeof x === "object" && x !== null && "outcome" in x;

const label = (f: FlowCtx, s: PastSale) =>
  `${s.salespersonId === f.user.id ? "Your sale" : `${s.salespersonName}'s sale`}, ${whenLabel(s.createdAt, f.now)}`;

/** The sales this person may change, newest first, or the reason they may not. */
async function reachable(f: FlowCtx): Promise<PastSale[] | Reply> {
  const others = mentionedPeople(f.original, f.ctx.staff, f.user.id);

  if (f.user.role === "staff") {
    if (others.length > 0) return refuse("You can only change your own sales. The owner can change anyone's.");
    const all = await recentSales(f.db, f.user.id, LOOK_BACK);
    const fresh = all.filter((s) => f.now.getTime() - s.createdAt.getTime() <= FIX_WINDOW_MS);
    if (fresh.length > 0) return fresh;
    return refuse(
      all.length === 0
        ? "I can't find a recent sale of yours to change."
        : "Your last sale was more than 24 hours ago, so only the owner can change it.",
    );
  }

  if (others.length > 1) return refuse(`Whose sale do you mean: ${orList(others.map((o) => o.name))}?`);
  if (others.length === 1) {
    const theirs = await recentSales(f.db, others[0].id, LOOK_BACK);
    return theirs.length > 0 ? theirs : refuse(`I can't find a recent sale by ${others[0].name}.`);
  }
  const own = await recentSales(f.db, f.user.id, LOOK_BACK);
  if (own.length > 0) return own;
  const shop = await recentSales(f.db, null, LOOK_BACK);
  return shop.length > 0 ? shop : refuse("There are no sales to change yet.");
}

/** The product the person named, if any. A name that is not clearly one product is a question, not a guess. */
function namedProduct(f: FlowCtx, text: string | null): { id: string; name: string } | null | Reply {
  if (text === null) return null;
  const m = matchProduct(text, f.ctx.products);
  if (m.kind === "match") return { id: m.product.id, name: m.product.name };
  if (m.kind === "none") return refuse(`I couldn't find "${text}" in your products. Please send it again with the right name.`);
  if (m.kind === "confirm") return refuse(`Did you mean ${m.product.name}? Please send it again with the right name.`);
  return refuse(
    `I found multiple ${text.toLowerCase()} products (${orList(m.candidates.map((c) => c.name))}). Please send it again with the full name.`,
  );
}

/** The sale again, fresh from the database, if this person may still change it. */
async function findSale(f: FlowCtx, saleId: string): Promise<PastSale | null> {
  const list = await recentSales(f.db, f.user.role === "admin" ? null : f.user.id, 20);
  const sale = list.find((s) => s.id === saleId);
  if (!sale) return null;
  if (f.user.role !== "admin" && f.now.getTime() - sale.createdAt.getTime() > FIX_WINDOW_MS) return null;
  return sale;
}

// ---------- undo ----------

export async function startUndo(f: FlowCtx, i: UndoSale): Promise<Reply> {
  const sales = await reachable(f);
  if (isReply(sales)) return sales;
  const product = namedProduct(f, i.product_text);
  if (isReply(product)) return product;

  const sale = sales.find((s) => product === null || s.items.some((x) => x.productId === product.id));
  if (!sale) return refuse(product === null ? "I can't find a recent sale to undo." : `I can't find a recent ${product.name} sale to undo.`);
  return {
    text: undoPrompt(sale, label(f, sale)),
    outcome: "confirm",
    pending: { type: "confirm_undo", original: f.original, saleId: sale.id },
  };
}

export async function answerUndo(f: FlowCtx, p: Extract<Pending, { type: "confirm_undo" }>, reply: string): Promise<Reply | null> {
  const yn = parseYesNo(reply);
  if (yn === null) return null;
  if (yn === "no") return { text: "Okay, I'll leave that sale as it is.", outcome: "cancelled" };

  const sale = await findSale(f, p.saleId);
  if (!sale) return refuse("I can't find that sale any more. It may already be undone.");

  f.trace.wrote = true;
  const r = await reverseSale(f.db, {
    saleId: p.saleId,
    userId: f.user.id,
    reason: `Undone by ${f.user.name} on WhatsApp`,
    originalMessage: p.original,
    interpretedCommand: { intent: "undo_sale", confirmed: true },
  });
  if (r.ok) return { text: undone(r), outcome: "undone" };
  const problem = engineProblem(r.error, "undo");
  return { text: problem.text, outcome: problem.uncertain ? "error" : "rejected", note: `${r.error.code}: ${r.error.message}` };
}

// ---------- fix ----------

type NewValues = { ok: true; newQuantity: number | null; newAmount: number | null } | { ok: false; text: string };

/** Reads what the person wants it changed to. A value that equals what is already there is dropped. */
function newValues(i: CorrectSale, item: PastItem): NewValues {
  let newAmount: number | null = null;
  if (i.new_amount_text !== null) {
    const p = parseNaira(i.new_amount_text);
    if (!p.ok) return { ok: false, text: `I couldn't read the amount "${i.new_amount_text}". Please send it as a number, like 80k or 80,000.` };
    if (i.new_amount !== null && Math.abs(i.new_amount - p.amount) >= 0.005) {
      return { ok: false, text: `I'm not sure about the amount. Was it ${formatNaira(p.amount)} or ${formatNaira(i.new_amount)}? Please send the correction again.` };
    }
    if (p.amount > MAX_AMOUNT) return { ok: false, text: "That amount is too large to record. Please check it." };
    newAmount = p.amount;
  } else if (i.new_amount !== null) {
    return { ok: false, text: "What is the new amount? Please type it, like 64k or 64,000." };
  }

  let newQuantity: number | null = null;
  if (i.new_quantity !== null) {
    const q = i.new_quantity;
    if (!Number.isInteger(q) || q < 1 || q > MAX_QUANTITY) return { ok: false, text: "The quantity must be a whole number above zero." };
    newQuantity = q;
  }

  if (newQuantity === null && newAmount === null) {
    return { ok: false, text: "What should it be changed to? For example: make it 80, or the amount should be 64k." };
  }
  if (newQuantity === item.quantity) newQuantity = null;
  if (newAmount === item.amount) newAmount = null;
  if (newQuantity === null && newAmount === null) return { ok: false, text: "That's already what the sale says." };
  return { ok: true, newQuantity, newAmount };
}

const view = (f: FlowCtx, sale: PastSale, item: PastItem, newQuantity: number | null, newAmount: number | null) =>
  fixPrompt({
    label: label(f, sale),
    productName: item.productName,
    oldQuantity: item.quantity,
    newQuantity,
    oldAmount: item.amount,
    newAmount,
  });

export async function startFix(f: FlowCtx, i: CorrectSale): Promise<Reply> {
  const sales = await reachable(f);
  if (isReply(sales)) return sales;
  const product = namedProduct(f, i.product_text);
  if (isReply(product)) return product;

  const itemsOf = (s: PastSale) =>
    s.items.filter((x) => (product === null || x.productId === product.id) && (i.old_quantity === null || x.quantity === i.old_quantity));
  const sale = sales.find((s) => itemsOf(s).length > 0);
  if (!sale) {
    return refuse(
      i.old_quantity === null
        ? "I can't find a recent sale to change."
        : `I couldn't find a recent sale of ${i.old_quantity}${product === null ? "" : ` ${product.name}`}. Please check the number and send the correction again.`,
    );
  }
  const matches = itemsOf(sale);
  if (matches.length > 1) {
    const names = [...new Set(matches.map((m) => m.productName))];
    return refuse(`That sale has more than one item (${orList(names)}). Say which one, for example: make the ${names[0]} 30.`);
  }
  const item = matches[0];

  const wanted = newValues(i, item);
  if (!wanted.ok) return refuse(wanted.text);

  if (wanted.newQuantity !== null && !f.ctx.allowNegativeStock) {
    const extra = wanted.newQuantity - item.quantity;
    const stock = f.ctx.products.find((p) => p.id === item.productId)?.current_stock;
    if (extra > 0 && stock !== undefined && stock < extra) {
      return refuse(`Only ${stock} ${item.productName} in stock, but this change needs ${extra} more.`);
    }
  }

  return {
    text: view(f, sale, item, wanted.newQuantity, wanted.newAmount),
    outcome: "confirm",
    pending: {
      type: "confirm_fix",
      original: f.original,
      saleId: sale.id,
      itemId: item.id,
      oldQuantity: item.quantity,
      oldAmount: item.amount,
      newQuantity: wanted.newQuantity,
      newAmount: wanted.newAmount,
    },
  };
}

const CHANGED = "That sale has changed since I asked. Please send the correction again.";

/** YES applies the fix, NO drops it, and a new amount shows the fix again with that amount. */
export async function answerFix(f: FlowCtx, p: Extract<Pending, { type: "confirm_fix" }>, reply: string): Promise<Reply | null> {
  const yn = parseYesNo(reply);
  if (yn === "no") return { text: MSG.cancelled, outcome: "cancelled" };

  let money: number | null = null;
  if (yn === null) {
    const m = /\d/.test(reply) ? parseNaira(reply) : null;
    if (m === null || !m.ok || m.amount > MAX_AMOUNT) return null; // not an answer: read it as a new message
    money = m.amount;
  }

  const sale = await findSale(f, p.saleId);
  if (!sale) return refuse("I can't find that sale any more. It may already be undone.");
  const item = sale.items.find((x) => x.id === p.itemId);
  if (!item || item.quantity !== p.oldQuantity || item.amount !== p.oldAmount) return refuse(CHANGED);

  if (money !== null) {
    const newAmount = money === item.amount ? null : money;
    if (p.newQuantity === null && newAmount === null) return refuse("That's already what the sale says.");
    return {
      text: view(f, sale, item, p.newQuantity, newAmount),
      outcome: "confirm",
      pending: { ...p, newAmount },
    };
  }

  f.trace.wrote = true;
  const r = await correctSaleItem(f.db, {
    saleItemId: p.itemId,
    userId: f.user.id,
    newQuantity: p.newQuantity ?? undefined,
    newAmount: p.newAmount ?? undefined,
    originalMessage: p.original,
    interpretedCommand: { intent: "correct_sale", confirmed: true, new_quantity: p.newQuantity, new_amount: p.newAmount },
  });
  if (r.ok) return { text: fixed(r), outcome: "corrected" };
  const problem = engineProblem(r.error, "fix");
  return { text: problem.text, outcome: problem.uncertain ? "error" : "rejected", note: `${r.error.code}: ${r.error.message}` };
}
