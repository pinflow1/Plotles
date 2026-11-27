/**
 * Turns a project's cover image into the soft background the Project and
 * Dashboard screens sit on.
 *
 * What it does, in order:
 *  1. Shrinks the cover to a small sample and reads its pixels (canvas).
 *  2. Pulls out the 2–3 most prominent colours (`extractPalette`).
 *  3. Builds a heavily blurred copy of the cover, once for each theme, and
 *     squeezes its lightness into a narrow band so text on top of it stays
 *     readable no matter what the cover looks like:
 *       - light theme: never darker than the beige paper, so it is only ever a
 *         lighter, tinted version of it;
 *       - dark theme: stays deep, and below the lightness of the cards.
 *     The colour of the cover is kept (hue, boosted a little), the brightness
 *     is not — that is the "darkened / lightened" part.
 *  4. Fades the bottom of that blurred copy toward the cover's dominant colour,
 *     so the lower part of the screen, where the lists sit, is calm.
 *
 * The result is two tiny PNGs (a few KB each) that the browser stretches over
 * the screen. Nothing here uses a library.
 *
 * If the browser won't let us read the cover's pixels, `loadCoverArt` falls
 * back to `{ kind: "plain" }`, and the backdrop blurs the cover with CSS under a
 * heavy veil instead. If the cover can't be loaded at all it resolves to null,
 * which means "no backdrop": the neutral beige / grey.
 *
 * The colour maths is OKLab (Björn Ottosson), the same space CSS `oklab()` uses.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoverPalette = {
  /** The most dominant colour of the cover, as "#rrggbb". */
  dominant: string;
  /** Up to three prominent colours, dominant first, as "#rrggbb". */
  colors: string[];
};

export type CoverArt =
  | {
      kind: "tone";
      palette: CoverPalette;
      /** Tiny pre-blurred background images (PNG data URLs), one toned for each theme. */
      light: string;
      dark: string;
    }
  | {
      /** The pixels couldn't be read; blur the original under a veil instead. */
      kind: "plain";
      src: string;
    };

/** Anything shaped like canvas ImageData: RGBA bytes, row after row. */
export type Pixels = { data: ArrayLike<number>; width: number; height: number };

type Lab = [number, number, number];

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** r, g, b as 0–255 → OKLab [L, a, b]. */
export function rgbToOklab(r: number, g: number, b: number): Lab {
  const lr = SRGB_TO_LINEAR[Math.round(clamp(r, 0, 255))];
  const lg = SRGB_TO_LINEAR[Math.round(clamp(g, 0, 255))];
  const lb = SRGB_TO_LINEAR[Math.round(clamp(b, 0, 255))];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → linear-light sRGB, not clamped (can fall outside 0–1). */
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToByte(c: number): number {
  const v = c <= 0 ? 0 : c >= 1 ? 1 : c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

function inGamut(lin: [number, number, number]): boolean {
  const e = 0.0005;
  return lin[0] >= -e && lin[0] <= 1 + e && lin[1] >= -e && lin[1] <= 1 + e && lin[2] >= -e && lin[2] <= 1 + e;
}

/** OKLab → sRGB bytes. A colour outside sRGB loses chroma (not lightness or hue) until it fits. */
export function oklabToBytes(L: number, a: number, b: number): [number, number, number] {
  let lin = oklabToLinear(L, a, b);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinear(L, a * mid, b * mid))) lo = mid;
      else hi = mid;
    }
    lin = oklabToLinear(L, a * lo, b * lo);
  }
  return [linearToByte(lin[0]), linearToByte(lin[1]), linearToByte(lin[2])];
}

function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hexToOklab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  return rgbToOklab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/** How far apart two colours look. Hue counts for more than brightness, so pale pink and pale mint stay two colours. */
function labDistance(x: Lab, y: Lab): number {
  return Math.hypot(x[0] - y[0], 1.6 * (x[1] - y[1]), 1.6 * (x[2] - y[2]));
}

// ---------------------------------------------------------------------------
// Palette: the prominent colours
// ---------------------------------------------------------------------------

/** Two palette colours closer than this (OKLab distance) count as the same colour. */
const SEED_DISTANCE = 0.1;
/** Colours within this distance of a palette colour are averaged into it. */
const MERGE_DISTANCE = 0.14;

/**
 * The 2–3 most prominent colours of a picture, dominant first.
 *
 * Pixels are grouped into 4,096 colour bins and each bin is scored by how
 * many pixels it holds, boosted when the colour is vivid and dampened when it
 * is nearly black or white — so a red title on a black cover yields red as
 * well as black, rather than three shades of black.
 *
 * Returns null when the picture has no opaque pixels.
 */
export function extractPalette(pixels: Pixels, maxColors = 3): CoverPalette | null {
  const { data, width, height } = pixels;
  const count = new Float64Array(4096);
  const sumR = new Float64Array(4096);
  const sumG = new Float64Array(4096);
  const sumB = new Float64Array(4096);
  let seen = 0;

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    count[bin] += 1;
    sumR[bin] += r;
    sumG[bin] += g;
    sumB[bin] += b;
    seen++;
  }
  if (seen === 0) return null;

  type Bin = { n: number; lab: Lab; score: number };
  const bins: Bin[] = [];
  for (let k = 0; k < 4096; k++) {
    if (count[k] === 0) continue;
    const lab = rgbToOklab(sumR[k] / count[k], sumG[k] / count[k], sumB[k] / count[k]);
    const chroma = Math.hypot(lab[1], lab[2]);
    const edge = Math.min(lab[0], 1 - lab[0]); // how far from pure black / pure white
    const tonal = edge >= 0.12 ? 1 : 0.3 + 0.7 * (edge / 0.12);
    const vivid = 0.4 + 0.6 * Math.min(1, chroma / 0.12);
    bins.push({ n: count[k], lab, score: count[k] * tonal * vivid });
  }
  bins.sort((x, y) => y.score - x.score);

  const seeds: Bin[] = [];
  for (const bin of bins) {
    if (seeds.length >= maxColors) break;
    if (seeds.every((s) => labDistance(s.lab, bin.lab) >= SEED_DISTANCE)) seeds.push(bin);
  }

  // Average every nearby bin into its palette colour, so a colour split
  // across neighbouring bins comes out as one representative shade.
  const acc = seeds.map(() => ({ w: 0, L: 0, a: 0, b: 0 }));
  for (const bin of bins) {
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const d = labDistance(seeds[i].lab, bin.lab);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    if (best >= 0 && bestDistance <= MERGE_DISTANCE) {
      const slot = acc[best];
      slot.w += bin.n;
      slot.L += bin.lab[0] * bin.n;
      slot.a += bin.lab[1] * bin.n;
      slot.b += bin.lab[2] * bin.n;
    }
  }

  const colors = acc.filter((s) => s.w > 0).map((s) => toHex(oklabToBytes(s.L / s.w, s.a / s.w, s.b / s.w)));
  return colors.length > 0 ? { dominant: colors[0], colors } : null;
}

// ---------------------------------------------------------------------------
// Background: blurred, toned copy of the cover
// ---------------------------------------------------------------------------

export const ART_WIDTH = 32;
export const ART_HEIGHT = 48;

const BLUR_RADIUS = 4;
const BLUR_PASSES = 3;
/** The cover's colour is pushed a little, because blurring averages it toward grey. */
const CHROMA_BOOST = 1.3;
/** Narrowest lightness spread (before squeezing) we stretch to fill the band; flatter covers stay mid-band. */
const MIN_LIGHTNESS_RANGE = 0.14;
/** How far the bottom of the screen fades toward the dominant colour, and where the fade starts. */
const FADE_STRENGTH = 0.55;
const FADE_START = 0.4;

type Band = {
  /** Lightness (OKLab L) the background is squeezed into. */
  lMin: number;
  lMax: number;
  /** The most colour (OKLab chroma) the background may carry. */
  cMax: number;
  /** The theme's paper colour as OKLab a/b: a grey cover leans toward it rather than going cold. */
  paperA: number;
  paperB: number;
};

// Light: paper is clay #D8D2C4 (L ≈ 0.865), text is charcoal. Never go darker than paper.
const LIGHT_BAND: Band = { lMin: 0.865, lMax: 0.93, cMax: 0.058, paperA: 0.001, paperB: 0.02 };
// Dark: paper is #111111 (L ≈ 0.178), cards are #242424 (L ≈ 0.26). Stay between, under the cards.
const DARK_BAND: Band = { lMin: 0.15, lMax: 0.235, cMax: 0.06, paperA: 0, paperB: 0 };

function boxBlurLine(src: Float32Array, dst: Float32Array, n: number, r: number, offset: number, stride: number) {
  const last = n - 1;
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += src[offset + clamp(i, 0, last) * stride];
  const inv = 1 / (2 * r + 1);
  for (let i = 0; i < n; i++) {
    dst[offset + i * stride] = sum * inv;
    sum += src[offset + clamp(i + r + 1, 0, last) * stride] - src[offset + clamp(i - r, 0, last) * stride];
  }
}

/** Repeated box blur (≈ gaussian), edges repeated outward so the borders keep their colour. */
function blurPlane(plane: Float32Array, w: number, h: number, radius: number, passes: number): Float32Array {
  const a = Float32Array.from(plane);
  const b = new Float32Array(plane.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) boxBlurLine(a, b, w, radius, y * w, 1); // rows: a → b
    for (let x = 0; x < w; x++) boxBlurLine(b, a, h, radius, x, w); // columns: b → a
  }
  return a;
}

type Field = { L: Float32Array; a: Float32Array; b: Float32Array };

/** Averages the pixels into ART_WIDTH × ART_HEIGHT cells, then blurs them heavily. */
function sampleField(pixels: Pixels): Field {
  const { data, width, height } = pixels;
  const size = ART_WIDTH * ART_HEIGHT;
  const nL = new Float32Array(size);
  const dL = new Float32Array(size);
  const nA = new Float32Array(size);
  const nB = new Float32Array(size);
  const dC = new Float32Array(size);

  for (let y = 0; y < height; y++) {
    const cy = Math.min(ART_HEIGHT - 1, Math.floor((y * ART_HEIGHT) / height));
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const alpha = data[o + 3] / 255;
      if (alpha < 0.05) continue;
      const cell = cy * ART_WIDTH + Math.min(ART_WIDTH - 1, Math.floor((x * ART_WIDTH) / width));
      const lab = rgbToOklab(data[o], data[o + 1], data[o + 2]);
      // Vivid pixels count for more when averaging colour, so a small bright
      // accent isn't washed out by a big dark area around it.
      const weight = alpha * (0.35 + 0.65 * Math.min(1, Math.hypot(lab[1], lab[2]) / 0.15));
      nL[cell] += lab[0] * alpha;
      dL[cell] += alpha;
      nA[cell] += lab[1] * weight;
      nB[cell] += lab[2] * weight;
      dC[cell] += weight;
    }
  }

  const bnL = blurPlane(nL, ART_WIDTH, ART_HEIGHT, BLUR_RADIUS, BLUR_PASSES);
  const bdL = blurPlane(dL, ART_WIDTH, ART_HEIGHT, BLUR_RADIUS, BLUR_PASSES);
  const bnA = blurPlane(nA, ART_WIDTH, ART_HEIGHT, BLUR_RADIUS, BLUR_PASSES);
  const bnB = blurPlane(nB, ART_WIDTH, ART_HEIGHT, BLUR_RADIUS, BLUR_PASSES);
  const bdC = blurPlane(dC, ART_WIDTH, ART_HEIGHT, BLUR_RADIUS, BLUR_PASSES);

  let meanL = 0.5;
  let totalWeight = 0;
  let totalL = 0;
  for (let i = 0; i < size; i++) {
    totalL += nL[i];
    totalWeight += dL[i];
  }
  if (totalWeight > 0) meanL = totalL / totalWeight;

  const L = new Float32Array(size);
  const a = new Float32Array(size);
  const b = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    L[i] = bdL[i] > 1e-6 ? bnL[i] / bdL[i] : meanL;
    a[i] = bdC[i] > 1e-6 ? bnA[i] / bdC[i] : 0;
    b[i] = bdC[i] > 1e-6 ? bnB[i] / bdC[i] : 0;
  }
  return { L, a, b };
}

/** RGBA bytes of the blurred field, toned into one theme's lightness / chroma band. */
function toneField(field: Field, dominant: Lab, band: Band): Uint8ClampedArray {
  const size = ART_WIDTH * ART_HEIGHT;
  const sorted = Float32Array.from(field.L).sort();
  const p5 = sorted[Math.floor(size * 0.05)];
  const p95 = sorted[Math.min(size - 1, Math.floor(size * 0.95))];
  const mid = (p5 + p95) / 2;
  const range = Math.max(p95 - p5, MIN_LIGHTNESS_RANGE);
  // A dark cover sits low in the band and a light one high, so the background
  // still reads as "darker" or "lighter" like the cover it came from.
  const lean = clamp((mid - 0.5) * 0.8, -0.4, 0.4);

  const tone = (L: number, a: number, b: number): Lab => {
    const lightness = band.lMin + (band.lMax - band.lMin) * clamp(0.5 + lean + (L - mid) / range, 0, 1);
    const chroma = Math.hypot(a, b);
    const scale = chroma > 1e-5 ? Math.min(chroma * CHROMA_BOOST, band.cMax) / chroma : 0;
    // Grey covers keep the paper's own warmth; colourful ones are left to their own colour.
    const paperWeight = 1 - 0.6 * Math.min(1, chroma / 0.06);
    return [lightness, a * scale + band.paperA * paperWeight, b * scale + band.paperB * paperWeight];
  };

  const end = tone(dominant[0], dominant[1], dominant[2]);
  const out = new Uint8ClampedArray(size * 4);
  for (let y = 0; y < ART_HEIGHT; y++) {
    const fade = FADE_STRENGTH * smoothstep(FADE_START, 1, (y + 0.5) / ART_HEIGHT);
    for (let x = 0; x < ART_WIDTH; x++) {
      const i = y * ART_WIDTH + x;
      const t = tone(field.L[i], field.a[i], field.b[i]);
      const rgb = oklabToBytes(
        t[0] + (end[0] - t[0]) * fade,
        t[1] + (end[1] - t[1]) * fade,
        t[2] + (end[2] - t[2]) * fade
      );
      out[i * 4] = rgb[0];
      out[i * 4 + 1] = rgb[1];
      out[i * 4 + 2] = rgb[2];
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

export type ToneArtPixels = {
  palette: CoverPalette;
  width: number;
  height: number;
  light: Uint8ClampedArray;
  dark: Uint8ClampedArray;
};

/** The whole pixel pipeline, with no DOM in it (so it can be tested anywhere). Null for an empty picture. */
export function buildToneArt(pixels: Pixels): ToneArtPixels | null {
  const palette = extractPalette(pixels);
  if (!palette) return null;
  const field = sampleField(pixels);
  const dominant = hexToOklab(palette.dominant);
  return {
    palette,
    width: ART_WIDTH,
    height: ART_HEIGHT,
    light: toneField(field, dominant, LIGHT_BAND),
    dark: toneField(field, dominant, DARK_BAND),
  };
}

// ---------------------------------------------------------------------------
// Browser side: load the cover, make the art, remember it
// ---------------------------------------------------------------------------

/** How much of the cover is looked at. Bigger than the art, so each art cell averages a few pixels. */
const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 96;
const MAX_CACHED = 24;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Covers are data URLs, so this only matters for a cover stored as a normal link.
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      // Decode now, off the main thread, rather than having the first drawImage do it while the page waits.
      const decoded = typeof img.decode === "function" ? img.decode() : Promise.resolve();
      decoded.catch(() => undefined).then(() => resolve(img));
    };
    img.onerror = () => reject(new Error("Couldn't read that cover."));
    img.src = src;
  });
}

/** A canvas that is only ever drawn on and read back, which the browser can keep on the CPU. */
function readbackContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext("2d", { willReadFrequently: true });
}

/** Scales an image down by halves, which averages properly in every browser (one big jump just skips pixels). */
function drawScaled(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement | null {
  let source: CanvasImageSource = img;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (!sw || !sh) return null;
  while (sw >= w * 2 && sh >= h * 2) {
    const nw = Math.max(w, Math.floor(sw / 2));
    const nh = Math.max(h, Math.floor(sh / 2));
    const step = document.createElement("canvas");
    step.width = nw;
    step.height = nh;
    const stepCtx = readbackContext(step);
    if (!stepCtx) return null;
    stepCtx.drawImage(source, 0, 0, nw, nh);
    source = step;
    sw = nw;
    sh = nh;
  }
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = readbackContext(out);
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  return out;
}

function toPngDataUrl(rgba: Uint8ClampedArray, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas.");
  const image = ctx.createImageData(w, h);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

async function buildCoverArt(src: string): Promise<CoverArt | null> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(src);
  } catch {
    return null;
  }
  try {
    const canvas = drawScaled(img, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    const ctx = canvas ? readbackContext(canvas) : null;
    if (!ctx) throw new Error("No canvas.");
    // Throws a SecurityError for a cover the browser won't let us read.
    const { data } = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    const art = buildToneArt({ data, width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT });
    if (!art) throw new Error("Empty cover.");
    return {
      kind: "tone",
      palette: art.palette,
      light: toPngDataUrl(art.light, art.width, art.height),
      dark: toPngDataUrl(art.dark, art.width, art.height),
    };
  } catch {
    return { kind: "plain", src };
  }
}

// A cover is a long data URL, so entries are keyed by its length plus a hash
// rather than holding the whole string.
let lastSrc = "";
let lastKey = "";
function cacheKey(src: string): string {
  if (src === lastSrc) return lastKey;
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  lastSrc = src;
  lastKey = `${src.length}:${(h >>> 0).toString(36)}`;
  return lastKey;
}

const pending = new Map<string, Promise<CoverArt | null>>();
const ready = new Map<string, CoverArt>();

/** The art for a cover if it has already been made this session, else null. Never starts any work. */
export function peekCoverArt(src: string): CoverArt | null {
  return ready.get(cacheKey(src)) ?? null;
}

/** Makes (or reuses) the art for a cover. Never rejects; resolves to null if the cover can't be loaded. */
export function loadCoverArt(src: string): Promise<CoverArt | null> {
  const key = cacheKey(src);
  const hit = pending.get(key);
  if (hit) return hit;

  const job = buildCoverArt(src).then((art) => {
    if (art) {
      ready.set(key, art);
      if (ready.size > MAX_CACHED) {
        const oldest = ready.keys().next().value;
        if (oldest !== undefined) {
          ready.delete(oldest);
          pending.delete(oldest);
        }
      }
    } else {
      pending.delete(key); // a cover that failed to load gets another try next time
    }
    return art;
  });
  pending.set(key, job);
  return job;
}
