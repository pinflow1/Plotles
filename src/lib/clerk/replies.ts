// Everything the clerk says back. Plain text for WhatsApp (*bold* shows as bold there).
// Every number in these messages comes from the database's own reply, never from the AI.

import type { CorrectSaleItemData, EngineError, LowStockNotice, RecordSaleData, ReverseSaleData } from "../engine/types";
import type { ReadyItem } from "../nlp/validate-sale";
import { formatNaira, formatNumber } from "../reports/format";
import type { PastSale } from "./store";
import type { ClerkUser } from "./store";
import { firstName } from "./text";

export const MSG = {
  unknownSender: "Sorry, this number isn't on the shop team yet. Please ask the owner to add you.",
  notText: "I can only read text messages for now. Please type it out.",
  llmDown: "Sorry, I couldn't read that just now. Nothing was recorded. Please try again in a moment.",
  trouble: "Sorry, something went wrong on my side. Nothing was recorded. Please try again in a moment.",
  unsure:
    'Sorry, something went wrong and I can\'t be sure that was saved. Please send "sales today" to check before you send it again.',
  nothingWaiting: "I'm not waiting for an answer from you right now. Tell me what you'd like to do.",
  cancelled: "Okay, cancelled. Nothing was changed.",
  onlyOwn: "You can see your own sales here. The owner can see everyone's.",
  restockSoon: 'Updating the restock list from here isn\'t switched on yet. You can still ask "what do we need to buy?" to see it.',
} as const;

// ---------- sales ----------

export function lowStockLines(list: LowStockNotice[]): string[] {
  const out: string[] = [];
  for (const n of list) {
    out.push("", `⚠️ ${n.product_name} is low: ${formatNumber(n.remaining_stock)} remaining.`);
    out.push(n.newly_flagged ? "Added to restock list." : "Already on the restock list.");
  }
  return out;
}

export function saleRecorded(r: RecordSaleData): string {
  const lines = ["✓ Sale recorded", ""];
  if (r.items.length === 1) {
    const i = r.items[0];
    lines.push(`${i.product_name} ×${formatNumber(i.quantity)}`, formatNaira(i.amount), "", `Remaining stock: ${formatNumber(i.remaining_stock)}`);
  } else {
    for (const i of r.items) lines.push(`${i.product_name} ×${formatNumber(i.quantity)} — ${formatNaira(i.amount)}`);
    lines.push("", `Total: ${formatNaira(r.total_amount)}`, "", "Remaining stock:");
    const left = new Map<string, { name: string; stock: number }>();
    for (const i of r.items) left.set(i.product_id, { name: i.product_name, stock: i.remaining_stock });
    for (const { name, stock } of left.values()) lines.push(`${name}: ${formatNumber(stock)}`);
  }
  lines.push(...lowStockLines(r.low_stock));
  return lines.join("\n");
}

/** A sale that looks wrong (a price far from usual, a repeat) is shown back and needs a YES. */
export function saleCheckPrompt(items: ReadyItem[], total: number, reasons: string[]): string {
  const lines = ["Please check this sale:", ""];
  for (const i of items) lines.push(`${i.productName} ×${formatNumber(i.quantity)} — ${formatNaira(i.amount)}`);
  if (items.length > 1) lines.push(`Total: ${formatNaira(total)}`);
  lines.push("", ...reasons.map((r) => `• ${r}`), "", "Reply YES to record it, or NO to cancel.");
  return lines.join("\n");
}

// ---------- undo and fix ----------

export function undoPrompt(sale: PastSale, label: string): string {
  const lines = ["Undo this sale?", "", label];
  for (const i of sale.items) lines.push(`${i.productName} ×${formatNumber(i.quantity)} — ${formatNaira(i.amount)}`);
  if (sale.items.length > 1) lines.push(`Total: ${formatNaira(sale.totalAmount)}`);
  lines.push("", `Stock goes back up: ${sale.items.map((i) => `${i.productName} +${formatNumber(i.quantity)}`).join(", ")}.`);
  lines.push("", "Reply YES to undo it, or NO to keep it.");
  return lines.join("\n");
}

export function undone(r: ReverseSaleData): string {
  const lines = ["✓ Sale undone", "", `Removed ${formatNaira(r.total_amount)} from the sales.`];
  for (const x of r.restored) lines.push(`${x.product_name}: ${formatNumber(x.stock_before)} → ${formatNumber(x.stock_after)}`);
  return lines.join("\n");
}

export interface FixView {
  /** Whose sale and when, e.g. "Your sale, today 10:31". */
  label: string;
  productName: string;
  oldQuantity: number;
  newQuantity: number | null;
  oldAmount: number;
  newAmount: number | null;
}

export function fixPrompt(v: FixView): string {
  const lines = ["Fix this sale?", "", v.label, v.productName];
  if (v.newQuantity !== null) lines.push(`Quantity: ${formatNumber(v.oldQuantity)} → ${formatNumber(v.newQuantity)}`);
  lines.push(
    v.newAmount === null
      ? `Amount: ${formatNaira(v.oldAmount)} (unchanged)`
      : `Amount: ${formatNaira(v.oldAmount)} → ${formatNaira(v.newAmount)}`,
  );
  if (v.newQuantity !== null) {
    const diff = v.newQuantity - v.oldQuantity;
    lines.push(`Stock goes ${diff > 0 ? "down" : "up"} by ${formatNumber(Math.abs(diff))}.`);
  }
  lines.push(
    "",
    v.newAmount === null
      ? "Reply YES to confirm, NO to cancel, or send the new amount (like 64k)."
      : "Reply YES to confirm, or NO to cancel.",
  );
  return lines.join("\n");
}

export function fixed(r: CorrectSaleItemData): string {
  const lines = [
    "✓ Sale fixed",
    "",
    `${r.product_name} ×${formatNumber(r.new_quantity)} — ${formatNaira(r.new_amount)}`,
    `Sale total: ${formatNaira(r.sale_total)}`,
    `Remaining stock: ${formatNumber(r.remaining_stock)}`,
  ];
  if (r.needs_amount_review) {
    lines.push("", `The amount is still ${formatNaira(r.new_amount)}. If that changed too, tell me, for example: the amount should be 64k.`);
  }
  lines.push(...lowStockLines(r.low_stock));
  return lines.join("\n");
}

/** Turns a refusal from the database into something a person can act on. */
export function engineProblem(e: EngineError, what: "sale" | "fix" | "undo"): { text: string; uncertain: boolean } {
  const d = e.details ?? {};
  const known = (text: string) => ({ text, uncertain: false });
  switch (e.code) {
    case "INTERNAL_ERROR":
      return { text: MSG.unsure, uncertain: true };
    case "INSUFFICIENT_STOCK": {
      const name = typeof d.product_name === "string" ? d.product_name : "that product";
      const have = typeof d.available === "number" ? d.available : null;
      const need = typeof d.requested === "number" ? d.requested : null;
      if (have === null || need === null) return known(`There isn't enough ${name} in stock.`);
      if (what === "fix") return known(`Only ${formatNumber(have)} ${name} in stock, but this change needs ${formatNumber(need)} more.`);
      if (have <= 0) return known(`No ${name} in stock.`);
      return known(`Only ${formatNumber(have)} ${name} in stock, but this sale needs ${formatNumber(need)}.`);
    }
    case "SALE_ALREADY_REVERSED":
      return known("That sale was already undone.");
    case "SALE_NOT_FOUND":
      return known("I can't find that sale any more.");
    case "NO_CHANGE":
      return known("That's already what the sale says.");
    default:
      return known(`I couldn't do that: ${e.message}`);
  }
}

// ---------- help ----------

export function helpText(user: ClerkUser, greeting: boolean): string {
  const lines = [
    greeting ? `Hi ${firstName(user.name)}! I'm your shop clerk.` : "Sorry, I didn't understand that.",
    "",
    "You can tell me things like:",
    "• sold 50 white paper for 40k",
    "• how much white paper do we have?",
    "• what did I sell today?",
    "• undo my last sale",
  ];
  if (user.role === "admin") {
    lines.push("• how much did we make yesterday?", "• what do we need to buy?", "• what is low in stock?");
  }
  return lines.join("\n");
}
