"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Stepper } from "@/components/ui/Stepper";

type Mode = "solo" | "duo" | "anonymous_duo" | "multiple" | "public" | "public_anonymous" | "private" | "private_anonymous";
type Person = { id: string; penName: string; avatarUrl: string | null; bio: string | null; genres: string[] };

const MODE_INFO: { value: Mode; label: string; description: string }[] = [
  { value: "solo", label: "Write alone", description: "Just you." },
  { value: "duo", label: "Duo", description: "Write with one person you know." },
  { value: "anonymous_duo", label: "Anonymous Duo", description: "Write with one anonymous writer." },
  { value: "multiple", label: "Multiple Writers", description: "Choose how many people can participate." },
  { value: "public", label: "Public Collaboration", description: "Let writers discover and join." },
  { value: "public_anonymous", label: "Public Anonymous", description: "Let writers join anonymously." },
  { value: "private", label: "Private Collaboration", description: "Choose who can participate." },
  { value: "private_anonymous", label: "Private Anonymous", description: "Controlled participation, anonymous identities." },
];

// Modes where you pick specific people up front.
const PICKS_PEOPLE = (m: Mode) => m === "duo" || m === "private" || m === "private_anonymous";
// Modes where a total-participant cap makes sense (and is optional, except
// duo/anonymous_duo which are fixed at 2 and not shown here at all).
const HAS_CAP = (m: Mode) => m === "multiple" || m === "public" || m === "public_anonymous" || m === "private" || m === "private_anonymous";

export function CreateStoryView() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("solo");
  const [cap, setCap] = useState(5);
  const [useCap, setUseCap] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { users } = await api.get<{ users: Person[] }>(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(users.filter((u) => !picked.some((p) => p.id === u.id)));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function selectMode(m: Mode) {
    setMode(m);
    setPicked(m === "duo" ? picked.slice(0, 1) : picked);
    setUseCap(false);
  }

  function pick(person: Person) {
    if (mode === "duo") {
      setPicked([person]);
      setQuery("");
      setResults([]);
      return;
    }
    setPicked((prev) => [...prev, person]);
    setQuery("");
    setResults([]);
  }

  function unpick(id: string) {
    setPicked((prev) => prev.filter((p) => p.id !== id));
  }

  async function create() {
    if (!title.trim()) {
      setError("Give the story a title.");
      return;
    }
    if (mode === "duo" && picked.length !== 1) {
      setError("Pick one person to write with.");
      return;
    }
    if ((mode === "private" || mode === "private_anonymous") && picked.length === 0) {
      setError("Pick at least one person to start with.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const { project } = await api.post<{ project: { id: string } }>("/api/projects", {
        title: title.trim(),
        description: description.trim() || undefined,
        collaborationMode: mode,
        maxParticipants: HAS_CAP(mode) && useCap ? cap : undefined,
        participantUserIds: picked.map((p) => p.id),
      });
      router.push(`/editor/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that story.");
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => router.back()} aria-label="Back" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">NEW STORY</span>
        <div className="w-9" />
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-5 pt-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-soft">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Last Summer"
            className="mt-1.5 w-full border-b border-divider bg-transparent py-2 font-serif text-xl text-text outline-none placeholder:text-text-soft/60 focus-visible:border-text"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-soft">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="A couple of sentences about the story"
            className="mt-1.5 w-full resize-none rounded-lg bg-active px-3 py-2 text-sm text-text outline-none placeholder:text-text-soft"
          />
        </label>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-soft">How do you want to write?</div>
          <div className="overflow-hidden rounded-2xl bg-surface">
            {MODE_INFO.map((m, i) => (
              <button
                key={m.value}
                onClick={() => selectMode(m.value)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left ${i > 0 ? "border-t border-divider" : ""} ${mode === m.value ? "bg-active" : ""}`}
              >
                <span
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-[1.5px] ${mode === m.value ? "border-strong bg-strong" : "border-divider"}`}
                />
                <span>
                  <span className="block text-[15px] text-text">{m.label}</span>
                  <span className="block text-xs text-text-soft">{m.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {mode === "anonymous_duo" && (
          <p className="text-xs text-text-soft">
            Matching isn&rsquo;t built yet — this creates the story now, and you&rsquo;ll be able to add an anonymous partner once matching is ready.
          </p>
        )}

        {PICKS_PEOPLE(mode) && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-soft">
              {mode === "duo" ? "Who are you writing with?" : "Who can participate?"}
            </div>
            {picked.length > 0 && (
              <div className="mb-2 space-y-2">
                {picked.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
                    <Avatar name={p.penName} size="sm" />
                    <span className="flex-1 text-sm text-text">{p.penName}</span>
                    <button onClick={() => unpick(p.id)} aria-label="Remove" className="text-text-soft/60 active:text-text">
                      <X size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(mode !== "duo" || picked.length === 0) && (
              <div className="relative">
                <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-soft" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by pen name"
                  className="w-full rounded-lg border border-divider bg-transparent py-2 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-soft focus-visible:border-text"
                />
                {results.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-xl bg-surface p-1.5">
                    {results.map((u) => (
                      <button key={u.id} onClick={() => pick(u)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left active:bg-active">
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
          </div>
        )}

        {HAS_CAP(mode) && (
          <div>
            <label className="flex items-center justify-between py-1">
              <span className="text-[15px] text-text">Limit total writers</span>
              <input type="checkbox" checked={useCap} onChange={(e) => setUseCap(e.target.checked)} className="h-4 w-4 accent-[var(--strong)]" />
            </label>
            {useCap && (
              <div className="mt-1 flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                <span className="text-sm text-text-soft">Including you</span>
                <Stepper value={cap} onDecrease={() => setCap((v) => v - 1)} onIncrease={() => setCap((v) => v + 1)} min={Math.max(2, picked.length + 1)} max={50} />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-text-soft">{error}</p>}

        <button
          onClick={create}
          disabled={creating}
          className="w-full rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong transition-opacity active:opacity-85 disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create Story"}
        </button>
      </div>
    </div>
  );
}
