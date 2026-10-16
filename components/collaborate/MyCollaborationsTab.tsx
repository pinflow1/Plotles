"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { MODE_LABELS } from "@/lib/collaboration-modes";

type Collaboration = {
  id: string;
  title: string;
  genres: string[];
  mode: string;
  isOwner: boolean;
  participantCount: number;
  capacity: number | null;
  waiting: number;
  youAre: string | null;
};

function spots(c: Collaboration): string {
  return c.capacity
    ? `${c.participantCount} / ${c.capacity} spots filled`
    : `${c.participantCount} writer${c.participantCount === 1 ? "" : "s"}`;
}

export function MyCollaborationsTab({ onShowRequests }: { onShowRequests: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<Collaboration[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ collaborations: Collaboration[] }>("/api/collaborations")
      .then((r) => setItems(r.collaborations))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your collaborations."));
  }, []);

  if (!items) return <p className="px-1 text-sm text-text-soft">{error ?? "Loading…"}</p>;

  if (items.length === 0) {
    return (
      <p className="px-1 text-sm text-text-soft">
        You&rsquo;re not in any collaborations yet. Start one when you create a story, or join one from Find Stories.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((c) => (
        <div key={c.id} className="rounded-2xl bg-surface p-4">
          <div className="font-serif text-lg text-text">{c.title}</div>
          <div className="mt-0.5 text-xs text-text-soft">
            {MODE_LABELS[c.mode] ?? c.mode} · {c.isOwner ? "Owner" : "Collaborator"}
          </div>

          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-soft">Collaborators</div>
            <div className="mt-0.5 text-sm text-text">{spots(c)}</div>
            {c.youAre && <div className="mt-0.5 text-xs text-text-soft">You&rsquo;re {c.youAre} here</div>}
            {c.waiting > 0 && (
              <button onClick={onShowRequests} className="mt-1.5 text-xs font-medium text-text active:underline">
                {c.waiting} request{c.waiting === 1 ? "" : "s"} waiting →
              </button>
            )}
          </div>

          <button
            onClick={() => router.push(`/projects/${c.id}`)}
            className="mt-3 w-full rounded-xl bg-active py-2 text-sm font-medium text-text"
          >
            View collaboration
          </button>
        </div>
      ))}
    </div>
  );
}
