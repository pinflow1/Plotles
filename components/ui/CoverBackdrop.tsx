"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCoverArt, peekCoverArt, type CoverArt } from "@/lib/cover-palette";

/**
 * The background art made from a cover (see lib/cover-palette.ts), or null
 * while there is no cover or it is still being worked out. When the cover
 * changes, the previous cover's art stays until the new one is ready, so the
 * screen never flashes back to neutral in between.
 */
export function useCoverArt(src: string | null | undefined): CoverArt | null {
  // Art made earlier in this visit is there from the first render. After a
  // fresh page load nothing is cached yet, which matches what the server drew.
  const [art, setArt] = useState<CoverArt | null>(() => (src ? peekCoverArt(src) : null));

  useEffect(() => {
    if (!src) {
      setArt(null);
      return;
    }
    const cached = peekCoverArt(src);
    if (cached) {
      setArt(cached);
      return;
    }
    let cancelled = false;
    loadCoverArt(src).then((next) => {
      if (!cancelled) setArt(next);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return art;
}

type Layer = { id: number; art: CoverArt; state: "in" | "idle" | "out" };

const FADE_IN_MS = 700;
const FADE_OUT_MS = 500;
const KEYFRAMES =
  "@keyframes plotless-cover-in{from{opacity:0}to{opacity:1}}@keyframes plotless-cover-out{from{opacity:1}to{opacity:0}}";

function cssUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

let grainUrl: string | null = null;

/**
 * A small tile of noise so faint (a shift of 0–3 shades out of 255) that it
 * can't be seen as noise. A smooth, dark gradient on an 8-bit screen breaks
 * into visible bands; this scatters the edges between them so it doesn't.
 */
function makeGrain(): string | null {
  if (grainUrl) return grainUrl;
  try {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const shade = Math.random() < 0.5 ? 0 : 255;
      image.data[i * 4] = shade;
      image.data[i * 4 + 1] = shade;
      image.data[i * 4 + 2] = shade;
      image.data[i * 4 + 3] = Math.floor(Math.random() * 4);
    }
    ctx.putImageData(image, 0, 0);
    grainUrl = canvas.toDataURL("image/png");
    return grainUrl;
  } catch {
    return null;
  }
}

/** The layers to draw once `art` is what should be showing. A new cover goes on top and fades in over the old one. */
function reconcile(layers: Layer[], art: CoverArt | null, id: number): Layer[] {
  const showing = layers.filter((l) => l.state !== "out");
  const top = showing[showing.length - 1];
  if ((top ? top.art : null) === art) return layers;
  if (!art) return layers.map((l) => (l.state === "out" ? l : { ...l, state: "out" as const }));
  return [...layers, { id, art, state: "in" as const }];
}

/**
 * A soft, full-screen background made from a story's cover, fixed behind the
 * page. With no cover it is just the theme's plain paper colour, so a page
 * looks exactly as it did before it had one.
 *
 * Put it first inside the page, and don't give the page its own background —
 * it would cover this. Changing `src` cross-fades to the new cover.
 */
export function CoverBackdrop({ src }: { src?: string | null }) {
  const art = useCoverArt(src);
  const [layers, setLayers] = useState<Layer[]>(() => (art ? [{ id: 1, art, state: "idle" }] : []));
  const [grain, setGrain] = useState<string | null>(null);
  const nextId = useRef(2);

  useEffect(() => {
    const id = nextId.current++;
    setLayers((current) => reconcile(current, art, id));
  }, [art]);

  useEffect(() => {
    setGrain(makeGrain());
  }, []);

  // A layer that has finished fading in hides everything beneath it; one that
  // has finished fading out is done.
  const settle = useCallback((id: number, from: Layer["state"]) => {
    setLayers((current) => {
      if (from === "out") return current.filter((l) => l.id !== id);
      if (from === "in") {
        return current.filter((l) => l.id >= id).map((l) => (l.id === id ? { ...l, state: "idle" as const } : l));
      }
      return current;
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-paper transition-colors duration-300"
    >
      <style>{KEYFRAMES}</style>
      {layers.map((layer) => (
        <ArtLayer key={layer.id} layer={layer} onSettled={settle} />
      ))}
      {grain && layers.length > 0 && (
        <div className="absolute inset-0" style={{ backgroundImage: cssUrl(grain), backgroundSize: "64px 64px" }} />
      )}
    </div>
  );
}

function ArtLayer({ layer, onSettled }: { layer: Layer; onSettled: (id: number, from: Layer["state"]) => void }) {
  const { art, state } = layer;
  const animation =
    state === "in"
      ? `plotless-cover-in ${FADE_IN_MS}ms ease-out both`
      : state === "out"
        ? `plotless-cover-out ${FADE_OUT_MS}ms ease-in both`
        : undefined;

  return (
    <div
      className="absolute inset-0"
      style={{ animation }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onSettled(layer.id, state);
      }}
    >
      {art.kind === "tone" ? (
        <>
          {/* Each theme gets its own pre-toned image; the .dark class on <html> picks one without any script. */}
          <div className="absolute inset-0 dark:hidden" style={{ backgroundImage: cssUrl(art.light), backgroundSize: "100% 100%" }} />
          <div className="absolute inset-0 hidden dark:block" style={{ backgroundImage: cssUrl(art.dark), backgroundSize: "100% 100%" }} />
        </>
      ) : (
        <>
          {/* The browser wouldn't let us read this cover's colours: blur it with CSS and lay the paper colour over it. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: cssUrl(art.src),
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(48px) saturate(1.2)",
              transform: "scale(1.3)",
            }}
          />
          <div className="absolute inset-0" style={{ background: "var(--paper)", opacity: 0.84 }} />
        </>
      )}
    </div>
  );
}
