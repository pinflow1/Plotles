import type { EditorAction } from "@/lib/editor-commands";

export function Chip({ id, label, glyph, glyphClassName, icon: Icon, isActive, disabled, run }: EditorAction) {
  return (
    <button
      key={id}
      onClick={run}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      className={`flex min-w-[58px] shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 transition-transform active:scale-95 active:bg-active disabled:opacity-35 ${
        isActive ? "text-text" : "text-text-soft"
      }`}
    >
      {glyph ? (
        <span className={`font-serif text-[17px] leading-none ${glyphClassName ?? ""}`}>{glyph}</span>
      ) : Icon ? (
        <Icon size={19} strokeWidth={1.6} />
      ) : null}
      <span className="text-[10px] font-medium leading-none text-text-soft">{label}</span>
    </button>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="scrollbar-hide -mx-5 flex gap-1 overflow-x-auto px-5 pb-1">{children}</div>;
}

export function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-5 px-5 text-[11px] uppercase tracking-[0.08em] text-text-soft first:mt-0">{children}</div>;
}
