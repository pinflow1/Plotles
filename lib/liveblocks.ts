import { Liveblocks } from "@liveblocks/node";

// Was previously a hand-rolled fetch() straight to Liveblocks' REST API —
// switched to the official @liveblocks/node SDK, since that's what
// Liveblocks' own docs use and it's kept in sync with their backend
// (the room stuck permanently on "Connecting…" traced back to this).
//
// Checked lazily inside a function, not at module load — env vars aren't
// guaranteed to be present at build time on Vercel, only at request time,
// same reasoning as getSessionUserId()'s JWT_SECRET check in lib/auth.ts.
let client: Liveblocks | null = null;

export function getLiveblocksClient(): Liveblocks {
  if (client) return client;
  const secretKey = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secretKey) {
    throw new Error("LIVEBLOCKS_SECRET_KEY is not set. Copy .env.example to .env and set one.");
  }
  client = new Liveblocks({ secret: secretKey });
  return client;
}
