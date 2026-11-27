"use client";

import { useCallback, useEffect, useRef } from "react";
import { BookOpen } from "lucide-react";
import type { Chapter, Project } from "@prisma/client";
import { formatWordCount } from "@/lib/format";
import { computePace } from "@/lib/pace";

export type CarouselProject = Project & { chapters: Chapter[] };

/** With more stories than this, the dots give way to a "3 / 12" counter. */
const MAX_DOTS = 8;

/**
 * The dashboard's "Continue Writing" card, one story per card. Swipe sideways
 * to pick which story you are about to write; the story that is showing is
 * reported through `onActiveChange` so the page can tint itself to match.
 *
 * It's a plain scroll-snap strip, so swiping, momentum and snapping are the
 * browser's own — no gesture code to get wrong on a phone.
 */
export function ContinueWritingCarousel({
  projects,
  activeId,
  onActiveChange,
  onContinue,
}: {
  projects: CarouselProject[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  onContinue: (projectId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const found = projects.findIndex((p) => p.id === activeId);
  const activeIndex = found < 0 ? 0 : found;
  const many = projects.length > 1;
  const idsKey = projects.map((p) => p.id).join("|");

  /** How far the strip has to be scrolled for slide `index` to sit at its left edge. */
  const offsetOf = useCallback((index: number): number | null => {
    const slides = scrollerRef.current?.children;
    const first = slides?.[0] as HTMLElement | undefined;
    const target = slides?.[index] as HTMLElement | undefined;
    return first && target ? target.offsetLeft - first.offsetLeft : null;
  }, []);

  const handleScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = scrollerRef.current;
      const count = el ? el.children.length : 0;
      if (!el || count < 2) return;
      const step = offsetOf(1);
      if (!step || step <= 0) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      const index = atEnd ? count - 1 : Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / step)));
      const next = projects[index];
      if (next) onActiveChange(next.id);
    });
  }, [offsetOf, projects, onActiveChange]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function scrollToIndex(index: number) {
    const el = scrollerRef.current;
    const left = offsetOf(index);
    if (el && left !== null) el.scrollTo({ left, behavior: "smooth" });
  }

  // If the list of stories changes under us (say, an invite was accepted), keep
  // the strip on the story that was showing instead of whatever slid into its place.
  useEffect(() => {
    const el = scrollerRef.current;
    const left = offsetOf(activeIndex);
    if (el && left !== null && Math.abs(el.scrollLeft - left) > 2) el.scrollTo({ left, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return (
    <section aria-roledescription="carousel" aria-label="Continue writing" className="mt-4">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scrollbar-hide"
      >
        {projects.map((p, i) => {
          const chapter = [...p.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
          const totalWords = p.chapters.reduce((sum, c) => sum + c.wordCount, 0);
          const pace = computePace(totalWords, p.goalWordCount, p.deadline);
          // Covers are big strings in the page, so only the showing story's
          // cover and its neighbours are drawn (snap-always means a swipe
          // moves one story at a time, so the next one is always ready).
          const drawCover = Math.abs(i - activeIndex) <= 1;

          return (
            <article
              key={p.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${projects.length}`}
              className={`${many ? "w-[92%]" : "w-full"} flex shrink-0 snap-start snap-always flex-col rounded-2xl bg-surface p-5`}
            >
              <div className="flex gap-4">
                <div className="relative h-[116px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-active shadow-[0_10px_24px_-8px_rgba(0,0,0,0.4)]">
                  {p.coverUrl ? (
                    drawCover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a data URL, not something next/image's optimizer can handle
                      <img src={p.coverUrl} alt="" draggable={false} className="h-full w-full object-cover" />
                    ) : null
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen size={24} strokeWidth={1.3} className="text-text-soft" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-[0.08em] text-text-soft">Continue Writing</div>
                  <div className="mt-2 line-clamp-2 break-words font-serif text-xl leading-snug text-text">{p.title}</div>
                  <div className="mt-0.5 truncate text-sm text-text-soft">{chapter ? chapter.title : "No chapters yet"}</div>
                  <div className="mt-0.5 text-xs text-text-soft">{formatWordCount(totalWords)}</div>
                </div>
              </div>

              {pace && (
                <div className="mt-3">
                  <div className="h-1 overflow-hidden rounded-full bg-active">
                    <div className="h-full rounded-full bg-strong" style={{ width: `${pace.progress * 100}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-text-soft">
                    {pace.wordsRemaining === 0
                      ? "Goal reached"
                      : pace.dailyTarget !== null
                        ? pace.overdue
                          ? `${pace.wordsRemaining.toLocaleString()} words left · past deadline`
                          : `${pace.dailyTarget.toLocaleString()} words/day to finish on time`
                        : `${pace.wordsRemaining.toLocaleString()} words to go`}
                  </div>
                </div>
              )}

              {/* Cards are as tall as the tallest one; the button sits at the bottom of each so it lines up. */}
              <div className="mt-auto pt-4">
                <button
                  onClick={() => onContinue(p.id)}
                  className="w-full rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong transition-opacity active:opacity-85"
                >
                  Continue writing
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {many &&
        (projects.length <= MAX_DOTS ? (
          <div className="mt-2 flex items-center justify-center">
            {projects.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => scrollToIndex(i)}
                aria-label={`Show ${p.title}`}
                aria-current={i === activeIndex ? "true" : undefined}
                className="px-1 py-2"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-5 bg-strong" : "w-1.5 bg-text-soft/40"
                  }`}
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-center text-xs text-text-soft">
            {activeIndex + 1} / {projects.length}
          </div>
        ))}
    </section>
  );
}
