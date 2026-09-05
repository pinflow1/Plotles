"use client";

import type { Editor } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import { FONT_LABELS, LINE_SPACING_VALUES, type FontChoice, type LineSpacing, useEditorPreferences } from "@/lib/editor-preferences";
import { useTheme } from "@/lib/theme-context";
import { Stepper } from "@/components/ui/Stepper";
import { Segmented } from "@/components/ui/Segmented";
import { Accordion } from "@/components/quick-tools/Accordion";

// Swatches are filtered to the 3 of 5 brand colors that stay readable
// against the current theme's background — Casper reads almost identical
// in lightness to Clay White (light mode), and Charcoal reads almost
// identical to Deep Black (dark mode), so those two are hidden per-theme.
const SWATCHES: Record<"light" | "dark", { value: string; name: string }[]> = {
  light: [
    { value: "#242424", name: "Charcoal" },
    { value: "#111111", name: "Deep Black" },
    { value: "#8E8E8E", name: "Gray" },
  ],
  dark: [
    { value: "#D8D2C4", name: "Clay White" },
    { value: "#C9C7C2", name: "Casper" },
    { value: "#8E8E8E", name: "Gray" },
  ],
};

const FONT_CHOICES: FontChoice[] = ["serif", "serif-classic", "sans"];
const FONT_PREVIEW_CLASS: Record<FontChoice, string> = { serif: "font-serif", "serif-classic": "font-serif-classic", sans: "font-sans" };
const ALIGN_OPTIONS = [
  { value: "left", icon: AlignLeft },
  { value: "center", icon: AlignCenter },
  { value: "right", icon: AlignRight },
  { value: "justify", icon: AlignJustify },
] as const;

export function TextAppearanceGroup({
  editor,
  openAccordion,
  setOpenAccordion,
}: {
  editor: Editor | null;
  openAccordion: string | null;
  setOpenAccordion: (id: string | null) => void;
}) {
  const { fontFamily, setFontFamily, textSize, nudgeTextSize, lineSpacing, setLineSpacing } = useEditorPreferences();
  const { resolvedTheme } = useTheme();
  const toggle = (id: string) => setOpenAccordion(openAccordion === id ? null : id);
  const currentColor = editor?.getAttributes("textStyle").color as string | undefined;
  const currentAlign = (["left", "center", "right", "justify"] as const).find((a) => editor?.isActive({ textAlign: a })) ?? "left";

  return (
    <div className="space-y-0.5">
      <Accordion id="font" label="Font" open={openAccordion === "font"} onToggle={toggle} value={FONT_LABELS[fontFamily]}>
        <div className="grid grid-cols-3 gap-2 pb-2">
          {FONT_CHOICES.map((f) => (
            <button
              key={f}
              onClick={() => setFontFamily(f)}
              className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 transition-colors ${
                fontFamily === f ? "border-text" : "border-divider"
              }`}
            >
              <span className={`text-lg ${FONT_PREVIEW_CLASS[f]}`}>Aa</span>
              <span className="text-[10px] text-text-soft">{FONT_LABELS[f]}</span>
            </button>
          ))}
        </div>
      </Accordion>

      <Row label="Text Size">
        <Stepper value={textSize} onDecrease={() => nudgeTextSize(-1)} onIncrease={() => nudgeTextSize(1)} min={14} max={24} unit="px" />
      </Row>

      <Accordion id="color" label="Text Color" open={openAccordion === "color"} onToggle={toggle}>
        <div className="flex gap-3 pb-2">
          {SWATCHES[resolvedTheme].map((s) => (
            <button
              key={s.value}
              aria-label={s.name}
              onClick={() => editor?.chain().focus().setColor(s.value).run()}
              className="h-6 w-6 rounded-full"
              style={{
                backgroundColor: s.value,
                boxShadow: currentColor === s.value ? `0 0 0 2px var(--surface), 0 0 0 3.5px var(--strong)` : undefined,
              }}
            />
          ))}
        </div>
      </Accordion>

      <Accordion id="align" label="Alignment" open={openAccordion === "align"} onToggle={toggle}>
        <div className="flex gap-2 pb-2">
          {ALIGN_OPTIONS.map(({ value, icon: Icon }) => (
            <button
              key={value}
              aria-label={value}
              onClick={() => editor?.chain().focus().setTextAlign(value).run()}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                currentAlign === value ? "bg-active text-text" : "text-text-soft"
              }`}
            >
              <Icon size={16} strokeWidth={1.6} />
            </button>
          ))}
        </div>
      </Accordion>

      <Row label="Line Spacing">
        <Segmented
          value={lineSpacing}
          onChange={(v: LineSpacing) => setLineSpacing(v)}
          options={[
            { value: "compact", label: "Tight" },
            { value: "comfortable", label: "Normal" },
            { value: "spacious", label: "Loose" },
          ]}
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-text">{label}</span>
      {children}
    </div>
  );
}
