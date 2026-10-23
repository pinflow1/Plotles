// Builds what the clerk needs from the server's settings (Vercel environment variables).
// It is a function, not a constant, so a missing setting becomes a clear message when a message
// arrives, instead of stopping the whole app from starting.
// SERVER ONLY: it uses the service-role key.

import { getServiceClient } from "../engine/engine";
import { createLLMProvider } from "../llm";
import type { Env } from "../llm";
import type { ClerkDeps } from "./types";

export function clerkDeps(env: Env = process.env): ClerkDeps {
  return { db: getServiceClient(), provider: createLLMProvider(env) };
}
