"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, ImageIcon, Download, Users, Info, Flag, Target, Trash2, Camera } from "lucide-react";
import type { Chapter, Project, ProjectStatus } from "@prisma/client";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { computePace } from "@/lib/pace";
import { fileToCoverDataUrl } from "@/lib/image-resize";
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
  const [panelError, setPanelError] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const canEdit = project.role === "owner" || project.role === "edit";
  const chapters = project.chapters;
  const mostRecentChapter = [...chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const pace = computePace(totalWords, project.goalWordCount, project.deadline);

  function close() {
    setPanel(null);
    setPanelError(null);
  }

  function togglePanel(p: Exclude<Panel, null>) {
    setPanelError(null);
    setPanel((prev) => (prev === p ? null : p));
  }

  function goToChapter(chapterId: string) {
    router.push(`/editor/${project.id}?chapter=${chapterId}`);
  }

  function handleChaptersChange(updated: Chapter[]) {
    setProject((prev) => ({ ...prev, chapters: updated }));
  }

  async function onCoverSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file || !canEdit) return;
    setCoverError(null);
    setCoverBusy(true);
    try {
      const dataUrl = await fileToCoverDataUrl(file);
      await api.patch(`/api/projects/${project.id}`, { coverUrl: dataUrl });
      setProject((prev) => ({ ...prev, coverUrl: dataUrl }));
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Couldn't set that cover.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function saveDetails() {
    const title = draftTitle.trim();
    if (!title) {
      setDraftTitle(project.title);
      close();
      return;
    }
    setBusy(true);
    setPanelError(null);
    try {
      await api.patch(`/api/projects/${project.id}`, { title, description: draftDescription.trim() || null });
      setProject((prev) => ({ ...prev, title, description: draftDescription.trim() || null }));
      close();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Couldn't save those details.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: ProjectStatus) {
    setBusy(true);
    setPanelError(null);
    try {
      await api.patch(`/api/projects/${project.id}`, { status });
      setProject((prev) => ({ ...prev, status }));
      close();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Couldn't update the status.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGoal() {
    const goalWordCount = draftGoal.trim() ? Math.max(0, parseInt(draftGoal, 10)) : null;
    const deadline = draftDeadline || null;
    setBusy(true);
    setPanelError(null);
    try {
      await api.patch(`/api/projects/${project.id}`, { goalWordCount, deadline });
      setProject((prev) => ({ ...prev, goalWordCount, deadline: deadline ? new Date(deadline) : null }));
      close();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Couldn't save the goal.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setPanelError(null);
    try {
      await api.delete(`/api/projects/${project.id}`);
      router.replace("/dashboard");
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Couldn't delete this project.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <input ref={coverInputRef} type="file" accept="image/*" onChange={onCoverSelected} className="hidden" />

      <header className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => {
            close();
            setDrawerOpen(true);
          }}
          aria-label="Menu"
          className="rounded-lg p-2.5 text-text active:bg-active"
        >
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="truncate text-sm text-text-soft">{project.title}</span>
        <div className="w-9" />
      </header>

      <div className="mx-auto max-w-lg px-5">
        <section className="flex flex-col items-center pt-2 text-center">
          <button
            onClick={() => canEdit && coverInputRef.current?.click()}
            disabled={!canEdit || coverBusy}
            aria-label={project.coverUrl ? "Change cover" : "Add cover"}
            className="relative flex h-32 w-24 items-center justify-center overflow-hidden rounded-lg bg-surface"
          >
            {project.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data URL, not something next/image's optimizer can handle
              <img src={project.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <BookOpen size={28} strokeWidth={1.3} className="text-text-soft" />
            )}
            {canEdit && (
              <div className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-paper/90">
                {coverBusy ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-text-soft border-t-transparent" />
                ) : (
                  <Camera size={12} strokeWidth={2} className="text-text-soft" />
                )}
              </div>
            )}
          </button>
          {coverError && <p className="mt-2 text-xs text-text-soft">{coverError}</p>}

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
            {canEdit && <ActionRow icon={Info} label="Details" onClick={() => togglePanel("details")} />}
            {canEdit && <ActionRow icon={Flag} label="Status" value={STATUS_LABELS[project.status]} onClick={() => togglePanel("status")} />}
            {canEdit && <ActionRow icon={Target} label="Goal" onClick={() => togglePanel("goal")} />}
            {canEdit && (
              <ActionRow
                icon={ImageIcon}
                label="Cover"
                value={coverBusy ? "Uploading…" : project.coverUrl ? "Change" : "Add"}
                onClick={() => coverInputRef.current?.click()}
              />
            )}
            <ActionRow icon={Download} label="Export" value="Coming soon" disabled onClick={() => {}} />
            <ActionRow icon={Users} label="Collaborators" onClick={() => togglePanel("collaborators")} last={project.role !== "owner"} />
            {project.role === "owner" && <ActionRow icon={Trash2} label="Delete Project" onClick={() => togglePanel("delete")} last />}
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
              {panelError && <p className="text-xs text-text-soft">{panelError}</p>}
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text">
                  Cancel
                </button>
                <button onClick={saveDetails} disabled={busy} className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-semibold text-on-strong disabled:opacity-60">
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}

          {panel === "status" && (
            <div className="mt-2 rounded-2xl bg-surface p-4">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    disabled={busy}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${s === project.status ? "bg-strong text-on-strong" : "bg-active text-text"}`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              {panelError && <p className="mt-2 text-xs text-text-soft">{panelError}</p>}
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
              {panelError && <p className="text-xs text-text-soft">{panelError}</p>}
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text">
                  Cancel
                </button>
                <button onClick={saveGoal} disabled={busy} className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-semibold text-on-strong disabled:opacity-60">
                  {busy ? "Saving…" : "Save"}
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
              {panelError && <p className="mb-2 text-xs text-text-soft">{panelError}</p>}
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
