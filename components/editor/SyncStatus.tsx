"use client";

import { useStatus } from "@liveblocks/react/suspense";

// Liveblocks' Yjs sync already protects the writing itself (including
// while offline — offlineSupport_experimental is on in EditorView) — this
// just surfaces that state to the writer, quietly.
//
// "Saved" isn't a separate state here the way a traditional debounced-save
// architecture would have one: Yjs applies every edit to the local
// document instantly, before there's anything distinct to report. So this
// maps Liveblocks' room connection status to three states, not four —
// and stays silent for the default, good state so it doesn't add noise
// to the header on every normal keystroke.
export function SyncStatus() {
  const status = useStatus();

  if (status === "connected") return null;

  const label = status === "disconnected" ? "Offline · changes saved locally" : "Syncing…";

  return <span className="truncate text-[11px] text-text-soft/70">{label}</span>;
}
