"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api-client";

type Story = {
  id: string;
  title: string;
  description: string | null;
  genres: string[];
  lookingFor: string | null;
  anonymous: boolean;
  participantCount: number;
  maxParticipants: number | null;
  full: boolean;
  excerpt: string | null;
  isMember: boolean;
  alreadyRequested: boolean;
};

export function StoryPreviewView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ story: Story }>(`/api/projects/${projectId}/preview`)
      .then((r) => setStory(r.story))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load that story."));
  }, [projectId]);

  async function requestToJoin() {
    setRequesting(true);
    setError(null);
    try {
      await api.post(`/api/projects/${projectId}/request-to-join`, {});
      setStory((prev) => (prev ? { ...prev, alreadyRequested: true } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that request.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => router.back()} aria-label="Back" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">STORY</span>
      </header>

      {!story ? (
        <p className="px-5 text-sm text-text-soft">{error ?? "Loading…"}</p>
      ) : (
        <div className="mx-auto max-w-lg px-5 pt-2">
          <h1 className="font-serif text-2xl text-text">{story.title}</h1>
          {story.genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {story.genres.map((g) => (
                <span key={g} className="rounded-full bg-surface px-3 py-1 text-xs text-text">
                  {g}
                </span>
              ))}
            </div>
          )}
          {story.description && <p className="mt-4 text-sm text-text-soft">{story.description}</p>}

          {story.lookingFor && (
            <div className="mt-5">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-soft">Looking for</div>
              <p className="text-sm text-text">{story.lookingFor}</p>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-soft">Collaboration</div>
            <p className="text-sm text-text">
              {story.maxParticipants
                ? `${story.participantCount} / ${story.maxParticipants} collaborators`
                : `${story.participantCount} collaborator${story.participantCount === 1 ? "" : "s"}`}
            </p>
            {story.anonymous && (
              <p className="mt-0.5 text-sm text-text-soft">Participants write anonymously — you&rsquo;d join as an Anonymous Writer.</p>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-soft">Excerpt</div>
            {story.excerpt ? (
              <div className="rounded-2xl bg-surface p-4">
                <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-text">{story.excerpt}</p>
                <p className="mt-3 text-xs text-text-soft">Chosen by the author. The rest of the story stays private until you join.</p>
              </div>
            ) : (
              <p className="text-sm text-text-soft">The author hasn&rsquo;t shared an excerpt. The story stays private until you join.</p>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-text-soft">{error}</p>}

          <div className="mt-8">
            {story.isMember ? (
              <button
                onClick={() => router.push(`/projects/${story.id}`)}
                className="w-full rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong"
              >
                Open story
              </button>
            ) : (
              <button
                onClick={requestToJoin}
                disabled={story.alreadyRequested || story.full || requesting}
                className="w-full rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong disabled:opacity-50"
              >
                {story.alreadyRequested ? "Requested" : story.full ? "This story is full" : requesting ? "Sending…" : "Request to Join"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
