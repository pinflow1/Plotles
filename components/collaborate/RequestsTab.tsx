"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";

type RequestItem = {
  id: string;
  kind: "invite" | "join_request";
  role: "owner" | "edit" | "view";
  message: string | null;
  createdAt: string;
  anonymous: boolean;
  project: { id: string; title: string };
  person: { id: string; penName: string } | null;
};
type RequestsResponse = { incoming: RequestItem[]; sent: RequestItem[] };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 px-1 text-xs uppercase tracking-[0.08em] text-text-soft">{children}</div>;
}

export function RequestsTab({ onWaitingChange }: { onWaitingChange?: (n: number) => void }) {
  const router = useRouter();
  const [data, setData] = useState<RequestsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RequestsResponse>("/api/collaboration-requests")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your requests."));
  }, []);

  // Keep the badge on the Requests tab in step with what's actually listed.
  useEffect(() => {
    if (data) onWaitingChange?.(data.incoming.length);
  }, [data, onWaitingChange]);

  async function respond(item: RequestItem, status: "accepted" | "rejected") {
    setBusy(item.id);
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/api/collaboration-requests/${item.id}`, { status });
      setData((prev) => (prev ? { ...prev, incoming: prev.incoming.filter((r) => r.id !== item.id) } : prev));
      if (status === "accepted") {
        setNotice(
          item.kind === "invite"
            ? `You're in — “${item.project.title}” is now in My Collaborations.`
            : `Accepted — they're now part of “${item.project.title}”.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't respond to that request.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(item: RequestItem) {
    setBusy(item.id);
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/api/collaboration-requests/${item.id}`);
      setData((prev) => (prev ? { ...prev, sent: prev.sent.filter((r) => r.id !== item.id) } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel that request.");
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <p className="px-1 text-sm text-text-soft">{error ?? "Loading…"}</p>;

  return (
    <div>
      {notice && <p className="mb-3 px-1 text-sm text-text">{notice}</p>}
      {error && <p className="mb-3 px-1 text-sm text-text-soft">{error}</p>}

      <SectionLabel>Waiting on you</SectionLabel>
      {data.incoming.length === 0 ? (
        <p className="mb-6 px-1 text-sm text-text-soft">Nothing is waiting on you.</p>
      ) : (
        <div className="mb-6 space-y-2">
          {data.incoming.map((r) => {
            const person = r.person;
            return (
              <div key={r.id} className="rounded-2xl bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={person?.penName ?? "?"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">
                      {person ? (
                        <button onClick={() => router.push(`/collaborate/writers/${person.id}`)} className="font-medium active:underline">
                          {person.penName}
                        </button>
                      ) : (
                        <span className="font-medium">Someone</span>
                      )}{" "}
                      {r.kind === "join_request" ? "wants to join" : "invited you to collaborate on"}{" "}
                      <span className="font-medium">{r.project.title}</span>
                    </p>
                    {r.message && <p className="mt-1 text-sm text-text-soft">“{r.message}”</p>}
                    {r.anonymous && (
                      <p className="mt-1 text-xs text-text-soft">
                        {r.kind === "invite" ? "Anonymous story — you'd join as an Anonymous Writer." : "Anonymous story — they'd join as an Anonymous Writer."}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-text-soft">{timeAgo(r.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => respond(r, "rejected")}
                    disabled={busy === r.id}
                    className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text disabled:opacity-60"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => respond(r, "accepted")}
                    disabled={busy === r.id}
                    className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-semibold text-on-strong disabled:opacity-60"
                  >
                    {busy === r.id ? "Working…" : "Accept"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SectionLabel>Waiting on others</SectionLabel>
      {data.sent.length === 0 ? (
        <p className="px-1 text-sm text-text-soft">You haven&rsquo;t sent any requests that are still open.</p>
      ) : (
        <div className="space-y-2">
          {data.sent.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text">
                  {r.kind === "invite" ? "You invited " : "You asked to join "}
                  {r.kind === "invite" && <span className="font-medium">{r.person?.penName ?? "someone"}</span>}
                  {r.kind === "invite" && " to "}
                  <span className="font-medium">{r.project.title}</span>
                </p>
                <p className="mt-0.5 text-xs text-text-soft">
                  {r.kind === "invite" ? "Waiting for them to respond" : "Waiting for the owner to respond"} · {timeAgo(r.createdAt)}
                </p>
              </div>
              <button
                onClick={() => cancel(r)}
                disabled={busy === r.id}
                className="shrink-0 rounded-lg bg-active px-3 py-1.5 text-xs font-medium text-text disabled:opacity-60"
              >
                {busy === r.id ? "Cancelling…" : "Cancel"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
