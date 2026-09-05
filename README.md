# Plotless

A mobile-first collaborative writing app. Next.js 14 (App Router) end to end —
one project, frontend and backend together via Route Handlers.

## Setup

```bash
npm install
cp .env.example .env        # then fill in the three values below
npx prisma db push          # creates the tables in your Postgres database
npm run dev
```

You'll need, in `.env`:

- `DATABASE_URL` — a Postgres connection string. Any Postgres works
  (local via `postgres.app`/Docker, or a hosted one — Render, Supabase,
  Neon all have a free tier with a connection string you can paste in).
- `JWT_SECRET` — any long random string. `openssl rand -base64 48` works.
- `LIVEBLOCKS_SECRET_KEY` — from your Liveblocks dashboard → API keys →
  Secret key. Free tier is enough to develop against.

## Things to verify before relying on this

**Multi-chapter Liveblocks rooms.** Rooms are namespaced `project:<id>`
(one room per project, per the brief), and each chapter is meant to be an
independent document within that room. `EditorView` passes
`useLiveblocksExtension({ field: activeChapterId })` to give each chapter
its own Yjs field inside the shared room. This is my best understanding of
`@liveblocks/react-tiptap`'s current API for multi-document rooms, but it
was not checked against Liveblocks' live docs — no network access in the
sandbox this was built in. Worth confirming first: if `field` isn't the
right option, every chapter in a project would land in the same document
instead of staying independent.

**Chapter navigation doesn't have its own URL.** The editor route is
`/editor/[projectId]` only, matching the brief's folder structure — which
chapter is open lives in client state, not the URL. You can't deep-link to
a specific chapter, and switching chapters via the Chapters panel doesn't
show up in browser history.

**"Returns to the editor without reloading it."** Next.js App Router
unmounts the editor page when you navigate to Dashboard or Settings and
remounts it when you come back — there's no built-in way to keep a route
alive across navigation the way the earlier HTML prototype (a single
static file) could. Two mitigations are in here: content is never at risk,
since Liveblocks/Yjs is the source of truth and resyncs on remount either
way; and scroll position + selection are cached in a root-level provider
(`lib/session-cache.tsx`) that Next.js doesn't tear down, so they survive
the round trip. The one truly reload-free path is the drawer's "Current
Chapter" item when you're already on that chapter — that just closes the
drawer with no navigation at all. Getting the Dashboard/Settings round
trip to feel identical to the prototype would mean fighting the App
Router's routing model (parallel routes, or keeping the editor mounted in
a persistent shell) — a bigger change than seemed right to make silently.

## Stubbed for V1 (inert UI, per the brief)

- **Cover** and **Export** — rows are present and visibly disabled.
- **Insert → Link** and **Insert → Image** — need
  `@tiptap/extension-link` and `@tiptap/extension-image`, which aren't in
  the brief's dependency list, so nothing was added silently.
- **Insert → Note** — no spec yet for what it should do (a personal
  margin note? something else?).
- Chapter delete uses a native `confirm()` rather than a custom dialog —
  the brief only asked for a custom confirm step on **Delete Project**.

## Assumptions worth a second look

- The Format group's single "H" chip toggles Heading level 2.
- The second serif choice (Quick Tools' font picker) is Source Serif 4,
  taken from the uploaded prototype's own `--serif-classic` variable.
- Text Color swatches are hardcoded per theme (Charcoal/Deep
  Black/Gray in light mode, Clay White/Casper/Gray in dark) — Casper and
  Charcoal are each dropped in the mode where they're too close to that
  mode's background to read as text, matching the prototype's own
  `data-theme` swatch filtering.
