"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, ImageIcon, Download, Users, Info, Flag, Target, Trash2 } from "lucide-react";
import type { Chapter, Project, ProjectStatus } from "@prisma/client";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { computePace } from "@/lib/pace";
import { NavDrawer } from "@/components/navigation/NavDrawer";
import { ChaptersPanel } from "@/components/bottom-sheet/ChaptersPanel";
import { CollaboratorsPanel } from "@/components/bottom-sheet/CollaboratorsPanel";

type ProjectWithChapters = Project & { chapters: Chapter[]; role: "owner" | "edit" | "view" };
type Panel = "details" | "status" | "goal" | "collaborators" | "delete" | null;

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

export function ProjectView({
  initialProject,
  user,
}: {
  initialProject: ProjectWithChapters;
  user: { penName: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [draftTitle, setDraftTitle] = useState(project.title);
  const [draftDescription, setDraftDescription] = useState(project.description ?? "");
  const [draftGoal, setDraftGoal] = useState(project.goalWordCount ? String(project.goalWordCount) : "");
  const [draftDeadline, setDraftDeadline] = useState(toDateInputValue(project.deadline));
  const [busy, setBusy] = useState(false);

  const canEdit = project.role === "owner" || project.role === "edit";
  const chapters = project.chapters;
  const mostRecentChapter = [...chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const pace = computePace(totalWords, project.goalWordCount, project.deadline);

  function close() {
    setPanel(null);
  }

  function goToChapter(chapterId: string) {
    router.push(`/editor/${project.id}?chapter=${chapterId}`);
  }

  function handleChaptersChange(updated: Chapter[]) {
    setProject((prev) => ({ ...prev, chapters: updated }));
  }

  async function saveDetails() {
    const title = draftTitle.trim();
    close();
    if (!title) {
      setDraftTitle(project.title);
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/api/projects/${project.id}`, { title, description: draftDescription.trim() || null });
      setProject((prev) => ({ ...prev, title, description: draftDescription.trim() || null }));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: ProjectStatus) {
    close();
    setBusy(true);
    try {
      await api.patch(`/api/projects/${project.id}`, { status });
      setProject((prev) => ({ ...prev, status }));
    } finally {
      setBusy(false);
    }
  }

  async function saveGoal() {
    const goalWordCount = draftGoal.trim() ? Math.max(0, parseInt(draftGoal, 10)) : null;
    const deadline = draftDeadline || null;
    close();
    setBusy(true);
    try {
      await api.patch(`/api/projects/${project.id}`, { goalWordCount, deadline });
      setProject((prev) => ({ ...prev, goalWordCount, deadline: deadline ? new Date(deadline) : null }));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.delete(`/api/projects/${project.id}`);
      router.replace("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="truncate text-sm text-text-soft">{project.title}</span>
        <div className="w-9" />
      </header>

      <div className="mx-auto max-w-lg px-5">
        <section className="flex flex-col items-center pt-2 text-center">
          <div className="flex h-32 w-24 items-center justify-center rounded-lg bg-surface">
            <BookOpen size={28} strokeWidth={1.3} className="text-text-soft" />
          </div>
          <h1 className="mt-4 font-serif text-2xl text-text">{project.title}</h1>
          {project.description && <p className="mt-1 max-w-xs text-sm text-text-soft">{project.description}</p>}
          <p className="mt-1 text-xs text-text-soft">
            {STATUS_LABELS[project.status]} · Edited {timeAgo(project.updatedAt)}
          </p>

          {pace && (
            <div className="mt-3 w-full max-w-xs">
              <div className="h-1 overflow-hidden rounded-full bg-active">
                <div className="h-full rounded-full bg-strong" style={{ width: `${pace.progress * 100}%` }} />
              </div>
              <div className="mt-1 text-xs text-text-soft">
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

          {mostRecentChapter && (
            <button
              onClick={() => goToChapter(mostRecentChapter.id)}
              className="mt-4 w-full max-w-xs rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong transition-opacity active:opacity-85"
            >
              Continue writing
            </button>
          )}
        </section>

        <div className="mt-8">
          <div className="mb-2 text-xs uppercase tracking-[0.08em] text-text-soft">Chapters</div>
          <ChaptersPanel
            projectId={project.id}
            chapters={chapters}
            activeChapterId={mostRecentChapter?.id ?? ""}
            canEdit={canEdit}
            onChaptersChange={handleChaptersChange}
            onSwitchChapter={goToChapter}
          />
        </div>

        <div className="mt-8">
          <div className="mb-2 text-xs uppercase tracking-[0.08em] text-text-soft">Project</div>
          <div className="rounded-2xl bg-surface">
            {canEdit && <ActionRow icon={Info} label="Details" onClick={() => setPanel(panel === "details" ? null : "details")} />}
            {canEdit && <ActionRow icon={Flag} label="Status" value={STATUS_LABELS[project.status]} onClick={() => setPanel(panel === "status" ? null : "status")} />}
            {canEdit && <ActionRow icon={Target} label="Goal" onClick={() => setPanel(panel === "goal" ? null : "goal")} />}
            <ActionRow icon={ImageIcon} label="Cover" value="Coming soon" disabled onClick={() => {}} />
            <ActionRow icon={Download} label="Export" value="Coming soon" disabled onClick={() => {}} />
            <ActionRow icon={Users} label="Collaborators" onClick={() => setPanel(panel === "collaborators" ? null : "collaborators")} last={project.role !== "owner"} />
            {project.role === "owner" && <ActionRow icon={Trash2} label="Delete Project" onClick={() => setPanel(panel === "delete" ? null : "delete")} last />}
          </div>

          {panel === "details" && (
            <div className="mt-2 space-y-2 rounded-2xl bg-surface p-4">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border border-divider bg-transparent px-3 py-2 text-sm text-text outline-none"
              />
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="A short description"
                rows={3}
                className="w-full resize-none rounded-lg border border-divider bg-transparent px-3 py-2 text-sm text-text outline-none"
              />
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text">
                  Cancel
                </button>
                <button onClick={saveDetails} className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-semibold text-on-strong">
                  Save
                </button>
              </div>
            </div>
          )}

          {panel === "status" && (
            <div className="mt-2 flex flex-wrap gap-2 rounded-2xl bg-surface p-4">
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
            <div className="mt-2 space-y-2 rounded-2xl bg-surface p-4">
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
                <button onClick={saveGoal} className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-semibold text-on-strong">
                  Save
                </button>
              </div>
            </div>
          )}

          {panel === "collaborators" && (
            <div className="mt-2 rounded-2xl bg-surface p-4">
              <CollaboratorsPanel projectId={project.id} isOwner={project.role === "owner"} />
            </div>
          )}

          {panel === "delete" && (
            <div className="mt-2 rounded-2xl bg-surface p-4">
              <p className="mb-2 text-xs text-text-soft">Delete “{project.title}”? This permanently removes it for every collaborator — there&rsquo;s no undo.</p>
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
      </div>

      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={user} active="project" />
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  value,
  disabled,
  last,
  onClick,
}: {
  icon: typeof Info;
  label: string;
  value?: string;
  disabled?: boolean;
  last?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left [&:not(:first-child)]:border-t [&:not(:first-child)]:border-divider ${
        last ? "rounded-b-2xl" : ""
      } first:rounded-t-2xl active:bg-active disabled:active:bg-transparent`}
    >
      <Icon size={17} strokeWidth={1.6} className={disabled ? "text-text-soft/50" : "text-text"} />
      <span className={`flex-1 text-[15px] ${disabled ? "text-text-soft/50" : "text-text"}`}>{label}</span>
      {value && <span className="text-xs text-text-soft">{value}</span>}
    </button>
  );
                                                           }
