"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented } from "@/components/ui/Segmented";

type Collaborator = { role: "owner" | "edit" | "view"; user: { id: string; penName: string; avatarUrl: string | null } };
type PendingRequest = {
  id: string;
  role: "edit" | "view";
  message: string | null;
  createdAt: string;
  recipient: { id: string; penName: string; avatarUrl: string | null };
};
type Person = { id: string; penName: string; avatarUrl: string | null; bio: string | null; genres: string[] };

export function CollaboratorsPanel({ projectId, isOwner, onBack }: { projectId: string; isOwner: boolean; onBack?: () => void }) {
  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .get<{ collaborators: Collaborator[]; pendingRequests: PendingRequest[] }>(`/api/projects/${projectId}/collaborators`)
      .then((r) => {
        setCollaborators(r.collaborators);
        setPending(r.pendingRequests);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load collaborators."));
  }, [projectId]);

  // Search by pen name — no email involved anywhere in this flow.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { users } = await api.get<{ users: Person[] }>(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(users);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function invite(person: Person) {
    setError(null);
    setInviting(true);
    setQuery("");
    setResults([]);
    try {
      const { request } = await api.post<{ request: PendingRequest }>(`/api/projects/${projectId}/collaborators`, {
        userId: person.id,
        role: "edit",
      });
      setPending((prev) => [request, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that invite.");
    } finally {
      setInviting(false);
    }
  }

  async function cancelInvite(requestId: string) {
    try {
      await api.delete(`/api/collaboration-requests/${requestId}`);
      setPending((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel that invite.");
    }
  }

  async function setRole(userId: string, role: "edit" | "view") {
    try {
      await api.patch(`/api/projects/${projectId}/collaborators/${userId}`, { role });
      setCollaborators((prev) => prev?.map((c) => (c.user.id === userId ? { ...c, role } : c)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that collaborator's access.");
    }
  }

  async function remove(userId: string) {
    try {
      await api.delete(`/api/projects/${projectId}/collaborators/${userId}`);
      setCollaborators((prev) => prev?.filter((c) => c.user.id !== userId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that collaborator.");
    }
  }

  return (
    <div>
      {onBack && (
        <div className="mb-3 flex items-center gap-2">
          <button onClick={onBack} aria-label="Back" className="rounded-lg p-1 text-text-soft active:bg-active">
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <span className="text-[15px] text-text">Collaborators</span>
        </div>
      )}

      {isOwner && (
        <div className="relative mb-3">
          <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by pen name"
            disabled={inviting}
            className="w-full rounded-lg border border-divider bg-transparent py-2 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-soft focus-visible:border-text disabled:opacity-60"
          />
          {results.length > 0 && (
            <div className="mt-2 space-y-1 rounded-xl bg-surface p-1.5">
              {results.map((u) => (
                <button key={u.id} onClick={() => invite(u)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left active:bg-active">
                  <Avatar name={u.penName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text">{u.penName}</span>
                    {u.genres.length > 0 && <span className="block truncate text-xs text-text-soft">{u.genres.join(", ")}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="mb-2 text-xs text-text-soft">{error}</p>}

      <div className="space-y-2">
        {collaborators?.map((c) => (
          <div key={c.user.id} className="flex items-center gap-3">
            <Avatar name={c.user.penName} size="sm" />
            <div className="min-w-0 flex-1 truncate text-sm text-text">{c.user.penName}</div>
            {c.role === "owner" ? (
              <span className="text-xs text-text-soft">Owner</span>
            ) : isOwner ? (
              <div className="flex items-center gap-1.5">
                <Segmented
                  value={c.role}
                  onChange={(v: "edit" | "view") => setRole(c.user.id, v)}
                  options={[
                    { value: "edit", label: "Edit" },
                    { value: "view", label: "View" },
                  ]}
                />
                <button onClick={() => remove(c.user.id)} aria-label="Remove collaborator" className="text-text-soft/60 active:text-text">
                  <X size={14} strokeWidth={1.8} />
                </button>
              </div>
            ) : (
              <span className="text-xs capitalize text-text-soft">{c.role}</span>
            )}
          </div>
        ))}
        {collaborators?.length === 0 && pending.length === 0 && <p className="text-sm text-text-soft">No one else has access yet.</p>}
      </div>

      {pending.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.06em] text-text-soft">Invited · waiting to respond</div>
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <Avatar name={r.recipient.penName} size="sm" />
                <div className="min-w-0 flex-1 truncate text-sm text-text">{r.recipient.penName}</div>
                <span className="text-xs capitalize text-text-soft">{r.role}</span>
                {isOwner && (
                  <button onClick={() => cancelInvite(r.id)} aria-label="Cancel invite" className="text-text-soft/60 active:text-text">
                    <X size={14} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
                                           }
    
