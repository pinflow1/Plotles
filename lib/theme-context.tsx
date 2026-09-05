"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "plotless-theme";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  /** Full 3-way control — used by Settings' Appearance row. */
  setMode: (mode: ThemeMode) => void;
  /** Quick 2-way control — used by the bottom sheet's Environment toggle.
   *  Sets an explicit light/dark, overriding "system" if that was active,
   *  same as the prototype's themeLight/themeDark buttons. */
  toggleLightDark: (next: ResolvedTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  const apply = useCallback((next: ResolvedTheme) => {
    setResolvedTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#111111" : "#D8D2C4");
  }, []);

  const resolve = useCallback(
    (m: ThemeMode) => apply(m === "system" ? (systemPrefersDark() ? "dark" : "light") : m),
    [apply]
  );

  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      window.localStorage.setItem(STORAGE_KEY, m);
      resolve(m);
    },
    [resolve]
  );

  const toggleLightDark = useCallback((next: ResolvedTheme) => setMode(next), [setMode]);

  // Restore saved preference on mount.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initial = saved ?? "system";
    setModeState(initial);
    resolve(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-track OS preference while in "system" mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, apply]);

  const value = useMemo(
    () => ({ mode, resolvedTheme, setMode, toggleLightDark }),
    [mode, resolvedTheme, setMode, toggleLightDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
