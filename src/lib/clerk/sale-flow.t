// Recording a sale. The AI's reading goes through validateSale first (it asks when something is
// missing), then two sanity checks (a price far from usual, a repeat of the sale just made), and only
// then does the database engine record it. A sale that looks wrong is shown back and needs a YES.

import { recordSale } from "../engine/engine";
import type { RecordSale } from "../nlp/interpretation";
import { validateSale } from "../nlp/validate-sale";
import type { ReadyItem } from "../nlp/validate-sale";
import { formatNaira } from "../reports/format";
import { answerSaleQuestion } from "./pending";
import type { Pending } from "./pending";
import { engineProblem, MSG, saleCheckPrompt, saleRecorded } from "./replies";
import { recentSales } from "./store";
import { parseYesNo } from "./text";
import type { FlowCtx, Reply } from "./types";

/** A price per piece below 0.4x or above 2.5x the usual one is probably a typo (a missing or extra zero). */
export const PRICE_TOO_LOW = 0.4;
export const PRICE_TOO_HIGH = 2.5;
/** The same sale again within this long is probably a double send. */
export const DUPLICATE_WINDOW_MS = 3 * 60 * 1000;

function priceReasons(f: FlowCtx, items: ReadyItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    const usual = f.ctx.products.find((p) => p.id === it.productId)?.default_price ?? null;
    if (usual === null || usual <= 0) continue;
    const each = it.amount / it.quantity;
    if (each < usual * PRICE_TOO_LOW) {
      out.push(`${formatNaira(each)} each is much lower than ${it.productName}'s usual ${formatNaira(usual)}.`);
    } else if (each > usual * PRICE_TOO_HIGH) {
      out.push(`${formatNaira(each)} each is much higher than ${it.productName}'s usual ${formatNaira(usual)}.`);
    }
  }
  return out;
}

const key = (xs: Array<{ productId: string; quantity: number; amount: number }>) =>
  xs
    .map((x) => `${x.productId}:${x.quantity}:${x.amount}`)
    .sort()
    .join("|");

async function repeatReason(f: FlowCtx, items: ReadyItem[]): Promise<string | null> {
  try {
    const [last] = await recentSales(f.db, f.user.id, 1);
    if (!last || f.now.getTime() - last.createdAt.getTime() > DUPLICATE_WINDOW_MS) return null;
    return key(last.items) === key(items) ? "You recorded this exact sale a moment ago." : null;
  } catch {
    return null; // if the check cannot run, the sale itself will say if the database is down
  }
}

/** Takes the AI's reading of a sale as far as it can go: a question, a refusal, a check, or a saved sale. */
export async function handleSale(f: FlowCtx, draft: RecordSale, confirmed = false): Promise<Reply> {
  const v = validateSale(draft, { products: f.ctx.products, allowNegativeStock: f.ctx.allowNegativeStock });

  if (v.status === "reject") return { text: v.message, outcome: "rejected" };

  if (v.status === "ask") {
    if (v.need.kind === "split_total") {
      return {
        text: `I see one amount (${v.need.totalText}) for ${draft.items.length} items. Please send the sale again with an amount for each item, like: white paper 40k, gold border 18k.`,
        outcome: "asked",
      };
    }
    return { text: v.question, outcome: "asked", pending: { type: "sale", original: f.original, draft } };
  }

  if (!confirmed) {
    const reasons = priceReasons(f, v.items);
    const repeat = await repeatReason(f, v.items);
    if (repeat !== null) reasons.push(repeat);
    if (reasons.length > 0) {
      return {
        text: saleCheckPrompt(v.items, v.total, reasons),
        outcome: "confirm",
        pending: { type: "confirm_sale", original: f.original, draft },
      };
    }
  }

  f.trace.wrote = true;
  const r = await recordSale(f.db, {
    salespersonId: f.user.id,
    originalMessage: f.original,
    items: v.items.map(({ productId, quantity, amount }) => ({ productId, quantity, amount })),
    interpretedCommand: draft,
  });
  if (r.ok) return { text: saleRecorded(r), outcome: "recorded" };
  const problem = engineProblem(r.error, "sale");
  return { text: problem.text, outcome: problem.uncertain ? "error" : "rejected", note: `${r.error.code}: ${r.error.message}` };
}

/** The person answered a question about their sale. null = that was not an answer, so read it as a new message. */
export async function continueSale(f: FlowCtx, p: Extract<Pending, { type: "sale" }>, reply: string): Promise<Reply | null> {
  const v = validateSale(p.draft, { products: f.ctx.products, allowNegativeStock: f.ctx.allowNegativeStock });
  if (v.status !== "ask") return null;
  const a = answerSaleQuestion(p.draft, v.need, reply, f.ctx.products);
  if (a.kind === "none") return null;
  if (a.kind === "cancel") return { text: MSG.cancelled, outcome: "cancelled" };
  return handleSale({ ...f, original: p.original }, a.draft);
}

/** The person answered "please check this sale". Only a clear YES records it. */
export async function answerSaleCheck(f: FlowCtx, p: Extract<Pending, { type: "confirm_sale" }>, reply: string): Promise<Reply | null> {
  const yn = parseYesNo(reply);
  if (yn === null) return null;
  if (yn === "no") return { text: MSG.cancelled, outcome: "cancelled" };
  return handleSale({ ...f, original: p.original }, p.draft, true);
}
