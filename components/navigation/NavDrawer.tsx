"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Library, Lightbulb, NotebookPen, Plus, Settings as SettingsIcon, Users } from "lucide-react";
import type { Idea } from "@prisma/client";
import { useDragSheet } from "@/lib/use-drag-sheet";
import { useSessionCache } from "@/lib/session-cache";
import { api } from "@/lib/api-client";
import { useWaitingRequests } from "@/lib/use-waiting-requests";
import { Avatar } from "@/components/ui/Avatar";

type NavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { penName: string; avatarUrl: string | null };
  active: "dashboard" | "project" | "editor" | "settings" | "collaborate" | "ideas";
};

export function NavDrawer({ open, onOpenChange, user, active }: NavDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { current } = useSessionCache();
  // Fetched each time the menu opens — nothing is requested while it's closed.
  const { waiting } = useWaitingRequests(open);

  // Quick capture: an idea can be dropped from any screen that has this
  // menu, without leaving what you're doing.
  const [idea, setIdea] = useState("");
  const [savingIdea, setSavingIdea] = useState(false);
  const [ideaStatus, setIdeaStatus] = useState<"saved" | "error" | null>(null);
  const { panelRef, dimmerRef, setOpen, startDrag } = useDragSheet({
    axis: "x",
    direction: -1,
    durationMs: 280,
    onOpenChange,
  });

  useEffect(() => setOpen(open), [open, setOpen]);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  async function saveIdea(e: React.FormEvent) {
    e.preventDefault();
    const body = idea.trim();
    if (!body || savingIdea) return;
    setSavingIdea(true);
    setIdeaStatus(null);
    try {
      const { idea: saved } = await api.post<{ idea: Idea }>("/api/ideas", { body });
      setIdea("");
      setIdeaStatus("saved");
      // If the Ideas page is open behind this menu, it adds the idea right away.
      window.dispatchEvent(new CustomEvent<Idea>("plotless:idea-added", { detail: saved }));
      setTimeout(() => setIdeaStatus((s) => (s === "saved" ? null : s)), 2500);
    } catch {
      setIdeaStatus("error");
    } finally {
      setSavingIdea(false);
    }
  }

  function goToCurrentChapter() {
    if (!current) return;
    const editorPath = `/editor/${current.projectId}`;
    if (pathname === editorPath) {
      setOpen(false); // already there — closing the drawer is the whole action, no reload
      return;
    }
    go(editorPath);
  }

  return (
    <>
      <div
        ref={dimmerRef}
        onClick={() => setOpen(false)}
        className="pointer-events-none fixed inset-0 z-40 bg-overlay opacity-0"
        aria-hidden="true"
      />
      {/* Left-edge strip that catches the opening swipe, present on every screen this drawer serves. */}
      <div
        onPointerDown={startDrag}
        className="fixed inset-y-0 left-0 z-40 w-5 touch-none"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        onPointerDown={startDrag}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,82%)] flex-col bg-paper pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[10px_0_30px_rgba(0,0,0,0.14)]"
      >
        <div className="px-6 pt-8">
          <div className="text-xs font-bold tracking-[0.16em] text-text">PLOTLESS</div>

          <div className="mt-6 flex items-center gap-3">
            <Avatar name={user.penName} />
            <div className="min-w-0">
              <div className="truncate font-serif text-base text-text">{user.penName}</div>
              <div className="text-xs text-text-soft">Writer</div>
            </div>
          </div>

          {current && (
            <div className="mt-5 min-w-0 border-l-2 border-divider pl-3">
              <div className="truncate text-xs text-text-soft">{current.projectTitle}</div>
              <div className="truncate text-sm text-text">{current.chapterTitle}</div>
            </div>
          )}
        </div>

        <div className="mx-6 my-5 border-t border-divider" />

        {/* Near the top so the keyboard doesn't cover it; stopPropagation keeps typing and taps here from starting a drawer drag. */}
        <form onSubmit={saveIdea} onPointerDown={(e) => e.stopPropagation()} className="mb-4 px-6">
          <div className="flex gap-2">
            <input
              value={idea}
              onChange={(e) => {
                setIdea(e.target.value);
                setIdeaStatus(null);
              }}
              placeholder="Jot an idea…"
              aria-label="Jot an idea"
              className="min-w-0 flex-1 rounded-xl border border-divider bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-text-soft focus-visible:border-text"
            />
            <button
              type="submit"
              disabled={!idea.trim() || savingIdea}
              aria-label="Save idea"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-strong text-on-strong disabled:opacity-40"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          </div>
          {ideaStatus && (
            <p className="mt-1.5 text-xs text-text-soft">{ideaStatus === "saved" ? "Saved to Ideas" : "Couldn't save that — try again"}</p>
          )}
        </form>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4">
          <DrawerItem icon={Home} label="Dashboard" activeItem={active === "dashboard"} onClick={() => go("/dashboard")} />
          <DrawerItem icon={Library} label="Projects" activeItem={false} onClick={() => go("/dashboard")} />
          <DrawerItem icon={Users} label="Collaborate" badge={waiting ?? 0} activeItem={active === "collaborate"} onClick={() => go("/collaborate")} />
          <DrawerItem icon={Lightbulb} label="Ideas" activeItem={active === "ideas"} onClick={() => go("/ideas")} />
          <DrawerItem
            icon={NotebookPen}
            label="Current Chapter"
            activeItem={active === "editor"}
            disabled={!current}
            onClick={goToCurrentChapter}
          />
          <DrawerItem icon={SettingsIcon} label="Settings" activeItem={active === "settings"} onClick={() => go("/settings")} />
        </nav>
      </div>
    </>
  );
}

function DrawerItem({
  icon: Icon,
  label,
  activeItem,
  disabled,
  badge,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  activeItem: boolean;
  disabled?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] transition-colors active:bg-active disabled:opacity-40 ${
        activeItem ? "text-text" : "text-text-soft"
      }`}
    >
      <Icon size={18} strokeWidth={1.6} />
      {label}
      {badge ? (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-strong px-1.5 text-[11px] font-semibold text-on-strong">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
