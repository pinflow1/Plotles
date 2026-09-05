"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Search, StickyNote, Focus, ChevronRight } from "lucide-react";
import { getFormatActions, getExtraFormattingActions } from "@/lib/editor-commands";
import { useEditorPreferences } from "@/lib/editor-preferences";
import { Chip, ChipRow, GroupLabel } from "@/components/ui/Chip";
import { Toggle } from "@/components/ui/Toggle";
import { TextAppearanceGroup } from "@/components/quick-tools/TextAppearanceGroup";
import { FindReplace } from "@/components/quick-tools/FindReplace";

type View = "main" | "find";

export function QuickToolsPopover({
  editor,
  open,
  onOpenChange,
  view,
  onViewChange,
}: {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: View;
  onViewChange: (view: View) => void;
}) {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(""); // ephemeral by design — no persistence in V1
  const ref = useRef<HTMLDivElement>(null);
  const { focusMode, setFocusMode } = useEditorPreferences();

  // Tap outside closes the popover.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const formatting = editor ? [...getFormatActions(editor), ...getExtraFormattingActions(editor)] : [];

  return (
    <div
      ref={ref}
      className="fixed right-4 top-[calc(env(safe-area-inset-top)+56px)] z-40 w-[min(320px,88vw)] origin-top-right rounded-2xl bg-surface p-4 shadow-[0_12px_36px_rgba(0,0,0,0.18)]"
      style={{ animation: "quick-tools-in 160ms cubic-bezier(.2,.8,.2,1)" }}
    >
      <style>{`@keyframes quick-tools-in { from { opacity: 0; transform: scale(.94) translateY(-6px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

      {view === "find" ? (
        <FindReplace editor={editor} onBack={() => onViewChange("main")} />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide">
          <GroupLabel>Text Appearance</GroupLabel>
          <TextAppearanceGroup editor={editor} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion} />

          <div className="my-3 border-t border-divider" />
          <GroupLabel>Formatting</GroupLabel>
          <ChipRow>
            {formatting.map((action) => (
              <Chip key={action.id} {...action} />
            ))}
          </ChipRow>

          <div className="my-3 border-t border-divider" />
          <GroupLabel>Writing</GroupLabel>

          <button
            onClick={() => onViewChange("find")}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left active:bg-active"
          >
            <Search size={17} strokeWidth={1.6} className="text-text" />
            <span className="flex-1 text-sm text-text">Find & Replace</span>
            <ChevronRight size={15} strokeWidth={1.6} className="text-text-soft" />
          </button>

          <button
            onClick={() => {
              setNoteOpen((v) => !v);
              setOpenAccordion(null);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left active:bg-active"
          >
            <StickyNote size={17} strokeWidth={1.6} className="text-text" />
            <span className="flex-1 text-sm text-text">Note</span>
          </button>
          {noteOpen && (
            <div className="pb-2 pl-1 pr-1">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A thought for later — not saved"
                rows={3}
                className="w-full resize-none rounded-lg border border-divider bg-transparent p-2 text-sm text-text outline-none focus-visible:border-text"
              />
            </div>
          )}

          {/* Most prominent control in the menu, per the brief. Plain div,
              not a button — Toggle below is already its own button, and a
              button can't legally nest another one. */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setFocusMode(!focusMode)}
            onKeyDown={(e) => e.key === "Enter" && setFocusMode(!focusMode)}
            className={`mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
              focusMode ? "bg-strong text-on-strong" : "bg-active text-text"
            }`}
          >
            <Focus size={17} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-medium">Focus Mode</span>
            <Toggle checked={focusMode} onChange={setFocusMode} label="Toggle focus mode" />
          </div>
        </div>
      )}
    </div>
  );
}
