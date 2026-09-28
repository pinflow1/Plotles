"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type FontChoice = "serif" | "serif-classic" | "sans";
export type LineSpacing = "compact" | "comfortable" | "spacious";

export const FONT_LABELS: Record<FontChoice, string> = {
  serif: "Fraunces",
  "serif-classic": "Source Serif",
  sans: "Clean Sans",
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
  const SYSTEM_SANS_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--ms-size", `${prefs.textSize}px`);
    root.setProperty("--ms-lh", LINE_SPACING_VALUES[prefs.lineSpacing]);
    const fontVar =
      prefs.fontFamily === "serif" ? "var(--font-fraunces)" : prefs.fontFamily === "serif-classic" ? "var(--font-source-serif)" : SYSTEM_SANS_STACK;
    root.setProperty("--manuscript-font", fontVar);
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
