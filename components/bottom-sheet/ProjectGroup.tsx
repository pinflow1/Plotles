import { BookOpen, ImageIcon, Download, Users, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import { GroupLabel } from "@/components/ui/Chip";

function ProjectRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  note,
}: {
  icon: typeof BookOpen;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-5 py-[13px] text-left transition-colors active:bg-active disabled:active:bg-transparent"
    >
      <Icon size={18} strokeWidth={1.6} className={disabled ? "text-text-soft/50" : "text-text"} />
      <span className={`flex-1 text-[15px] ${disabled ? "text-text-soft/50" : "text-text"}`}>{label}</span>
      {note && <span className="text-xs text-text-soft">{note}</span>}
      {!disabled && <ChevronRight size={16} strokeWidth={1.6} className="text-text-soft" />}
    </button>
  );
}

export function ProjectGroup({
  onChapters,
  onCollaborators,
  onSettings,
}: {
  onChapters: () => void;
  onCollaborators: () => void;
  onSettings: () => void;
}) {
  return (
    <div>
      <GroupLabel>Project</GroupLabel>
      <ProjectRow icon={BookOpen} label="Chapters" onClick={onChapters} />
      {/* Cover creation isn't built yet — stubbed per the brief. */}
      <ProjectRow icon={ImageIcon} label="Cover" onClick={() => {}} disabled note="Coming soon" />
      {/* Export isn't built yet — stubbed per the brief. */}
      <ProjectRow icon={Download} label="Export" onClick={() => {}} disabled note="Coming soon" />
      <ProjectRow icon={Users} label="Collaborators" onClick={onCollaborators} />
      <ProjectRow icon={SettingsIcon} label="Settings" onClick={onSettings} />
    </div>
  );
}
