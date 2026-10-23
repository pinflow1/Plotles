// The test chat page talks to this address (see public/chat.html).
// It is switched off unless CHAT_PASSCODE is set. All the work is in src/lib/messaging/webhook.ts.

import { clerkDeps } from "../../../src/lib/clerk/runtime";
import { receiveChat } from "../../../src/lib/messaging/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return receiveChat(request, { env: process.env, clerk: () => clerkDeps(process.env) });
}
