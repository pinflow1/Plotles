"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Chapter } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useDragSheet } from "@/lib/use-drag-sheet";
import { FormatGroup } from "@/components/bottom-sheet/FormatGroup";
import { InsertGroup } from "@/components/bottom-sheet/InsertGroup";
import { NavigateGroup } from "@/components/bottom-sheet/NavigateGroup";
import { EnvironmentGroup } from "@/components/bottom-sheet/EnvironmentGroup";
import { ProjectGroup } from "@/components/bottom-sheet/ProjectGroup";
import { ChaptersPanel } from "@/components/bottom-sheet/ChaptersPanel";
import { CollaboratorsPanel } from "@/components/bottom-sheet/CollaboratorsPanel";
import { OutlinePanel } from "@/components/bottom-sheet/OutlinePanel";

type Subview = "main" | "chapters" | "collaborators" | "outline";

export function BottomSheet({
  editor,
  open,
  onOpenChange,
  onFind,
  projectId,
  chapters,
  activeChapterId,
  canEdit,
  isOwner,
  onChaptersChange,
  onSwitchChapter,
}: {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFind: () => void;
  projectId: string;
  chapters: Chapter[];
  activeChapterId: string;
  canEdit: boolean;
  isOwner: boolean;
  onChaptersChange: (chapters: Chapter[]) => void;
  onSwitchChapter: (chapterId: string) => void;
}) {
  const router = useRouter();
  const [subview, setSubview] = useState<Subview>("main");
  const { panelRef, dimmerRef, setOpen, startDrag } = useDragSheet({ axis: "y", direction: 1, onOpenChange });

  useEffect(() => setOpen(open), [open, setOpen]);
  useEffect(() => {
    if (!open) setSubview("main");
  }, [open]);

  return (
    <>
      <div ref={dimmerRef} onClick={() => setOpen(false)} className="pointer-events-none fixed inset-0 z-40 bg-overlay opacity-0" aria-hidden="true" />

      {/* Persistent handle: tap to open, or drag from anywhere along this
          strip. Lives outside the panel so it's visible even when closed —
          the old version was drag-only with nothing to see or tap. */}
      <button
        onPointerDown={startDrag}
        onClick={() => setOpen(true)}
        aria-label="Open writing controls"
        className="fixed inset-x-0 bottom-0 z-40 flex touch-none justify-center pb-[max(10px,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="h-1.5 w-11 rounded-full bg-text-soft/60 shadow-[0_1px_4px_rgba(0,0,0,0.15)]" />
      </button>

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Writing controls"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80%] overflow-y-auto scrollbar-hide rounded-t-sheet bg-paper pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-10px_30px_rgba(0,0,0,0.14)]"
      >
        <div onPointerDown={startDrag} className="flex justify-center py-2.5">
          <div className="h-1 w-9 rounded-full bg-divider" />
        </div>

        <div className="px-5 pb-4">
          {subview === "chapters" && (
            <ChaptersPanel
              projectId={projectId}
              chapters={chapters}
              activeChapterId={activeChapterId}
              canEdit={canEdit}
              onChaptersChange={onChaptersChange}
              onSwitchChapter={(id) => {
                onSwitchChapter(id);
                setOpen(false);
              }}
              onBack={() => setSubview("main")}
            />
          )}
          {subview === "collaborators" && (
            <CollaboratorsPanel projectId={projectId} isOwner={isOwner} onBack={() => setSubview("main")} />
          )}
          {subview === "outline" && <OutlinePanel editor={editor} onBack={() => setSubview("main")} />}

          {subview === "main" && (
            <>
              <FormatGroup editor={editor} />
              <InsertGroup editor={editor} />
              <NavigateGroup onFind={onFind} onChapters={() => setSubview("chapters")} onOutline={() => setSubview("outline")} />
              <div className="my-4 border-t border-divider" />
              <EnvironmentGroup />
              <div className="my-4 border-t border-divider" />
              <ProjectGroup
                onChapters={() => setSubview("chapters")}
                onCollaborators={() => setSubview("collaborators")}
                onSettings={() => {
                  setOpen(false);
                  router.push("/settings");
                }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
