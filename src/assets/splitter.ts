/**
 * Asset Splitter
 *
 * Detects asset regions inside a sheet image, labels them by aspect, and
 * crops them via seamagic. PNG gets real region detection via alpha/luminance
 * projections; other formats fall back to aspect-aware grids.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { inflateSync } from "node:zlib";
import { safeFetchBuffer } from "../shared/url.js";

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectOptions {
  /** Minimum side length (px) for a region to count as a real asset. */
  minRegionPx: number;
  /** Activity threshold (0-1) for considering a row/col occupied. */
  threshold: number;
}

/**
 * Decode a PNG (8-bit, color types 0/2/3/4/6) into a luminance+alpha grid.
 * No external deps.
 */
function decodePng(buf: Buffer): { width: number; height: number; lum: Uint8Array; alpha: Uint8Array } | null {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8) return null; // 16-bit/sub-byte not supported here

  // Collect IDAT chunks
  let pos = 8;
  const idats: Buffer[] = [];
  let plte: Buffer | null = null;
  let trns: Buffer | null = null;
  while (pos < buf.length - 8) {
    const len = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString("ascii");
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === "IDAT") idats.push(data);
    else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (idats.length === 0) return null;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idats));
  } catch {
    return null;
  }

  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
  if (channels === 0) return null;
  const stride = width * channels;
  const expected = (stride + 1) * height;
  if (raw.length < expected) return null;

  // Unfilter rows
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const srcRow = y * (stride + 1);
    const filter = raw[srcRow];
    const dstRow = y * stride;
    const prevRow = y > 0 ? dstRow - stride : -1;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[dstRow + x - channels] : 0;
      const b = prevRow >= 0 ? out[prevRow + x] : 0;
      const c = prevRow >= 0 && x >= channels ? out[prevRow + x - channels] : 0;
      const v = raw[srcRow + 1 + x];
      let r: number;
      switch (filter) {
        case 0: r = v; break;
        case 1: r = (v + a) & 0xff; break;
        case 2: r = (v + b) & 0xff; break;
        case 3: r = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          r = (v + paeth) & 0xff;
          break;
        }
        default: r = v;
      }
      out[dstRow + x] = r;
    }
  }

  // Build luminance + alpha grids
  const lum = new Uint8Array(width * height);
  const alpha = new Uint8Array(width * height);
  if (colorType === 0) {
    for (let i = 0; i < width * height; i++) { lum[i] = out[i]; alpha[i] = 255; }
  } else if (colorType === 2) {
    for (let i = 0; i < width * height; i++) {
      const r = out[i * 3], g = out[i * 3 + 1], b = out[i * 3 + 2];
      lum[i] = (r * 76 + g * 150 + b * 29) >> 8;
      alpha[i] = 255;
    }
  } else if (colorType === 3) {
    if (!plte) return null;
    for (let i = 0; i < width * height; i++) {
      const idx = out[i];
      const r = plte[idx * 3], g = plte[idx * 3 + 1], b = plte[idx * 3 + 2];
      lum[i] = (r * 76 + g * 150 + b * 29) >> 8;
      alpha[i] = trns && idx < trns.length ? trns[idx] : 255;
    }
  } else if (colorType === 4) {
    for (let i = 0; i < width * height; i++) {
      lum[i] = out[i * 2];
      alpha[i] = out[i * 2 + 1];
    }
  } else if (colorType === 6) {
    for (let i = 0; i < width * height; i++) {
      const r = out[i * 4], g = out[i * 4 + 1], b = out[i * 4 + 2];
      lum[i] = (r * 76 + g * 150 + b * 29) >> 8;
      alpha[i] = out[i * 4 + 3];
    }
  }
  return { width, height, lum, alpha };
}

/**
 * Detect content regions by finding gutters (runs of empty rows/cols) and
 * computing a connected-component-like row/column split.
 *
 * Returns absolute pixel bounding boxes.
 */
export async function detectRegions(
  buffer: Buffer,
  dims: { width: number; height: number; format: string },
  opts: DetectOptions
): Promise<Region[]> {
  if (dims.format !== "png") {
    return aspectAwareGrid(dims);
  }
  const decoded = decodePng(buffer);
  if (!decoded) return aspectAwareGrid(dims);

  const { width: W, height: H, lum, alpha } = decoded;

  // Per-row and per-column "occupancy": fraction of pixels that are non-empty.
  // A pixel is "occupied" if it has alpha > 16 AND luminance is not pure background.
  // We pick the corner pixel as the assumed background.
  const bg = lum[0];
  const rowOccupancy = new Float32Array(H);
  const colOccupancy = new Float32Array(W);
  for (let y = 0; y < H; y++) {
    let count = 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (alpha[i] < 16) continue;
      if (Math.abs(lum[i] - bg) < 8) continue;
      count++;
      colOccupancy[x] += 1;
    }
    rowOccupancy[y] = count / W;
  }
  for (let x = 0; x < W; x++) colOccupancy[x] /= H;

  const rowSpans = findOccupiedSpans(rowOccupancy, opts.threshold, opts.minRegionPx);
  if (rowSpans.length === 0) return aspectAwareGrid(dims);

  const regions: Region[] = [];
  for (const [y0, y1] of rowSpans) {
    // Within each horizontal strip, find column spans
    const stripCols = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      let count = 0;
      for (let y = y0; y < y1; y++) {
        const i = y * W + x;
        if (alpha[i] < 16) continue;
        if (Math.abs(lum[i] - bg) < 8) continue;
        count++;
      }
      stripCols[x] = count / (y1 - y0);
    }
    const colSpans = findOccupiedSpans(stripCols, opts.threshold, opts.minRegionPx);
    for (const [x0, x1] of colSpans) {
      regions.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }

  if (regions.length === 0) return aspectAwareGrid(dims);
  return regions;
}

function findOccupiedSpans(occ: Float32Array, threshold: number, minLen: number): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i < occ.length; i++) {
    const active = occ[i] > threshold;
    if (active && start < 0) start = i;
    else if (!active && start >= 0) {
      if (i - start >= minLen) spans.push([start, i]);
      start = -1;
    }
  }
  if (start >= 0 && occ.length - start >= minLen) spans.push([start, occ.length]);
  return spans;
}

function aspectAwareGrid(dims: { width: number; height: number }): Region[] {
  const aspect = dims.width / dims.height;
  // Square-ish → 4×4 icon grid; wide → 1×4 banner row; tall → 4×1.
  const cols = aspect > 2.5 ? 4 : aspect > 1.3 ? 3 : aspect < 0.4 ? 1 : aspect < 0.75 ? 1 : 4;
  const rows = aspect > 2.5 ? 1 : aspect > 1.3 ? 1 : aspect < 0.4 ? 4 : aspect < 0.75 ? 3 : 4;
  const cellW = Math.floor(dims.width / cols);
  const cellH = Math.floor(dims.height / rows);
  const out: Region[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: c * cellW, y: r * cellH, w: cellW, h: cellH });
    }
  }
  return out;
}

/**
 * Label a region by aspect + size: icon, square, hero, banner, portrait, etc.
 */
export function labelRegion(w: number, h: number): string {
  if (w === 0 || h === 0) return "unknown";
  const aspect = w / h;
  const small = Math.max(w, h) < 96;
  if (small && Math.abs(aspect - 1) < 0.15) return "icon";
  if (Math.abs(aspect - 1) < 0.1) return "square";
  if (aspect > 3.5) return "ultrawide-banner";
  if (aspect > 2.0) return "banner";
  if (aspect > 1.5) return "hero";
  if (aspect > 1.15) return "landscape";
  if (aspect < 0.3) return "tall-banner";
  if (aspect < 0.5) return "tall-portrait";
  if (aspect < 0.85) return "portrait";
  return "tile";
}

function locateSeamagic(): string | null {
  const which = spawnSync("which", ["seamagic"], { encoding: "utf-8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  return null;
}

/**
 * Crop a region from a source URL into a local file via seamagic.
 * Source can be a URL or a local path. Returns the output path on success.
 */
export async function cropWithSeamagic(
  src: string,
  outDir: string,
  name: string,
  region: Region
): Promise<string | null> {
  const seamagic = locateSeamagic();
  if (!seamagic) return null;

  mkdirSync(outDir, { recursive: true });

  // Materialize source locally if it's an URL
  let inputPath = src;
  if (/^https?:/i.test(src)) {
    try {
      const { data } = await safeFetchBuffer(src, { timeoutMs: 15_000 });
      const { writeFileSync } = await import("node:fs");
      const ext = src.toLowerCase().match(/\.(png|jpe?g|webp|gif)(\?|$)/)?.[1] || "png";
      inputPath = join(outDir, `_source.${ext}`);
      mkdirSync(dirname(inputPath), { recursive: true });
      writeFileSync(inputPath, data);
    } catch {
      return null;
    }
  }

  const ext = (inputPath.toLowerCase().match(/\.(png|jpe?g|webp|gif)(\?|$)/)?.[1] || "png").replace("jpeg", "jpg");
  const output = join(outDir, `${name}.${ext}`);

  const result = spawnSync(
    seamagic,
    [
      "crop",
      "-i", inputPath,
      "-o", output,
      "--x", String(Math.round(region.x)),
      "--y", String(Math.round(region.y)),
      "--width", String(Math.round(region.w)),
      "--height", String(Math.round(region.h)),
    ],
    { encoding: "utf-8" }
  );
  if (result.status !== 0) {
    console.warn(`[splitter] seamagic crop failed: ${result.stderr || result.stdout}`);
    return null;
  }
  return output;
}
