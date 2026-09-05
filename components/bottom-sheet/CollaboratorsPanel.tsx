"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented } from "@/components/ui/Segmented";

type Collaborator = { role: "owner" | "edit" | "view"; user: { id: string; penName: string; email: string; avatarUrl: string | null } };

export function CollaboratorsPanel({ projectId, isOwner, onBack }: { projectId: string; isOwner: boolean; onBack?: () => void }) {
  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    api.get<{ collaborators: Collaborator[] }>(`/api/projects/${projectId}/collaborators`).then((r) => setCollaborators(r.collaborators));
  }, [projectId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      const { collaborator } = await api.post<{ collaborator: Collaborator }>(`/api/projects/${projectId}/collaborators`, {
        email,
        role: "edit",
      });
      setCollaborators((prev) => [...(prev ?? []).filter((c) => c.user.id !== collaborator.user.id), collaborator]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that invite.");
    } finally {
      setInviting(false);
    }
  }

  async function setRole(userId: string, role: "edit" | "view") {
    await api.patch(`/api/projects/${projectId}/collaborators/${userId}`, { role });
    setCollaborators((prev) => prev?.map((c) => (c.user.id === userId ? { ...c, role } : c)) ?? null);
  }

  async function remove(userId: string) {
    await api.delete(`/api/projects/${projectId}/collaborators/${userId}`);
    setCollaborators((prev) => prev?.filter((c) => c.user.id !== userId) ?? null);
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
        <form onSubmit={invite} className="mb-3 flex gap-2">
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
            Invite
          </button>
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
        {collaborators?.length === 0 && <p className="text-sm text-text-soft">No one else has access yet.</p>}
      </div>
    </div>
  );
}
