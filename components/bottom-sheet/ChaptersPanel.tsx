"use client";

import { useState } from "react";
import { ChevronLeft, ChevronUp, ChevronDown, Plus, Trash2, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Chapter } from "@prisma/client";

export function ChaptersPanel({
  projectId,
  chapters,
  activeChapterId,
  canEdit,
  onChaptersChange,
  onSwitchChapter,
  onBack,
}: {
  projectId: string;
  chapters: Chapter[];
  activeChapterId: string;
  canEdit: boolean;
  onChaptersChange: (chapters: Chapter[]) => void;
  onSwitchChapter: (chapterId: string) => void;
  onBack: () => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function reorder(chapterId: string, dir: "up" | "down") {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      const { chapters: updated } = await api.patch<{ chapters: Chapter[] }>(
        `/api/projects/${projectId}/chapters/${chapterId}`,
        { reorder: dir }
      );
      onChaptersChange(updated);
    } finally {
      setBusy(false);
    }
  }

  async function rename(chapterId: string) {
    if (!draftTitle.trim()) return setRenamingId(null);
    const { chapter } = await api.patch<{ chapter: Chapter }>(`/api/projects/${projectId}/chapters/${chapterId}`, {
      title: draftTitle.trim(),
    });
    onChaptersChange(chapters.map((c) => (c.id === chapter.id ? chapter : c)));
    setRenamingId(null);
  }

  async function addChapter() {
    const { chapter } = await api.post<{ chapter: Chapter }>(`/api/projects/${projectId}/chapters`, {});
    onChaptersChange([...chapters, chapter]);
    onSwitchChapter(chapter.id);
  }

  function startRenaming(c: Chapter) {
    setRenamingId(c.id);
    setDraftTitle(c.title);
  }

  async function remove(chapterId: string) {
    if (chapters.length <= 1) return;
    if (!window.confirm("Delete this chapter? This can't be undone.")) return;
    await api.delete(`/api/projects/${projectId}/chapters/${chapterId}`);
    const remaining = chapters.filter((c) => c.id !== chapterId);
    onChaptersChange(remaining);
    if (chapterId === activeChapterId && remaining[0]) onSwitchChapter(remaining[0].id);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} aria-label="Back" className="rounded-lg p-1 text-text-soft active:bg-active">
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <span className="text-[15px] text-text">Chapters</span>
      </div>

      <div className="space-y-0.5">
        {chapters.map((c, i) => (
          <div
            key={c.id}
            className={`flex items-center gap-2 rounded-xl px-2 py-2 ${c.id === activeChapterId ? "bg-active" : ""}`}
          >
            {canEdit && (
              <div className="flex flex-col">
                <button onClick={() => reorder(c.id, "up")} disabled={i === 0} className="text-text-soft disabled:opacity-20">
                  <ChevronUp size={13} strokeWidth={2} />
                </button>
                <button onClick={() => reorder(c.id, "down")} disabled={i === chapters.length - 1} className="text-text-soft disabled:opacity-20">
                  <ChevronDown size={13} strokeWidth={2} />
                </button>
              </div>
            )}

            {renamingId === c.id ? (
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => rename(c.id)}
                onKeyDown={(e) => e.key === "Enter" && rename(c.id)}
                className="flex-1 rounded-lg border border-divider bg-transparent px-2 py-1 text-sm text-text outline-none"
              />
            ) : (
              <button
                onClick={() => (c.id === activeChapterId ? undefined : onSwitchChapter(c.id))}
                onDoubleClick={() => canEdit && startRenaming(c)}
                className="flex-1 truncate text-left text-sm text-text"
              >
                {c.title}
              </button>
            )}

            {c.id === activeChapterId && <Check size={14} strokeWidth={2} className="text-text-soft" />}
            {canEdit && chapters.length > 1 && (
              <button onClick={() => remove(c.id)} aria-label="Delete chapter" className="text-text-soft/60 active:text-text">
                <Trash2 size={14} strokeWidth={1.8} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <button onClick={addChapter} className="mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-sm text-text-soft active:bg-active">
          <Plus size={16} strokeWidth={1.8} />
          New chapter
        </button>
      )}
    </div>
  );
}
