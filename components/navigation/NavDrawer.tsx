"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Library, NotebookPen, Settings as SettingsIcon } from "lucide-react";
import { useDragSheet } from "@/lib/use-drag-sheet";
import { useSessionCache } from "@/lib/session-cache";
import { Avatar } from "@/components/ui/Avatar";

type NavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { penName: string; avatarUrl: string | null };
  active: "dashboard" | "editor" | "settings";
};

export function NavDrawer({ open, onOpenChange, user, active }: NavDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { current } = useSessionCache();
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

        <nav className="flex flex-col px-3">
          <DrawerItem icon={Home} label="Dashboard" activeItem={active === "dashboard"} onClick={() => go("/dashboard")} />
          <DrawerItem icon={Library} label="Projects" activeItem={false} onClick={() => go("/dashboard")} />
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
  onClick,
}: {
  icon: typeof Home;
  label: string;
  activeItem: boolean;
  disabled?: boolean;
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
    </button>
  );
}
