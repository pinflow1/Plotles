"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FLICK_VELOCITY_THRESHOLD = 0.55; // px/ms — matches the prototype
const EASE = "cubic-bezier(.32,.72,0,1)";

type Axis = "y" | "x";

type UseDragSheetOptions = {
  axis: Axis;
  /** +1 for a panel that closes by moving further positive (bottom sheet, closes downward).
   *  -1 for a panel that closes by moving negative (left drawer, closes offscreen-left). */
  direction: 1 | -1;
  durationMs?: number;
  onOpenChange?: (open: boolean) => void;
};

export function useDragSheet({ axis, direction, durationMs = 300, onOpenChange }: UseDragSheetOptions) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dimmerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpenState] = useState(false);

  const size = useRef(0);
  const currentPx = useRef(0);
  const dragging = useRef(false);
  const start = useRef({ pos: 0, px: 0, t: 0 });
  const lastMove = useRef({ pos: 0, t: 0 });
  const velocity = useRef(0);

  const clientPos = (e: PointerEvent) => (axis === "y" ? e.clientY : e.clientX);
  const closedPx = useCallback(() => direction * size.current, [direction]);

  const paint = useCallback(
    (px: number, animate: boolean) => {
      currentPx.current = px;
      const panel = panelRef.current;
      if (panel) {
        panel.style.transition = animate ? `transform ${durationMs}ms ${EASE}` : "none";
        panel.style.transform = axis === "y" ? `translateY(${px}px)` : `translateX(${px}px)`;
      }
      const dimmer = dimmerRef.current;
      if (dimmer) {
        const denom = size.current || 1;
        const progress = Math.max(0, Math.min(1, Math.abs(px - closedPx()) / denom));
        dimmer.style.transition = animate ? `opacity ${durationMs}ms ease` : "none";
        dimmer.style.opacity = String(progress);
        dimmer.style.pointerEvents = progress > 0.02 ? "auto" : "none";
      }
    },
    [axis, durationMs, closedPx]
  );

  const measure = useCallback(() => {
    if (panelRef.current) {
      size.current = axis === "y" ? panelRef.current.offsetHeight : panelRef.current.offsetWidth;
    }
  }, [axis]);

  const setOpen = useCallback(
    (next: boolean, animate = true) => {
      measure();
      setOpenState(next);
      onOpenChange?.(next);
      paint(next ? 0 : closedPx(), animate);
    },
    [measure, paint, onOpenChange, closedPx]
  );

  // Place the panel off-screen before first paint.
  useEffect(() => {
    measure();
    paint(closedPx(), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      measure();
      const pos = clientPos(e.nativeEvent);
      start.current = { pos, px: currentPx.current, t: performance.now() };
      lastMove.current = { pos, t: start.current.t };
      velocity.current = 0;
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {
        /* not all targets support capture */
      }
    },
    [axis, measure]
  );

  useEffect(() => {
    function move(e: PointerEvent) {
      if (!dragging.current) return;
      const pos = clientPos(e);
      const now = performance.now();
      const dt = now - lastMove.current.t;
      if (dt > 0) velocity.current = (pos - lastMove.current.pos) / dt;
      lastMove.current = { pos, t: now };
      const lo = Math.min(0, closedPx());
      const hi = Math.max(0, closedPx());
      const px = Math.max(lo, Math.min(hi, start.current.px + (pos - start.current.pos)));
      paint(px, false);
    }
    function end() {
      if (!dragging.current) return;
      dragging.current = false;
      const isFlick = Math.abs(velocity.current) > FLICK_VELOCITY_THRESHOLD;
      const nextOpen = isFlick
        ? velocity.current * direction < 0
        : Math.abs(currentPx.current - closedPx()) > size.current * 0.5;
      setOpenState(nextOpen);
      onOpenChange?.(nextOpen);
      paint(nextOpen ? 0 : closedPx(), true);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
  }, [axis, direction, paint, onOpenChange, closedPx]);

  return { panelRef, dimmerRef, open, setOpen, startDrag };
}
