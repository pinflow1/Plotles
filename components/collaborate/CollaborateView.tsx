"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { NavDrawer } from "@/components/navigation/NavDrawer";

type Tab = "writers" | "stories";
type Writer = { id: string; penName: string; avatarUrl: string | null; bio: string | null; genres: string[]; interests: string[] };
type DiscoverProject = {
  id: string;
  title: string;
  description: string | null;
  genres: string[];
  lookingFor: string | null;
  collaborationMode: "public" | "public_anonymous";
  participantCount: number;
  maxParticipants: number | null;
  alreadyRequested: boolean;
};

export function CollaborateView({ user }: { user: { penName: string; avatarUrl: string | null } }) {
  const [tab, setTab] = useState<Tab>("writers");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Writer[]>([]);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stories, setStories] = useState<DiscoverProject[] | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { users } = await api.get<{ users: Writer[] }>(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearched(true);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (tab !== "stories" || stories !== null) return;
    api
      .get<{ projects: DiscoverProject[] }>("/api/projects/discover")
      .then((r) => setStories(r.projects))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load open stories."));
  }, [tab, stories]);

  async function requestToJoin(projectId: string) {
    setRequesting(projectId);
    setError(null);
    try {
      await api.post(`/api/projects/${projectId}/request-to-join`, {});
      setStories((prev) => prev?.map((p) => (p.id === projectId ? { ...p, alreadyRequested: true } : p)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that request.");
    } finally {
      setRequesting(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">COLLABORATE</span>
        <div className="w-9" />
      </header>

      <div className="mx-auto max-w-lg px-5 pt-2">
        <div className="mb-5 flex gap-2">
          <button
            onClick={() => setTab("writers")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${tab === "writers" ? "bg-strong text-on-strong" : "bg-surface text-text-soft"}`}
          >
            Find Writers
          </button>
          <button
            onClick={() => setTab("stories")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${tab === "stories" ? "bg-strong text-on-strong" : "bg-surface text-text-soft"}`}
          >
            Find Stories
          </button>
        </div>

        {error && <p className="mb-3 px-1 text-sm text-text-soft">{error}</p>}

        {tab === "writers" ? (
          <div>
            <div className="relative mb-4">
              <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, genre, or interest"
                className="w-full rounded-xl border border-divider bg-transparent py-2.5 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-soft focus-visible:border-text"
              />
            </div>

            {query.trim().length < 2 ? (
              <p className="px-1 text-sm text-text-soft">Search for writers by pen name, genre, or interest — try “mystery” or “world building.”</p>
            ) : results.length === 0 && searched ? (
              <p className="px-1 text-sm text-text-soft">No writers found for “{query.trim()}.”</p>
            ) : (
              <div className="space-y-2">
                {results.map((w) => (
                  <div key={w.id} className="rounded-2xl bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={w.penName} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] text-text">{w.penName}</div>
                        {(w.genres.length > 0 || w.interests.length > 0) && (
                          <div className="truncate text-xs text-text-soft">
                            {[...w.genres, ...w.interests].slice(0, 4).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                    {w.bio && <p className="mt-2 text-sm text-text-soft">{w.bio}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : stories === null ? (
          <p className="px-1 text-sm text-text-soft">Loading…</p>
        ) : stories.length === 0 ? (
          <p className="px-1 text-sm text-text-soft">No open stories right now — check back later.</p>
        ) : (
          <div className="space-y-2">
            {stories.map((p) => (
              <div key={p.id} className="rounded-2xl bg-surface p-4">
                <div className="font-serif text-lg text-text">{p.title}</div>
                {p.genres.length > 0 && <div className="mt-0.5 text-xs text-text-soft">{p.genres.join(" · ")}</div>}
                {p.description && <p className="mt-2 text-sm text-text-soft">{p.description}</p>}
                {p.lookingFor && <p className="mt-2 text-sm text-text">Looking for: {p.lookingFor}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-text-soft">
                    {p.maxParticipants ? `${p.participantCount} / ${p.maxParticipants} collaborators` : `${p.participantCount} collaborator${p.participantCount === 1 ? "" : "s"}`}
                    {p.collaborationMode === "public_anonymous" && " · anonymous"}
                  </span>
                  <button
                    onClick={() => requestToJoin(p.id)}
                    disabled={p.alreadyRequested || requesting === p.id}
                    className="rounded-lg bg-strong px-3 py-1.5 text-xs font-semibold text-on-strong disabled:opacity-50"
                  >
                    {p.alreadyRequested ? "Requested" : requesting === p.id ? "Sending…" : "Request to Join"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={user} active="collaborate" />
    </div>
  );
}
