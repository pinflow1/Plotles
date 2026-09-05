"use client";

import { ReactNode } from "react";
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react/suspense";

export function Room({ projectId, children }: { projectId: string; children: ReactNode }) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider id={`project:${projectId}`} initialPresence={{}}>
        <ClientSideSuspense fallback={<RoomLoading />}>{() => children}</ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function RoomLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="text-sm text-text-soft">Connecting…</div>
    </div>
  );
}
