import type { Editor } from "@tiptap/react";
import { List, ListOrdered, Undo2, Redo2, Quote, Minus } from "lucide-react";

export type EditorAction = {
  id: string;
  label: string;
  glyph?: string;
  glyphClassName?: string;
  icon?: typeof List;
  isActive?: boolean;
  disabled?: boolean;
  run: () => void;
};

/** Bold/Italic/Underline/Strike/Heading/BulletList/Undo/Redo — the bottom
 *  sheet's Format group verbatim. Quick Tools reuses this same list and
 *  appends Quote + Numbered List on top, per the brief. */
export function getFormatActions(editor: Editor | null): EditorAction[] {
  if (!editor) return [];
  const ed = editor; // const capture — the run() closures below are called later, after this function has returned, so narrowing on the parameter itself doesn't reach them
  return [
    {
      id: "bold",
      label: "Bold",
      glyph: "B",
      glyphClassName: "font-bold",
      isActive: ed.isActive("bold"),
      run: () => ed.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      label: "Italic",
      glyph: "I",
      glyphClassName: "italic font-serif",
      isActive: ed.isActive("italic"),
      run: () => ed.chain().focus().toggleItalic().run(),
    },
    {
      id: "underline",
      label: "Underline",
      glyph: "U",
      glyphClassName: "underline",
      isActive: ed.isActive("underline"),
      run: () => ed.chain().focus().toggleUnderline().run(),
    },
    {
      id: "strike",
      label: "Strike",
      glyph: "S",
      glyphClassName: "line-through",
      isActive: ed.isActive("strike"),
      run: () => ed.chain().focus().toggleStrike().run(),
    },
    {
      id: "heading",
      label: "Heading",
      glyph: "H",
      glyphClassName: "font-semibold",
      // A single chip toggles one level — level 2 reads as a chapter
      // subheading rather than a document title. Flagged as an assumption.
      isActive: ed.isActive("heading", { level: 2 }),
      run: () => ed.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "bulletList",
      label: "List",
      icon: List,
      isActive: ed.isActive("bulletList"),
      run: () => ed.chain().focus().toggleBulletList().run(),
    },
    {
      id: "undo",
      label: "Undo",
      icon: Undo2,
      disabled: !ed.can().undo(),
      run: () => ed.chain().focus().undo().run(),
    },
    {
      id: "redo",
      label: "Redo",
      icon: Redo2,
      disabled: !ed.can().redo(),
      run: () => ed.chain().focus().redo().run(),
    },
  ];
}

/** Quote + Numbered List — appended after getFormatActions() for Quick
 *  Tools' "Formatting" section only. */
export function getExtraFormattingActions(editor: Editor | null): EditorAction[] {
  if (!editor) return [];
  const ed = editor;
  return [
    {
      id: "blockquote",
      label: "Quote",
      icon: Quote,
      isActive: ed.isActive("blockquote"),
      run: () => ed.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "orderedList",
      label: "Numbered",
      icon: ListOrdered,
      isActive: ed.isActive("orderedList"),
      run: () => ed.chain().focus().toggleOrderedList().run(),
    },
  ];
}

/** Insert group's two real actions — Quote and Divider are covered by
 *  StarterKit. Link, Image, and Note are stubbed elsewhere: Link/Image need
 *  @tiptap/extension-link and @tiptap/extension-image, which the brief's
 *  dependency list doesn't include, and Note has no spec yet. */
export function getInsertActions(editor: Editor | null): EditorAction[] {
  if (!editor) return [];
  const ed = editor;
  return [
    {
      id: "quote",
      label: "Quote",
      icon: Quote,
      isActive: ed.isActive("blockquote"),
      run: () => ed.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "divider",
      label: "Divider",
      icon: Minus,
      run: () => ed.chain().focus().setHorizontalRule().run(),
    },
  ];
}
