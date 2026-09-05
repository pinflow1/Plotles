import type { Editor } from "@tiptap/react";
import { Link2, ImagePlus, StickyNote } from "lucide-react";
import { getInsertActions } from "@/lib/editor-commands";
import { Chip, ChipRow, GroupLabel } from "@/components/ui/Chip";

// Link and Image need @tiptap/extension-link and @tiptap/extension-image,
// which aren't in the brief's dependency list (only Underline/TextStyle/
// Color/TextAlign/Placeholder are called out beyond StarterKit) — stubbed
// rather than silently adding packages. Note has no spec yet (a personal
// margin annotation? a collaborative comment — which V1 explicitly
// excludes?) — stubbed pending that answer.
export function InsertGroup({ editor }: { editor: Editor | null }) {
  const real = getInsertActions(editor); // [quote, divider]
  const quote = real.find((a) => a.id === "quote")!;
  const divider = real.find((a) => a.id === "divider")!;
  const stub = (id: string, label: string, icon: typeof Link2) => ({ id, label, icon, disabled: true, run: () => {} });

  const ordered = editor
    ? [quote, stub("link", "Link", Link2), stub("image", "Image", ImagePlus), divider, stub("note", "Note", StickyNote)]
    : [];

  return (
    <div>
      <GroupLabel>Insert</GroupLabel>
      <ChipRow>
        {ordered.map((action) => (
          <Chip key={action.id} {...action} />
        ))}
      </ChipRow>
    </div>
  );
}
