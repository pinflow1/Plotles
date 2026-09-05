"use client";

import { useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";

type Match = { from: number; to: number };

function findMatches(editor: Editor, query: string): Match[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const matches: Match[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let idx = 0;
    while (true) {
      const found = text.indexOf(q, idx);
      if (found === -1) break;
      matches.push({ from: pos + found, to: pos + found + q.length });
      idx = found + q.length;
    }
  });
  return matches;
}

export function FindReplace({ editor, onBack }: { editor: Editor | null; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [index, setIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => (editor ? findMatches(editor, query) : []), [editor, query]);
  const activeIndex = matches.length ? Math.min(Math.max(index, 0), matches.length - 1) : -1;

  function select(i: number) {
    setIndex(i);
    const m = matches[i];
    if (!editor || !m) return;
    editor.chain().focus().setTextSelection(m).scrollIntoView().run();
  }

  function onQueryChange(v: string) {
    setQuery(v);
    setIndex(0);
    if (editor && v) {
      const m = findMatches(editor, v)[0];
      if (m) editor.chain().focus().setTextSelection(m).scrollIntoView().run();
    }
  }

  function step(dir: 1 | -1) {
    if (!matches.length) return;
    select((activeIndex + dir + matches.length) % matches.length);
  }

  function replaceOne() {
    if (!editor || activeIndex < 0) return;
    const m = matches[activeIndex];
    editor.chain().focus().insertContentAt(m, replacement).run();
    // Positions shift after an edit — recompute rather than trust stale ones.
    const fresh = findMatches(editor, query);
    setIndex(Math.min(activeIndex, Math.max(fresh.length - 1, 0)));
  }

  function replaceAll() {
    if (!editor || !matches.length) return;
    // Replacing back-to-front means earlier matches' positions never shift.
    const chain = editor.chain().focus();
    for (let i = matches.length - 1; i >= 0; i--) {
      chain.insertContentAt(matches[i], replacement);
    }
    chain.run();
    setQuery("");
    setIndex(-1);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} aria-label="Back" className="rounded-lg p-1 text-text-soft active:bg-active">
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Find in manuscript"
          className="flex-1 rounded-lg border border-divider bg-transparent px-3 py-1.5 text-sm text-text outline-none focus-visible:border-text"
        />
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-text-soft">
        <span>{matches.length ? `${activeIndex + 1} of ${matches.length}` : "0 of 0"}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} aria-label="Previous match" className="rounded-lg p-1.5 active:bg-active disabled:opacity-30" disabled={!matches.length}>
            <ChevronUp size={15} strokeWidth={1.8} />
          </button>
          <button onClick={() => step(1)} aria-label="Next match" className="rounded-lg p-1.5 active:bg-active disabled:opacity-30" disabled={!matches.length}>
            <ChevronDown size={15} strokeWidth={1.8} />
          </button>
          <button onClick={() => setShowReplace((v) => !v)} className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-text active:bg-active">
            Replace
          </button>
        </div>
      </div>

      {showReplace && (
        <div className="space-y-2">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace with"
            className="w-full rounded-lg border border-divider bg-transparent px-3 py-1.5 text-sm text-text outline-none focus-visible:border-text"
          />
          <div className="flex gap-2">
            <button
              onClick={replaceOne}
              disabled={activeIndex < 0}
              className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text disabled:opacity-40"
            >
              Replace
            </button>
            <button
              onClick={replaceAll}
              disabled={!matches.length}
              className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-medium text-on-strong disabled:opacity-40"
            >
              Replace All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
