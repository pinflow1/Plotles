"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, MoreHorizontal } from "lucide-react";
import type { Chapter, Project } from "@prisma/client";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";

type ProjectWithChapters = Project & { chapters: Chapter[]; role: "owner" | "edit" | "view" };

export function ProjectRow({
  project,
  onRenamed,
  onDeleted,
}: {
  project: ProjectWithChapters;
  onRenamed: (id: string, title: string) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const chapter = [...project.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const canEdit = project.role === "owner" || project.role === "edit";

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(project.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function commitRename() {
    setRenaming(false);
    const title = draftTitle.trim();
    if (!title || title === project.title) {
      setDraftTitle(project.title);
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/api/projects/${project.id}`, { title });
      onRenamed(project.id, title);
    } catch {
      setDraftTitle(project.title); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.delete(`/api/projects/${project.id}`);
      onDeleted(project.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl">
      <div className="flex items-center gap-3 px-2 py-2.5">
        <div className="flex h-[50px] w-[38px] shrink-0 items-center justify-center rounded-md bg-surface">
          <BookOpen size={16} strokeWidth={1.5} className="text-text-soft" />
        </div>

        {renaming ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => e.key === "Enter" && commitRename()}
            className="min-w-0 flex-1 rounded-lg border border-divider bg-transparent px-2 py-1 text-[15px] text-text outline-none"
          />
        ) : (
          <button onClick={() => router.push(`/editor/${project.id}`)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[15px] text-text">{project.title}</div>
            <div className="truncate text-xs text-text-soft">{chapter?.title ?? "No chapters yet"}</div>
          </button>
        )}

        <span className="shrink-0 text-xs text-text-soft">{timeAgo(project.updatedAt)}</span>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          disabled={busy}
          aria-label="Project options"
          className="shrink-0 rounded-lg p-1.5 text-text-soft active:bg-active disabled:opacity-40"
        >
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </button>
      </div>

      {menuOpen && !confirmingDelete && (
        <div className="flex gap-2 px-2 pb-2.5">
          {canEdit && (
            <button
              onClick={() => {
                setRenaming(true);
                setMenuOpen(false);
              }}
              className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text"
            >
              Rename
            </button>
          )}
          {project.role === "owner" && (
            <button onClick={() => setConfirmingDelete(true)} className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text">
              Delete
            </button>
          )}
        </div>
      )}

      {menuOpen && confirmingDelete && (
        <div className="px-2 pb-2.5">
          <p className="mb-2 text-xs text-text-soft">Delete “{project.title}”? This can&rsquo;t be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmingDelete(false);
                setMenuOpen(false);
              }}
              className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text"
            >
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={busy} className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-semibold text-on-strong disabled:opacity-60">
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
