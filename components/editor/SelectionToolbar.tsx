"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { MoreHorizontal } from "lucide-react";

type Rect = { top: number; left: number };

export function SelectionToolbar({ editor, onMore, hidden }: { editor: Editor | null; onMore: () => void; hidden?: boolean }) {
  const [rect, setRect] = useState<Rect | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    const ed = editor;

    function update() {
      const { from, to, empty } = ed.state.selection;
      if (empty || !ed.isFocused) {
        setRect(null);
        return;
      }
      const start = ed.view.coordsAtPos(from);
      const end = ed.view.coordsAtPos(to);
      const toolbarWidth = toolbarRef.current?.offsetWidth ?? 180;
      const top = Math.min(start.top, end.top);
      const bottom = Math.max(start.bottom, end.bottom);
      const centerX = (start.left + end.left) / 2;

      const margin = 12;
      const goesAbove = top - 52 > margin;
      setRect({
        top: goesAbove ? top - 48 : bottom + 10,
        left: Math.min(Math.max(centerX - toolbarWidth / 2, margin), window.innerWidth - toolbarWidth - margin),
      });
    }

    function onBlur() {
      setRect(null);
    }

    ed.on("selectionUpdate", update);
    ed.on("blur", onBlur);
    return () => {
      ed.off("selectionUpdate", update);
      ed.off("blur", onBlur);
    };
  }, [editor]);

  if (!editor || !rect || hidden) return null;

  const stop = (e: React.MouseEvent) => e.preventDefault(); // keep manuscript focus so selection survives the tap

  return (
    <div
      ref={toolbarRef}
      style={{ top: rect.top, left: rect.left }}
      className="fixed z-30 flex items-center gap-0.5 rounded-xl bg-[#242424] px-1.5 py-1.5 text-[#D8D2C4] shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-[opacity,transform] duration-150"
    >
      <ToolbarButton onMouseDown={stop} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton onMouseDown={stop} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
        <span className="font-serif italic">I</span>
      </ToolbarButton>
      <ToolbarButton onMouseDown={stop} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}>
        <span className="underline">U</span>
      </ToolbarButton>
      <div className="mx-0.5 h-4 w-px bg-[#D8D2C4]/20" />
      <ToolbarButton onMouseDown={stop} onClick={onMore}>
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  onMouseDown,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  active?: boolean;
}) {
  return (
    <button
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors active:scale-95 ${
        active ? "bg-[#D8D2C4]/20" : ""
      }`}
    >
      {children}
    </button>
  );
                                                                                                                               }
