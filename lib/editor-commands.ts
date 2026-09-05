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
  return [
    {
      id: "bold",
      label: "Bold",
      glyph: "B",
      glyphClassName: "font-bold",
      isActive: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      label: "Italic",
      glyph: "I",
      glyphClassName: "italic font-serif",
      isActive: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      id: "underline",
      label: "Underline",
      glyph: "U",
      glyphClassName: "underline",
      isActive: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      id: "strike",
      label: "Strike",
      glyph: "S",
      glyphClassName: "line-through",
      isActive: editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      id: "heading",
      label: "Heading",
      glyph: "H",
      glyphClassName: "font-semibold",
      // A single chip toggles one level — level 2 reads as a chapter
      // subheading rather than a document title. Flagged as an assumption.
      isActive: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "bulletList",
      label: "List",
      icon: List,
      isActive: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: "undo",
      label: "Undo",
      icon: Undo2,
      disabled: !editor.can().undo(),
      run: () => editor.chain().focus().undo().run(),
    },
    {
      id: "redo",
      label: "Redo",
      icon: Redo2,
      disabled: !editor.can().redo(),
      run: () => editor.chain().focus().redo().run(),
    },
  ];
}

/** Quote + Numbered List — appended after getFormatActions() for Quick
 *  Tools' "Formatting" section only. */
export function getExtraFormattingActions(editor: Editor | null): EditorAction[] {
  if (!editor) return [];
  return [
    {
      id: "blockquote",
      label: "Quote",
      icon: Quote,
      isActive: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "orderedList",
      label: "Numbered",
      icon: ListOrdered,
      isActive: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];
}

/** Insert group's two real actions — Quote and Divider are covered by
 *  StarterKit. Link, Image, and Note are stubbed elsewhere: Link/Image need
 *  @tiptap/extension-link and @tiptap/extension-image, which the brief's
 *  dependency list doesn't include, and Note has no spec yet. */
export function getInsertActions(editor: Editor | null): EditorAction[] {
  if (!editor) return [];
  return [
    {
      id: "quote",
      label: "Quote",
      icon: Quote,
      isActive: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "divider",
      label: "Divider",
      icon: Minus,
      run: () => editor.chain().focus().setHorizontalRule().run(),
    },
  ];
}
