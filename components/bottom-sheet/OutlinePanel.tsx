"use client";

import { useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronLeft } from "lucide-react";

type HeadingEntry = { pos: number; level: number; text: string };

function getHeadings(editor: Editor): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({ pos, level: node.attrs.level, text: node.textContent || "Untitled heading" });
    }
  });
  return headings;
}

export function OutlinePanel({ editor, onBack }: { editor: Editor | null; onBack: () => void }) {
  const headings = useMemo(() => (editor ? getHeadings(editor) : []), [editor]);

  function jump(pos: number) {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} aria-label="Back" className="rounded-lg p-1 text-text-soft active:bg-active">
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <span className="text-[15px] text-text">Outline</span>
      </div>

      {headings.length === 0 ? (
        <p className="px-1 text-sm text-text-soft">No headings in this chapter yet.</p>
      ) : (
        <div className="space-y-0.5">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => jump(h.pos)}
              style={{ paddingLeft: `${(h.level - 1) * 14 + 8}px` }}
              className="block w-full truncate rounded-lg py-2 text-left text-sm text-text active:bg-active"
            >
              {h.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
