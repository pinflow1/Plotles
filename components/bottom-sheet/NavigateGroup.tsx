import { Search, BookOpen, LayoutGrid } from "lucide-react";
import { Chip, ChipRow, GroupLabel } from "@/components/ui/Chip";

export function NavigateGroup({
  onFind,
  onChapters,
  onOutline,
}: {
  onFind: () => void;
  onChapters: () => void;
  onOutline: () => void;
}) {
  return (
    <div>
      <GroupLabel>Navigate</GroupLabel>
      <ChipRow>
        <Chip id="find" label="Find" icon={Search} run={onFind} />
        <Chip id="chapters" label="Chapters" icon={BookOpen} run={onChapters} />
        <Chip id="outline" label="Outline" icon={LayoutGrid} run={onOutline} />
      </ChipRow>
    </div>
  );
}
