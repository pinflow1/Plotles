"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor } from "@tiptap/react";
import { useLiveblocksExtension } from "@liveblocks/react-tiptap";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { ChevronLeft, Pencil } from "lucide-react";
import type { Chapter, CollaboratorRole } from "@prisma/client";
import { useEditorPreferences } from "@/lib/editor-preferences";
import { useSessionCache } from "@/lib/session-cache";
import { Manuscript } from "@/components/editor/Manuscript";
import { SelectionToolbar } from "@/components/editor/SelectionToolbar";
import { BottomSheet } from "@/components/bottom-sheet/BottomSheet";
import { QuickToolsPopover } from "@/components/quick-tools/QuickToolsPopover";
import { NavDrawer } from "@/components/navigation/NavDrawer";

type ProjectData = {
  id: string;
  title: string;
  chapters: Chapter[];
  role: CollaboratorRole;
};

export function EditorView({
  project,
  initialChapterId,
  user,
}: {
  project: ProjectData;
  initialChapterId: string;
  user: { penName: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [chapters, setChapters] = useState(project.chapters);
  const [activeChapterId, setActiveChapterId] = useState(initialChapterId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qtOpen, setQtOpen] = useState(false);
  const [qtView, setQtView] = useState<"main" | "find">("main");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { focusMode } = useEditorPreferences();
  const sessionCache = useSessionCache();
  const canEdit = project.role === "owner" || project.role === "edit";
  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? chapters[0];

  // Liveblocks room is namespaced per project (see /api/liveblocks-auth);
  // each chapter is a distinct Yjs field within that one room so switching
  // chapters doesn't need a new room connection.
  // ASSUMPTION FLAGGED: `field` on useLiveblocksExtension is my best
  // understanding of the current @liveblocks/react-tiptap API for
  // multi-document rooms — worth a quick check against Liveblocks' docs
  // before relying on it, since it couldn't be verified without network
  // access in this environment.
  const liveblocks = useLiveblocksExtension({ field: activeChapterId, offlineSupport_experimental: true });

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false }), // Liveblocks owns undo history
        Underline,
        TextStyle,
        Color,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({ placeholder: "Begin writing…" }),
        liveblocks,
      ],
      editable: canEdit,
      immediatelyRender: false,
    },
    [activeChapterId]
  );

  // Let the nav drawer (and a future "resume where I left off") know where
  // we are, even after navigating to Dashboard/Settings and back.
  useEffect(() => {
    if (!activeChapter) return;
    sessionCache.setCurrent({
      projectId: project.id,
      projectTitle: project.title,
      chapterId: activeChapter.id,
      chapterTitle: activeChapter.title,
      role: project.role,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter?.id, project.id, project.title]);

  // Best-effort restore of scroll position on return to a chapter. Content
  // itself never needs restoring — Liveblocks resyncs that regardless.
  const scrollRef = useRef<number>(0);
  useEffect(() => {
    const saved = sessionCache.get(activeChapterId)?.scrollTop;
    if (saved) window.scrollTo({ top: saved });
    function onScroll() {
      scrollRef.current = window.scrollY;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      sessionCache.set(activeChapterId, { scrollTop: scrollRef.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapterId]);

  // Focus Mode closes the floating surfaces shortly after engaging, same
  // 240ms grace the prototype gives so the closing animation isn't cut off.
  useEffect(() => {
    if (!focusMode) return;
    const t = setTimeout(() => {
      setSheetOpen(false);
      setQtOpen(false);
    }, 240);
    return () => clearTimeout(t);
  }, [focusMode]);

  function openFindInQuickTools() {
    setSheetOpen(false);
    setQtView("find");
    setQtOpen(true);
  }

  return (
    <div className="relative">
      <header
        className={`fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] transition-opacity duration-200 ${
          focusMode ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="truncate text-sm text-text-soft">{activeChapter?.title}</span>
        <button
          onClick={() => {
            setSheetOpen(false);
            setQtView("main");
            setQtOpen((v) => !v);
          }}
          aria-label="Quick tools"
          className="rounded-lg p-2.5 text-text active:bg-active"
        >
          <Pencil size={19} strokeWidth={1.6} />
        </button>
      </header>

      <Manuscript editor={editor} />

      <SelectionToolbar editor={editor} onMore={() => setSheetOpen(true)} hidden={focusMode || sheetOpen || qtOpen} />

      <BottomSheet
        editor={editor}
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (v) setQtOpen(false);
        }}
        onFind={openFindInQuickTools}
        projectId={project.id}
        chapters={chapters}
        activeChapterId={activeChapterId}
        canEdit={canEdit}
        isOwner={project.role === "owner"}
        onChaptersChange={setChapters}
        onSwitchChapter={setActiveChapterId}
      />

      <QuickToolsPopover
        editor={editor}
        open={qtOpen}
        onOpenChange={setQtOpen}
        view={qtView}
        onViewChange={setQtView}
      />

      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={user} active="editor" />
    </div>
  );
}
