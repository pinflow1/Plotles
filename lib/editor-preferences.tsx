"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// The five Plotless originals, plus the standard Word/Office font list.
// Word's fonts are proprietary (Microsoft/Monotype) and aren't available
// to self-host, so they're referenced as plain system font-family stacks
// (exactly how Word itself resolves them) rather than loaded via
// next/font/google — they'll render correctly wherever the reader's OS
// already has them installed, and fall back gracefully where it doesn't.
export type FontChoice =
  | "serif"
  | "serif-classic"
  | "serif-warm"
  | "serif-reading"
  | "mono"
  | "sans"
  | "times-new-roman"
  | "cambria"
  | "georgia"
  | "garamond"
  | "book-antiqua"
  | "bookman-old-style"
  | "palatino"
  | "constantia"
  | "rockwell"
  | "calibri"
  | "arial"
  | "segoe-ui"
  | "tahoma"
  | "verdana"
  | "trebuchet-ms"
  | "candara"
  | "corbel"
  | "century-gothic"
  | "franklin-gothic"
  | "courier-new"
  | "consolas"
  | "comic-sans"
  | "impact";

export type LineSpacing = "compact" | "comfortable" | "spacious";

export const FONT_LABELS: Record<FontChoice, string> = {
  serif: "Fraunces",
  "serif-classic": "Source Serif",
  "serif-warm": "Lora",
  "serif-reading": "Literata",
  mono: "Typewriter",
  sans: "Clean Sans",
  "times-new-roman": "Times New Roman",
  cambria: "Cambria",
  georgia: "Georgia",
  garamond: "Garamond",
  "book-antiqua": "Book Antiqua",
  "bookman-old-style": "Bookman Old Style",
  palatino: "Palatino Linotype",
  constantia: "Constantia",
  rockwell: "Rockwell",
  calibri: "Calibri",
  arial: "Arial",
  "segoe-ui": "Segoe UI",
  tahoma: "Tahoma",
  verdana: "Verdana",
  "trebuchet-ms": "Trebuchet MS",
  candara: "Candara",
  corbel: "Corbel",
  "century-gothic": "Century Gothic",
  "franklin-gothic": "Franklin Gothic Medium",
  "courier-new": "Courier New",
  consolas: "Consolas",
  "comic-sans": "Comic Sans MS",
  impact: "Impact",
};

// CSS var (or system stack) each choice resolves to on the manuscript.
// Exported so the font picker can preview each entry inline without
// needing a bespoke Tailwind class per font.
const SYSTEM_SANS_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';
export const FONT_VARS: Record<FontChoice, string> = {
  // Plotless originals — self-hosted via next/font/google in app/layout.tsx.
  serif: "var(--font-fraunces)",
  "serif-classic": "var(--font-source-serif)",
  "serif-warm": "var(--font-lora)",
  "serif-reading": "var(--font-literata)",
  mono: "var(--font-mono)",
  sans: SYSTEM_SANS_STACK,
  // Word/Office fonts — system stacks, same as Word itself resolves them.
  "times-new-roman": '"Times New Roman", Times, Georgia, serif',
  cambria: 'Cambria, Georgia, "Times New Roman", serif',
  georgia: 'Georgia, "Times New Roman", serif',
  garamond: 'Garamond, "Times New Roman", serif',
  "book-antiqua": '"Book Antiqua", Palatino, "Palatino Linotype", serif',
  "bookman-old-style": '"Bookman Old Style", Bookman, Georgia, serif',
  palatino: '"Palatino Linotype", Palatino, Georgia, serif',
  constantia: "Constantia, Georgia, serif",
  rockwell: 'Rockwell, "Courier New", serif',
  calibri: '"Calibri", "Carlito", "Segoe UI", sans-serif',
  arial: "Arial, Helvetica, sans-serif",
  "segoe-ui": '"Segoe UI", "Helvetica Neue", Helvetica, sans-serif',
  tahoma: "Tahoma, Verdana, sans-serif",
  verdana: "Verdana, Geneva, sans-serif",
  "trebuchet-ms": '"Trebuchet MS", Helvetica, sans-serif',
  candara: "Candara, Calibri, sans-serif",
  corbel: "Corbel, Calibri, sans-serif",
  "century-gothic": '"Century Gothic", "Apple Gothic", sans-serif',
  "franklin-gothic": '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif',
  "courier-new": '"Courier New", Courier, monospace',
  consolas: 'Consolas, "Courier New", monospace',
  "comic-sans": '"Comic Sans MS", "Comic Sans", cursive',
  impact: 'Impact, "Arial Narrow Bold", sans-serif',
};

export const LINE_SPACING_VALUES: Record<LineSpacing, string> = {
  compact: "1.35",
  comfortable: "1.72",
  spacious: "2.05",
};

const MIN_SIZE = 14;
const MAX_SIZE = 24;
const STORAGE_KEY = "plotless-writing-prefs";

type Persisted = { fontFamily: FontChoice; textSize: number; lineSpacing: LineSpacing };
const DEFAULTS: Persisted = { fontFamily: "serif", textSize: 17, lineSpacing: "comfortable" };

type EditorPreferencesValue = Persisted & {
  focusMode: boolean;
  setFontFamily: (f: FontChoice) => void;
  setTextSize: (n: number) => void;
  nudgeTextSize: (delta: 1 | -1) => void;
  setLineSpacing: (s: LineSpacing) => void;
  setFocusMode: (on: boolean) => void;
};

const EditorPreferencesContext = createContext<EditorPreferencesValue | null>(null);

export function EditorPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Persisted>(DEFAULTS);
  const [focusMode, setFocusModeState] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setPrefs({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch {
      // ignore malformed storage
    }
  }, []);

  // Push the writing-environment prefs onto the CSS variables the
  // manuscript's typography reads, same as the prototype.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--ms-size", `${prefs.textSize}px`);
    root.setProperty("--ms-lh", LINE_SPACING_VALUES[prefs.lineSpacing]);
    root.setProperty("--manuscript-font", FONT_VARS[prefs.fontFamily]);
  }, [prefs]);

  const persist = useCallback((next: Persisted) => {
    setPrefs(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setFontFamily = useCallback(
    (f: FontChoice) => persist({ ...prefs, fontFamily: f }),
    [prefs, persist]
  );
  const setTextSize = useCallback(
    (n: number) => persist({ ...prefs, textSize: Math.max(MIN_SIZE, Math.min(MAX_SIZE, n)) }),
    [prefs, persist]
  );
  const nudgeTextSize = useCallback((delta: 1 | -1) => setTextSize(prefs.textSize + delta), [prefs.textSize, setTextSize]);
  const setLineSpacing = useCallback(
    (s: LineSpacing) => persist({ ...prefs, lineSpacing: s }),
    [prefs, persist]
  );

  // Focus mode closes the sheet/popover shortly after engaging, same
  // 240ms grace the prototype gives so the closing animation isn't cut off.
  const setFocusMode = useCallback((on: boolean) => setFocusModeState(on), []);

  const value = useMemo<EditorPreferencesValue>(
    () => ({ ...prefs, focusMode, setFontFamily, setTextSize, nudgeTextSize, setLineSpacing, setFocusMode }),
    [prefs, focusMode, setFontFamily, setTextSize, nudgeTextSize, setLineSpacing, setFocusMode]
  );

  return <EditorPreferencesContext.Provider value={value}>{children}</EditorPreferencesContext.Provider>;
}

export function useEditorPreferences() {
  const ctx = useContext(EditorPreferencesContext);
  if (!ctx) throw new Error("useEditorPreferences must be used within EditorPreferencesProvider");
  return ctx;
}
