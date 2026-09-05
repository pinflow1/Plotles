"use client";

import { EditorContent, type Editor } from "@tiptap/react";

export function Manuscript({ editor }: { editor: Editor | null }) {
  return (
    <div className="min-h-screen bg-paper px-6 pb-40 pt-[calc(env(safe-area-inset-top)+64px)]">
      <div
        className="manuscript mx-auto max-w-[65ch] text-text [&_.ProseMirror]:min-h-[60vh] [&_.ProseMirror]:outline-none"
        style={{
          fontFamily: "var(--manuscript-font)",
          fontSize: "var(--ms-size)",
          lineHeight: "var(--ms-lh)",
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
