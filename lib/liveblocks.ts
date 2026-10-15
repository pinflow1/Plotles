import { Liveblocks } from "@liveblocks/node";

// Official @liveblocks/node SDK, not a hand-rolled fetch() to their REST
// API — the earlier hand-rolled version caused the editor to hang forever
// on "Connecting…" instead of failing cleanly. This fix was briefly
// reverted along with everything else in a full checkpoint rollback and
// is reapplied here.
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
