"use client";

import { useOthers } from "@liveblocks/react/suspense";
import { Avatar } from "@/components/ui/Avatar";

// "Who else is here." Live carets/selections inside the manuscript are
// already handled automatically by useLiveblocksExtension (EditorView) —
// this is just the presence indicator, which Liveblocks doesn't add on its
// own. Hidden entirely when writing solo, which is most of the time.
export function PresenceAvatars() {
  const others = useOthers();
  if (others.length === 0) return null;

  const shown = others.slice(0, 3);
  const overflow = others.length - shown.length;
  const label = `${others.length} other ${others.length === 1 ? "person" : "people"} here`;

  return (
    <div className="flex items-center" aria-label={label} title={label}>
      {shown.map((o, i) => (
        <Avatar
          key={o.connectionId}
          name={(o.info as { name?: string } | undefined)?.name ?? "?"}
          size="sm"
          className={`ring-2 ring-paper ${i > 0 ? "-ml-2" : ""}`}
        />
      ))}
      {overflow > 0 && (
        <div className="-ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-medium text-text-soft ring-2 ring-paper">
          +{overflow}
        </div>
      )}
    </div>
  );
}
