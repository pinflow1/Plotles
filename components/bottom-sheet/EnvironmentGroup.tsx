import { Focus, Sun, Moon } from "lucide-react";
import { useEditorPreferences } from "@/lib/editor-preferences";
import { useTheme } from "@/lib/theme-context";
import { GroupLabel } from "@/components/ui/Chip";
import { Toggle } from "@/components/ui/Toggle";
import { Stepper } from "@/components/ui/Stepper";
import { Segmented } from "@/components/ui/Segmented";

function EnvRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3 text-text">
        {icon}
        <span className="text-[15px]">{label}</span>
      </div>
      {children}
    </div>
  );
}

export function EnvironmentGroup() {
  const { focusMode, setFocusMode, textSize, nudgeTextSize } = useEditorPreferences();
  const { resolvedTheme, toggleLightDark } = useTheme();

  return (
    <div>
      <GroupLabel>Environment</GroupLabel>

      <EnvRow icon={<Focus size={18} strokeWidth={1.6} />} label="Focus Mode">
        <Toggle checked={focusMode} onChange={setFocusMode} label="Toggle focus mode" />
      </EnvRow>

      <EnvRow icon={<span className="font-serif text-[15px]">Aa</span>} label="Text Size">
        <Stepper value={textSize} onDecrease={() => nudgeTextSize(-1)} onIncrease={() => nudgeTextSize(1)} min={14} max={24} />
      </EnvRow>

      <EnvRow icon={resolvedTheme === "dark" ? <Moon size={18} strokeWidth={1.6} /> : <Sun size={18} strokeWidth={1.6} />} label="Appearance">
        <Segmented
          value={resolvedTheme}
          onChange={toggleLightDark}
          options={[
            { value: "light", icon: <Sun size={15} strokeWidth={1.8} />, "aria-label": "Light" },
            { value: "dark", icon: <Moon size={15} strokeWidth={1.8} />, "aria-label": "Dark" },
          ]}
        />
      </EnvRow>
    </div>
  );
}
