"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, MoreHorizontal } from "lucide-react";
import type { Chapter, Project, ProjectStatus } from "@prisma/client";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { computePace } from "@/lib/pace";

type ProjectWithChapters = Project & { chapters: Chapter[]; role: "owner" | "edit" | "view" };
type Panel = "menu" | "rename" | "status" | "goal" | "delete" | null;

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  drafting: "Drafting",
  revising: "Revising",
  complete: "Complete",
};

function toDateInputValue(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function ProjectRow({
  project,
  onUpdated,
  onDeleted,
}: {
  project: ProjectWithChapters;
  onUpdated: (id: string, patch: Partial<ProjectWithChapters>) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const chapter = [...project.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const canEdit = project.role === "owner" || project.role === "edit";
  const totalWords = project.chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const pace = computePace(totalWords, project.goalWordCount, project.deadline);

  const [panel, setPanel] = useState<Panel>(null);
  const [draftTitle, setDraftTitle] = useState(project.title);
  const [draftGoal, setDraftGoal] = useState(project.goalWordCount ? String(project.goalWordCount) : "");
  const [draftDeadline, setDraftDeadline] = useState(toDateInputValue(project.deadline));
  const [busy, setBusy] = useState(false);

  function close() {
    setPanel(null);
  }

  async function commitRename() {
    const title = draftTitle.trim();
    close();
    if (!title || title === project.title) {
      setDraftTitle(project.title);
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/api/projects/${project.id}`, { title });
      onUpdated(project.id, { title });
    } catch {
      setDraftTitle(project.title);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: ProjectStatus) {
    close();
    setBusy(true);
    try {
      await api.patch(`/api/projects/${project.id}`, { status });
      onUpdated(project.id, { status });
    } finally {
      setBusy(false);
    }
  }

  async function commitGoal() {
    const goalWordCount = draftGoal.trim() ? Math.max(0, parseInt(draftGoal, 10)) : null;
    const deadline = draftDeadline || null;
    close();
    setBusy(true);
    try {
      await api.patch(`/api/projects/${project.id}`, { goalWordCount, deadline });
      onUpdated(project.id, { goalWordCount, deadline: deadline ? new Date(deadline) : null });
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

        {panel === "rename" ? (
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
            <div className="truncate text-xs text-text-soft">
              {chapter?.title ?? "No chapters yet"} · {STATUS_LABELS[project.status]}
            </div>
          </button>
        )}

        <span className="shrink-0 text-xs text-text-soft">{timeAgo(project.updatedAt)}</span>
        <button
          onClick={() => setPanel(panel ? null : "menu")}
          disabled={busy}
          aria-label="Project options"
          className="shrink-0 rounded-lg p-1.5 text-text-soft active:bg-active disabled:opacity-40"
        >
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </button>
      </div>

      {pace && (
        <div className="px-2 pb-1.5">
          <div className="h-1 overflow-hidden rounded-full bg-active">
            <div className="h-full rounded-full bg-strong" style={{ width: `${pace.progress * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-text-soft">
            {pace.wordsRemaining === 0
              ? "Goal reached"
              : pace.dailyTarget !== null
                ? pace.overdue
                  ? `${pace.wordsRemaining.toLocaleString()} words left · past deadline`
                  : `${pace.dailyTarget.toLocaleString()}/day to finish on time`
                : `${pace.wordsRemaining.toLocaleString()} words to go`}
          </div>
        </div>
      )}

      {panel === "menu" && (
        <div className="flex flex-wrap gap-2 px-2 pb-2.5">
          {canEdit && (
            <button onClick={() => setPanel("rename")} className="rounded-lg bg-active px-3 py-1.5 text-xs font-medium text-text">
              Rename
            </button>
          )}
          {canEdit && (
            <button onClick={() => setPanel("status")} className="rounded-lg bg-active px-3 py-1.5 text-xs font-medium text-text">
              Status
            </button>
          )}
          {canEdit && (
            <button onClick={() => setPanel("goal")} className="rounded-lg bg-active px-3 py-1.5 text-xs font-medium text-text">
              Goal
            </button>
          )}
          {project.role === "owner" && (
            <button onClick={() => setPanel("delete")} className="rounded-lg bg-active px-3 py-1.5 text-xs font-medium text-text">
              Delete
            </button>
          )}
        </div>
      )}

      {panel === "status" && (
        <div className="flex flex-wrap gap-2 px-2 pb-2.5">
          {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${s === project.status ? "bg-strong text-on-strong" : "bg-active text-text"}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {panel === "goal" && (
        <div className="space-y-2 px-2 pb-2.5">
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={draftGoal}
              onChange={(e) => setDraftGoal(e.target.value)}
              placeholder="Word goal"
              className="w-1/2 rounded-lg border border-divider bg-transparent px-2 py-1.5 text-sm text-text outline-none"
            />
            <input
              type="date"
              value={draftDeadline}
              onChange={(e) => setDraftDeadline(e.target.value)}
              className="w-1/2 rounded-lg border border-divider bg-transparent px-2 py-1.5 text-sm text-text outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={close} className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text">
              Cancel
            </button>
            <button onClick={commitGoal} className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-semibold text-on-strong">
              Save
            </button>
          </div>
        </div>
      )}

      {panel === "delete" && (
        <div className="px-2 pb-2.5">
          <p className="mb-2 text-xs text-text-soft">Delete “{project.title}”? This can&rsquo;t be undone.</p>
          <div className="flex gap-2">
            <button onClick={close} className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text">
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
