/*
 * Plotless service worker. Deliberately tiny, and it caches nothing.
 *
 * Its one job: when a page can't be shown (no connection, or the server answers
 * 404 or 5xx), show a friendly screen instead. Google Play's Android wrapper for
 * web apps counts those cases as a crash of the whole app, so they have to end
 * in a normal page. API calls, images, scripts and the editor's live connection
 * are never touched.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE = {
  title: "You’re offline",
  message: "Plotless needs a connection to open your stories. Check your network and try again.",
  retry: true,
};
const NOT_FOUND = {
  title: "Page not found",
  message: "We couldn't find that page. It may have been moved or deleted.",
  retry: false,
};
const SERVER_ERROR = {
  title: "Something went wrong",
  message: "That was our mistake, not yours. Please try again in a moment.",
  retry: true,
};

function screen(info) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${info.title} · Plotless</title>
<style>
  :root { color-scheme: light dark; --bg: #D8D2C4; --fg: #111111; --soft: #55524b; }
  @media (prefers-color-scheme: dark) { :root { --bg: #111111; --fg: #D8D2C4; --soft: #8E8E8E; } }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); font-family: Georgia, "Times New Roman", serif; }
  main { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; }
  .brand { font: 700 12px/1 system-ui, sans-serif; letter-spacing: 0.16em; margin-bottom: 2.5rem; }
  h1 { font-size: 1.6rem; font-weight: 500; margin: 0 0 0.75rem; }
  p { max-width: 22rem; margin: 0 0 2rem; line-height: 1.55; color: var(--soft); }
  .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }
  a, button { font: 600 14px/1 system-ui, sans-serif; padding: 0.9rem 1.4rem; border-radius: 12px; border: 1px solid var(--fg); background: transparent; color: var(--fg); text-decoration: none; cursor: pointer; }
  .primary { background: var(--fg); color: var(--bg); }
</style></head>
<body><main>
  <div class="brand">PLOTLESS</div>
  <h1>${info.title}</h1>
  <p>${info.message}</p>
  <div class="actions">
    ${info.retry ? '<button class="primary" onclick="location.reload()">Try again</button>' : ""}
    <a href="/"${info.retry ? "" : ' class="primary"'}>Back to Plotless</a>
  </div>
</main></body></html>`;
  // A normal 200 on purpose: that's what keeps the Android wrapper from treating it as a crash.
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function handleNavigation(request) {
  let response;
  try {
    response = await fetch(request);
  } catch (err) {
    return screen(OFFLINE);
  }
  // Redirects come back as "opaqueredirect" (status 0) and every healthy page is below 400;
  // both pass straight through.
  if (response.status === 404 || response.status === 410) return screen(NOT_FOUND);
  if (response.status >= 500) return screen(SERVER_ERROR);
  return response;
}

self.addEventListener("fetch", (event) => {
  // Pages only. Everything else (API calls, scripts, images, websockets) goes straight to the network.
  if (event.request.mode !== "navigate") return;
  event.respondWith(handleNavigation(event.request));
});
    
