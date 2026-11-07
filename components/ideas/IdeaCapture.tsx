"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Lightbulb, X } from "lucide-react";
import type { Idea } from "@prisma/client";
import { api, ApiError } from "@/lib/api-client";
import { useEditorPreferences } from "@/lib/editor-preferences";

// Signed-in screens only. A whitelist on purpose: login/register (and the "/"
// redirect) never show the button, and a new signed-in route has to opt in
// here. Left out on purpose: /ideas (that page is already a capture form) and
// /dashboard (its header already has its own lightbulb).
const SHOW_ON = ["/projects", "/settings", "/editor", "/collaborate"];

// How much of the bottom of the screen the on-screen keyboard covers. Fixed
// elements are anchored to the layout viewport, which the keyboard sits on
// top of — so anything that has to stay reachable while typing is lifted by
// this much.
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      // A browser toolbar sliding in or out moves this by a few dozen px, and
      // pinch-zoom shrinks the visual viewport too — neither is a keyboard.
      setInset(vv.scale <= 1.05 && covered > 100 ? Math.round(covered) : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

/**
 * Floating lightbulb: drop an idea from any signed-in screen without leaving
 * what you're doing. Mounted once in the root layout. Tap → small capture
 * sheet → Save; the idea goes to /api/ideas and the same
 * "plotless:idea-added" event the menu's quick-jot box uses, so the Ideas
 * page and the Dashboard preview pick it up at once.
 */
export function IdeaCapture() {
  const pathname = usePathname() ?? "";
  const { focusMode } = useEditorPreferences();
  const keyboard = useKeyboardInset();

  const [open, setOpen] = useState(false);
  // Kept across closing and reopening (and across screens) until it's saved,
  // so a stray tap on the backdrop never costs anyone their idea.
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const inEditor = pathname === "/editor" || pathname.startsWith("/editor/");
  const onSignedInScreen = SHOW_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // Focus Mode is one global setting that outlives the editor page, so it
  // only hides the button while you're actually in the editor.
  const visible = onSignedInScreen && !(inEditor && focusMode);

  // Moving to another screen closes the sheet; the draft stays.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(t);
  }, [saved]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function save() {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { idea } = await api.post<{ idea: Idea }>("/api/ideas", { body });
      setDraft("");
      setOpen(false);
      setSaved(true);
      window.dispatchEvent(new CustomEvent<Idea>("plotless:idea-added", { detail: idea }));
    } catch (err) {
      // The text stays in the box — a failed save loses nothing.
      setError(
        err instanceof ApiError ? err.message : "Couldn't reach Plotless. Your idea is still here — try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  // Resting spot is bottom-right. In the editor it sits above the swipe-up
  // handle strip (a full-width tap target along the bottom edge); elsewhere
  // just above the safe area. While the keyboard is up it rides on top of it.
  const resting = inEditor
    ? "calc(max(28px, env(safe-area-inset-bottom) + 20px) + 56px)"
    : "calc(env(safe-area-inset-bottom) + 16px)";
  const bottom = keyboard ? `${keyboard + 12}px` : resting;

  return (
    <>
      {/* Below the editor's selection toolbar (z-30), the quick-tools popover
          and both dimmers (z-40), and the drawer / writing-controls panels (z-50). */}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label="Capture an idea"
        style={{ bottom }}
        className="fixed right-4 z-[25] flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-divider bg-surface text-text shadow-[0_6px_18px_rgba(0,0,0,0.16)] transition-transform active:scale-95"
      >
        <Lightbulb size={19} strokeWidth={1.6} />
      </button>

      {saved && (
        <div
          role="status"
          style={{ bottom: `calc(${bottom} + 52px)` }}
          className="fixed right-4 z-[25] rounded-full bg-strong px-3 py-1.5 text-xs font-medium text-on-strong shadow-[0_6px_18px_rgba(0,0,0,0.16)]"
        >
          Saved to Ideas
        </div>
      )}

      {open && (
        <>
          <style>{`@keyframes idea-fade-in { from { opacity: 0; } to { opacity: 1; } } @keyframes idea-sheet-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[55] bg-overlay"
            style={{ animation: "idea-fade-in 180ms ease" }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New idea"
            style={{
              bottom: keyboard,
              paddingBottom: keyboard ? 16 : "calc(env(safe-area-inset-bottom) + 16px)",
              animation: "idea-sheet-in 180ms cubic-bezier(.32,.72,0,1)",
            }}
            className="fixed inset-x-0 z-[60] rounded-t-sheet bg-paper px-5 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.14)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold tracking-[0.16em] text-text">NEW IDEA</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-2 rounded-lg p-2 text-text-soft active:bg-active"
              >
                <X size={18} strokeWidth={1.6} />
              </button>
            </div>

            {/* 16px text on purpose: anything smaller makes iOS Safari zoom the page on focus. */}
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  save();
                }
              }}
              rows={4}
              aria-label="Idea"
              placeholder="A line, a character, a what-if…"
              className="w-full resize-none rounded-xl border border-divider bg-transparent px-3 py-2.5 text-base text-text outline-none placeholder:text-text-soft focus-visible:border-text"
            />

            {error && <p className="mt-2 text-sm text-text-soft">{error}</p>}

            <button
              type="button"
              onClick={save}
              disabled={!draft.trim() || saving}
              className="mt-3 flex w-full items-center justify-center rounded-xl bg-strong py-2.5 text-sm font-semibold text-on-strong disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save idea"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
