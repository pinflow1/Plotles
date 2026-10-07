"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";

type Writer = { id: string; penName: string; avatarUrl: string | null; bio: string | null; genres: string[]; interests: string[] };
type InvitableProject = { id: string; title: string; collaborationMode: string };

export function WriterProfileView({ userId }: { userId: string }) {
  const router = useRouter();
  const [writer, setWriter] = useState<Writer | null>(null);
  const [projects, setProjects] = useState<InvitableProject[] | null>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ user: Writer }>(`/api/users/${userId}`)
      .then((r) => setWriter(r.user))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load that profile."));
    api
      .get<{ projects: InvitableProject[] }>("/api/projects/invitable")
      .then((r) => {
        setProjects(r.projects);
        if (r.projects.length > 0) setSelectedProject(r.projects[0].id);
      })
      .catch(() => setProjects([]));
  }, [userId]);

  async function invite() {
    if (!selectedProject) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/api/projects/${selectedProject}/collaborators`, { userId, role: "edit" });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that invite.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => router.back()} aria-label="Back" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">WRITER</span>
      </header>

      {!writer ? (
        error ? <p className="px-5 text-sm text-text-soft">{error}</p> : <p className="px-5 text-sm text-text-soft">Loading…</p>
      ) : (
        <div className="mx-auto max-w-lg px-5 pt-2">
          <div className="flex items-center gap-4">
            <Avatar name={writer.penName} size="lg" />
            <div className="font-serif text-2xl text-text">{writer.penName}</div>
          </div>

          {writer.bio && <p className="mt-4 text-sm text-text-soft">{writer.bio}</p>}

          {writer.genres.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-soft">Genres</div>
              <div className="flex flex-wrap gap-1.5">
                {writer.genres.map((g) => (
                  <span key={g} className="rounded-full bg-surface px-3 py-1 text-xs text-text">{g}</span>
                ))}
              </div>
            </div>
          )}

          {writer.interests.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-soft">Interested in</div>
              <div className="flex flex-wrap gap-1.5">
                {writer.interests.map((i) => (
                  <span key={i} className="rounded-full bg-surface px-3 py-1 text-xs text-text">{i}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-2xl bg-surface p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-soft">Invite to a story</div>
            {sent ? (
              <p className="text-sm text-text-soft">Invite sent — {writer.penName} will see it on their Dashboard.</p>
            ) : projects === null ? (
              <p className="text-sm text-text-soft">Loading your stories…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-text-soft">None of your stories can take another collaborator right now.</p>
            ) : (
              <>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full rounded-lg border border-divider bg-transparent px-3 py-2 text-sm text-text outline-none focus-visible:border-text"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                {error && <p className="mt-2 text-xs text-text-soft">{error}</p>}
                <button
                  onClick={invite}
                  disabled={sending}
                  className="mt-3 w-full rounded-xl bg-strong py-2.5 text-sm font-semibold text-on-strong disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send Invite"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
  }
                    
