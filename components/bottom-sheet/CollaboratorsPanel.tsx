"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented } from "@/components/ui/Segmented";

type Collaborator = { role: "owner" | "edit" | "view"; user: { id: string; penName: string; email: string; avatarUrl: string | null } };
type PendingRequest = {
  id: string;
  role: "edit" | "view";
  message: string | null;
  createdAt: string;
  recipient: { id: string; penName: string; email: string; avatarUrl: string | null };
};

export function CollaboratorsPanel({ projectId, isOwner, onBack }: { projectId: string; isOwner: boolean; onBack?: () => void }) {
  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    api
      .get<{ collaborators: Collaborator[]; pendingRequests: PendingRequest[] }>(`/api/projects/${projectId}/collaborators`)
      .then((r) => {
        setCollaborators(r.collaborators);
        setPending(r.pendingRequests);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load collaborators."));
  }, [projectId]);

  // Sends a pending request, not instant access — it shows up here as
  // "Invited" until the recipient accepts it from their dashboard.
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      const { request } = await api.post<{ request: PendingRequest }>(`/api/projects/${projectId}/collaborators`, {
        email,
        role: "edit",
        message: message.trim() || undefined,
      });
      setPending((prev) => [request, ...prev]);
      setEmail("");
      setMessage("");
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
        <form onSubmit={invite} className="mb-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Invite by email"
              className="flex-1 rounded-lg border border-divider bg-transparent px-3 py-1.5 text-sm text-text outline-none focus-visible:border-text"
            />
            <button
              type="submit"
              disabled={inviting}
              className="rounded-lg bg-strong px-3 py-1.5 text-xs font-semibold text-on-strong disabled:opacity-60"
            >
              {inviting ? "Sending…" : "Invite"}
            </button>
          </div>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            maxLength={280}
            className="w-full rounded-lg border border-divider bg-transparent px-3 py-1.5 text-sm text-text outline-none placeholder:text-text-soft focus-visible:border-text"
          />
        </form>
      )}
      {error && <p className="mb-2 text-xs text-text-soft">{error}</p>}

      <div className="space-y-2">
        {collaborators?.map((c) => (
          <div key={c.user.id} className="flex items-center gap-3">
            <Avatar name={c.user.penName} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-text">{c.user.penName}</div>
              <div className="truncate text-xs text-text-soft">{c.user.email}</div>
            </div>
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
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text">{r.recipient.penName}</div>
                  <div className="truncate text-xs text-text-soft">{r.recipient.email}</div>
                </div>
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
