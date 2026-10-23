// The address Meta calls: https://<your-site>/api/whatsapp
//   GET   Meta checks it once, when you save the webhook
//   POST  every message people send to the shop's WhatsApp number
// All the work is in src/lib/messaging/webhook.ts.

import { clerkDeps } from "../../../src/lib/clerk/runtime";
import { receiveWebhook, verifyChallenge } from "../../../src/lib/messaging/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  return verifyChallenge(request.url, process.env);
}

export async function POST(request: Request): Promise<Response> {
  return receiveWebhook(request, { env: process.env, clerk: () => clerkDeps(process.env) });
}
