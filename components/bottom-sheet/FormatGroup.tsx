import type { Editor } from "@tiptap/react";
import { getFormatActions } from "@/lib/editor-commands";
import { Chip, ChipRow, GroupLabel } from "@/components/ui/Chip";

export function FormatGroup({ editor }: { editor: Editor | null }) {
  return (
    <div>
      <GroupLabel>Format</GroupLabel>
      <ChipRow>
        {getFormatActions(editor).map((action) => (
          <Chip key={action.id} {...action} />
        ))}
      </ChipRow>
    </div>
  );
}
