"use client";

import { useEffect } from "react";

// Registers the tiny service worker in /public/sw.js. Production only, so it
// never gets in the way while developing.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
