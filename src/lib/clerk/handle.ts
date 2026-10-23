// The clerk: one message in, one reply out. It knows nothing about WhatsApp.
//   claim the message (so the same message is never handled twice)
//   -> who is this? -> are we waiting for an answer from them? -> if not, what does the AI say it is?
//   -> do it with the checked code (sales, undo, fix, questions) -> log how it ended.
// The AI only ever reads a message. Every decision about money and stock is made by plain code and
// the database. If anything breaks after a write may have started, the reply says it is not sure.

import { LLMError } from "../llm";
import type { ClerkResult, InboundMessage, Outcome } from "../messaging/types";
import { interpretMessage, todayInLagos } from "../nlp/prompt";
import { answerFix, answerUndo, startFix, startUndo } from "./fix-flow";
import { parsePending } from "./pending";
import type { Pending } from "./pending";
import { resumeQuery, runQuery } from "./query-flow";
import { helpText, MSG } from "./replies";
import { answerSaleCheck, continueSale, handleSale } from "./sale-flow";
import { claimInbound, finishInbound, findUser, loadContext, savePending, takePending } from "./store";
import type { ClerkUser } from "./store";
import { isGreeting, parseYesNo } from "./text";
import type { ClerkDeps, FlowCtx, Reply } from "./types";

const describe = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The person answered something we asked. null = it was not an answer, so it is a new message. */
function resume(f: FlowCtx, p: Pending, text: string): Promise<Reply | null> {
  switch (p.type) {
    case "sale":
      return continueSale(f, p, text);
    case "confirm_sale":
      return answerSaleCheck(f, p, text);
    case "confirm_undo":
      return answerUndo(f, p, text);
    case "confirm_fix":
      return answerFix(f, p, text);
    case "query":
      return resumeQuery(f, p, text);
  }
}

interface Ran {
  reply: Reply;
  /** What we understood, for the message log. */
  interpretation: unknown;
}

async function run(deps: ClerkDeps, o: { user: ClerkUser; text: string; now: Date; trace: { wrote: boolean } }): Promise<Ran> {
  const { user, text, now, trace } = o;
  if (text === "") return { reply: { text: helpText(user, false), outcome: "help" }, interpretation: { via: "empty" } };

  const ctx = await loadContext(deps.db);
  const f: FlowCtx = { db: deps.db, user, ctx, now, original: text, trace };

  const pending = parsePending(await takePending(deps.db, user.id));
  if (pending !== null) {
    const resumed = await resume(f, pending, text);
    if (resumed !== null) return { reply: resumed, interpretation: { via: "answer", to: pending.type } };
  } else if (parseYesNo(text) !== null) {
    // A "yes" or "no" with nothing waiting (or it ran out): never guess what it was for.
    return { reply: { text: MSG.nothingWaiting, outcome: "help" }, interpretation: { via: "nothing_waiting" } };
  }

  const read = await interpretMessage(deps.provider, text, { today: todayInLagos(now) });
  const i = read.interpretation;
  const interpretation = { reading: i, llm: read.llm };
  switch (i.intent) {
    case "record_sale":
      return { reply: await handleSale(f, i), interpretation };
    case "correct_sale":
      return { reply: await startFix(f, i), interpretation };
    case "undo_sale":
      return { reply: await startUndo(f, i), interpretation };
    case "query_stock":
    case "query_low_stock":
    case "query_restock_list":
    case "query_sales":
      return { reply: await runQuery(f, i), interpretation };
    case "update_restock":
      return { reply: { text: MSG.restockSoon, outcome: "rejected" }, interpretation };
    case "unknown":
      return { reply: { text: helpText(user, isGreeting(text)), outcome: "help" }, interpretation };
  }
}

/** Handles one message. Never throws: whatever happens, there is an honest reply to send (or none for a repeat). */
export async function handleMessage(deps: ClerkDeps, msg: InboundMessage): Promise<ClerkResult> {
  const now = (deps.now ?? (() => new Date()))();
  const result = (text: string | null, outcome: Outcome, rest: Partial<ClerkResult> = {}): ClerkResult => ({
    text,
    outcome,
    to: msg.sender,
    userId: null,
    inboundId: null,
    detail: null,
    ...rest,
  });

  let inboundId: string;
  try {
    const claim = await claimInbound(deps.db, msg);
    if (!claim.claimed) return result(null, "duplicate", { inboundId: claim.inboundId });
    inboundId = claim.inboundId;
  } catch (e) {
    return result(MSG.trouble, "error", { detail: describe(e) });
  }

  const trace = { wrote: false };
  let user: ClerkUser | null = null;
  let reply: Reply;
  let interpretation: unknown = null;
  let broke: string | null = null;
  try {
    user = await findUser(deps.db, msg.sender);
    if (user === null) {
      reply = { text: MSG.unknownSender, outcome: "unknown_sender" };
    } else if (msg.text === null) {
      reply = { text: MSG.notText, outcome: "not_text" };
    } else {
      const ran = await run(deps, { user, text: msg.text.trim(), now, trace });
      reply = ran.reply;
      interpretation = ran.interpretation;
      if (reply.pending) await savePending(deps.db, user.id, reply.pending);
    }
  } catch (e) {
    broke = describe(e);
    const text = e instanceof LLMError ? MSG.llmDown : trace.wrote ? MSG.unsure : MSG.trouble;
    reply = { text, outcome: "error", note: broke };
  }

  const note = reply.note ?? broke;
  try {
    await finishInbound(deps.db, {
      inboundId,
      userId: user?.id ?? null,
      status: reply.outcome === "error" ? "failed" : "done",
      outcome: reply.outcome,
      interpretation,
      reply: reply.text,
      error: note ?? null,
    });
  } catch {
    // The log is best effort: the reply must still go out, and a saved sale stays saved.
  }
  return result(reply.text, reply.outcome, {
    userId: user?.id ?? null,
    inboundId,
    detail: reply.outcome === "error" ? (note ?? null) : null,
  });
}
