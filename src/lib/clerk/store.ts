// How the clerk talks to the database for everything that is not a sale or a report: who is this
// number, what products exist, the question we are waiting on, the log of messages.
// Every call is a Postgres function (supabase/migrations/004_messaging.sql) and every reply is
// checked before it is used. A reply that cannot be read is an error, never a guess.
// SERVER ONLY: it uses the service-role client.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboundMessage } from "../messaging/types";
import type { SaleProduct } from "../nlp/validate-sale";

export class StoreError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const bad = (fn: string, what: string) => new StoreError("BAD_REPLY", `${fn}: ${what}`);

async function call(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<Obj> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new StoreError("DB_ERROR", `${fn}: ${error.message}`);
  if (!isObj(data)) throw bad(fn, "the reply could not be read");
  if (data.ok !== true) {
    const e = isObj(data.error) ? data.error : {};
    const code = typeof e.code === "string" ? e.code : "REFUSED";
    throw new StoreError(code, `${fn}: ${typeof e.message === "string" ? e.message : "refused"}`);
  }
  return data;
}

const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ---------- one message, handled once ----------

export async function claimInbound(db: SupabaseClient, m: InboundMessage): Promise<{ claimed: boolean; inboundId: string }> {
  const r = await call(db, "claim_inbound", {
    p_channel: m.channel,
    p_provider_message_id: m.messageId,
    p_sender: m.sender,
    p_body: m.text,
  });
  if (typeof r.claimed !== "boolean" || typeof r.inbound_id !== "string") throw bad("claim_inbound", "unexpected reply");
  return { claimed: r.claimed, inboundId: r.inbound_id };
}

export async function finishInbound(
  db: SupabaseClient,
  o: {
    inboundId: string;
    userId: string | null;
    status: "done" | "failed";
    outcome: string;
    interpretation: unknown;
    reply: string | null;
    error: string | null;
  },
): Promise<void> {
  await call(db, "finish_inbound", {
    p_inbound_id: o.inboundId,
    p_user_id: o.userId,
    p_status: o.status,
    p_outcome: o.outcome,
    p_interpretation: o.interpretation ?? null,
    p_reply: o.reply,
    p_error: o.error,
  });
}

// ---------- who is this ----------

export interface ClerkUser {
  id: string;
  name: string;
  phone: string;
  role: "staff" | "admin";
}

/** null = the number is not on the team (or the person has been switched off). */
export async function findUser(db: SupabaseClient, sender: string): Promise<ClerkUser | null> {
  const r = await call(db, "user_by_phone", { p_phone: sender });
  if (r.found === false) return null;
  const u = r.user;
  if (r.found !== true || !isObj(u)) throw bad("user_by_phone", "unexpected reply");
  const id = text(u.id);
  const name = text(u.name);
  const phone = text(u.phone);
  if (id === null || name === null || phone === null || (u.role !== "staff" && u.role !== "admin")) {
    throw bad("user_by_phone", "the user could not be read");
  }
  return { id, name, phone, role: u.role };
}

// ---------- what exists ----------

export interface ContextProduct extends SaleProduct {
  /** Price of one piece in naira. null = none set. */
  default_price: number | null;
}

export interface ClerkContext {
  products: ContextProduct[];
  staff: Array<{ id: string; name: string; role: "staff" | "admin" }>;
  allowNegativeStock: boolean;
}

function contextProduct(x: unknown): ContextProduct | null {
  if (!isObj(x)) return null;
  const id = text(x.id);
  const name = text(x.name);
  const stock = num(x.current_stock);
  const price = x.default_price === null ? null : num(x.default_price);
  if (id === null || name === null || stock === null || !Number.isInteger(stock)) return null;
  if (x.default_price !== null && price === null) return null;
  if (!Array.isArray(x.aliases) || !x.aliases.every((a) => typeof a === "string")) return null;
  return { id, name, current_stock: stock, default_price: price, aliases: x.aliases as string[] };
}

export async function loadContext(db: SupabaseClient): Promise<ClerkContext> {
  const r = await call(db, "clerk_context", {});
  if (!Array.isArray(r.products) || !Array.isArray(r.staff) || typeof r.allow_negative_stock !== "boolean") {
    throw bad("clerk_context", "unexpected reply");
  }
  const products: ContextProduct[] = [];
  for (const p of r.products) {
    const parsed = contextProduct(p);
    if (parsed === null) throw bad("clerk_context", "a product could not be read");
    products.push(parsed);
  }
  const staff: ClerkContext["staff"] = [];
  for (const s of r.staff) {
    const o = isObj(s) ? s : {};
    const id = text(o.id);
    const name = text(o.name);
    if (id === null || name === null || (o.role !== "staff" && o.role !== "admin")) throw bad("clerk_context", "a person could not be read");
    staff.push({ id, name, role: o.role });
  }
  return { products, staff, allowNegativeStock: r.allow_negative_stock };
}

// ---------- the question we are waiting on ----------

/** The stored question, or null if there is none (or it ran out). Taking it removes it. */
export async function takePending(db: SupabaseClient, userId: string): Promise<unknown> {
  const r = await call(db, "take_pending", { p_user_id: userId });
  return r.pending ?? null;
}

export async function savePending(db: SupabaseClient, userId: string, state: unknown): Promise<void> {
  await call(db, "save_pending", { p_user_id: userId, p_state: state });
}

// ---------- recent sales ----------

export interface PastItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  amount: number;
}

export interface PastSale {
  id: string;
  salespersonId: string;
  salespersonName: string;
  totalAmount: number;
  originalMessage: string;
  createdAt: Date;
  items: PastItem[];
}

function pastItem(x: unknown): PastItem | null {
  if (!isObj(x)) return null;
  const id = text(x.id);
  const productId = text(x.product_id);
  const productName = text(x.product_name);
  const quantity = num(x.quantity);
  const amount = num(x.amount);
  if (id === null || productId === null || productName === null || quantity === null || amount === null) return null;
  return { id, productId, productName, quantity, amount };
}

function pastSale(x: unknown): PastSale | null {
  if (!isObj(x) || !Array.isArray(x.items) || x.items.length === 0) return null;
  const id = text(x.id);
  const salespersonId = text(x.salesperson_id);
  const salespersonName = text(x.salesperson_name);
  const totalAmount = num(x.total_amount);
  const originalMessage = text(x.original_message);
  const created = text(x.created_at);
  const createdAt = created === null ? null : new Date(created);
  if (id === null || salespersonId === null || salespersonName === null || totalAmount === null) return null;
  if (originalMessage === null || createdAt === null || Number.isNaN(createdAt.getTime())) return null;
  const items: PastItem[] = [];
  for (const i of x.items) {
    const parsed = pastItem(i);
    if (parsed === null) return null;
    items.push(parsed);
  }
  return { id, salespersonId, salespersonName, totalAmount, originalMessage, createdAt, items };
}

/** Live (not undone) sales, newest first. userId null = everyone's. */
export async function recentSales(db: SupabaseClient, userId: string | null, limit: number): Promise<PastSale[]> {
  const r = await call(db, "recent_sales", { p_user_id: userId, p_limit: limit });
  if (!Array.isArray(r.sales)) throw bad("recent_sales", "unexpected reply");
  const out: PastSale[] = [];
  for (const s of r.sales) {
    const parsed = pastSale(s);
    if (parsed === null) throw bad("recent_sales", "a sale could not be read");
    out.push(parsed);
  }
  return out;
}

// ---------- what we sent ----------

export async function logOutbound(
  db: SupabaseClient,
  o: {
    channel: string;
    recipient: string;
    userId: string | null;
    inboundId: string | null;
    body: string;
    status: "sent" | "failed" | "skipped";
    providerMessageId: string | null;
    error: string | null;
  },
): Promise<void> {
  await call(db, "log_outbound", {
    p_channel: o.channel,
    p_recipient: o.recipient,
    p_user_id: o.userId,
    p_inbound_id: o.inboundId,
    p_body: o.body,
    p_status: o.status,
    p_provider_message_id: o.providerMessageId,
    p_error: o.error,
  });
}
