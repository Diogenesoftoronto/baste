import { deflateSync, inflateSync } from "node:zlib";
import { Resvg } from "@resvg/resvg-js";
import { falBytesInput, falDownloadBytes, falRun } from "../assets/fal.js";
import { parseImageDimensions } from "../shared/img-dims.js";
import { pool } from "./read.js";
import type { Box } from "./capture.js";

/**
 * Where things are. SAM 3 finds every instance of what the person names
 * ("icon", "the lantern illustration") and returns normalised boxes; Baste
 * crops them, cuts them out on transparency, and links each to the page
 * element it covers, if any, so the original file can be kept too.
 */

export interface Region {
  box: Box;
  score: number;
  maskUrl?: string;
  /** Every prompt that found this region, most confident first. */
  prompts: string[];
  /** The subject on transparency at the source's size, cropped to `box`; absent when the mask was unusable. */
  cutout?: Buffer;
}

export const SEGMENT = { model: "fal-ai/sam-3/image", maxPrompts: 6, maxPerPrompt: 12, minScore: 0.5, minSide: 10, mergeIoU: 0.6, maxCutouts: 24 } as const;

export function iou(a: Box, b: Box): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = x * y;
  return inter ? inter / (a.w * a.h + b.w * b.h - inter) : 0;
}

/** SAM's [cx, cy, w, h] in 0–1 as a pixel box inside the image. */
export function pixelBox(normalised: unknown, width: number, height: number): Box | null {
  if (!Array.isArray(normalised) || normalised.length !== 4 || !normalised.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [cx, cy, w, h] = normalised as number[];
  const x0 = Math.max(0, Math.round((cx - w / 2) * width)), y0 = Math.max(0, Math.round((cy - h / 2) * height));
  const x1 = Math.min(width, Math.round((cx + w / 2) * width)), y1 = Math.min(height, Math.round((cy + h / 2) * height));
  return x1 - x0 >= SEGMENT.minSide && y1 - y0 >= SEGMENT.minSide ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** Overlapping finds of one thing become one region; prompts that agree are kept together. */
export function mergeRegions(found: Array<Omit<Region, "prompts"> & { prompt: string }>): Region[] {
  const regions: Region[] = [];
  for (const f of [...found].sort((a, b) => b.score - a.score)) {
    const same = regions.find((r) => iou(r.box, f.box) >= SEGMENT.mergeIoU);
    if (same) { if (!same.prompts.includes(f.prompt)) same.prompts.push(f.prompt); continue; }
    regions.push({ box: f.box, score: f.score, prompts: [f.prompt], ...(f.maskUrl ? { maskUrl: f.maskUrl } : {}) });
  }
  return regions;
}

/** An image decoded once: crops copy rectangles of its pixels instead of re-decoding the whole page. */
export interface ImageRef {
  /** Layout size; boxes use it. */
  width: number;
  height: number;
  /** Pixel size, `scale` times the layout size. */
  pixelWidth: number;
  pixelHeight: number;
  scale: number;
  rgba: Buffer;
  /** The encoded image's own size. */
  native: { width: number; height: number };
}

/** Decode an image, at its own size or drawn to `pixels` (a mask decoded at a cheaper size). */
export function imageRef(data: Buffer, width: number, height: number, pixels?: { width: number; height: number }): ImageRef {
  const info = parseImageDimensions(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  if (!info || (info.format !== "png" && info.format !== "jpeg")) throw new Error("Not a PNG or JPEG image.");
  const href = `data:image/${info.format};base64,${data.toString("base64")}`;
  const size = pixels ?? info;
  const rendered = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><image width="${size.width}" height="${size.height}" preserveAspectRatio="none" href="${href}"/></svg>`, { fitTo: { mode: "original" } }).render();
  return { width, height, pixelWidth: rendered.width, pixelHeight: rendered.height, scale: rendered.width / width, rgba: rendered.pixels, native: { width: info.width, height: info.height } };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, "ascii");
  let crc = -1;
  for (const byte of [...head.subarray(4), ...data]) crc = CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const tail = Buffer.alloc(4); tail.writeInt32BE(~crc, 0);
  return Buffer.concat([head, data, tail]);
}

/** RGBA pixels as a PNG. */
export function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

/** Pixels of a layout rectangle, at the image's own density. */
function slice(image: ImageRef, x: number, y: number, w: number, h: number): { rgba: Buffer; width: number; height: number } {
  const px = Math.round(x * image.scale), py = Math.round(y * image.scale);
  const pw = Math.max(1, Math.min(image.pixelWidth - px, Math.round(w * image.scale)));
  const ph = Math.max(1, Math.min(image.pixelHeight - py, Math.round(h * image.scale)));
  const out = Buffer.alloc(pw * ph * 4);
  for (let row = 0; row < ph; row++) image.rgba.copy(out, row * pw * 4, ((py + row) * image.pixelWidth + px) * 4, ((py + row) * image.pixelWidth + px + pw) * 4);
  return { rgba: out, width: pw, height: ph };
}

/**
 * A rectangle of an image, padded a little so edges aren't clipped, at the
 * image's own density. Small things are enlarged towards `minSide` pixels (up
 * to 4× layout size); `maxSide` caps the longest side, for a model's input limit.
 */
export function crop(image: ImageRef, box: Box, opts: { pad?: number; minSide?: number; maxSide?: number } = {}): { png: Buffer; box: Box; width: number; height: number } {
  const pad = opts.pad ?? 6;
  const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
  const w = Math.min(image.width, box.x + box.w + pad) - x, h = Math.min(image.height, box.y + box.h + pad) - y;
  const raw = slice(image, x, y, w, h);
  // Enlarge small things by whole steps, pixel for pixel, up to 4× layout size: crisp, and no re-render.
  const zoom = Math.max(1, Math.min(Math.floor(4 / image.scale), Math.ceil((opts.minSide ?? 96) / Math.min(raw.width, raw.height))));
  if (opts.maxSide && Math.max(raw.width, raw.height) > opts.maxSide) {
    const png = encodePng(raw.rgba, raw.width, raw.height);
    const fit = opts.maxSide / Math.max(raw.width, raw.height);
    const rendered = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${raw.width}" height="${raw.height}"><image width="${raw.width}" height="${raw.height}" href="data:image/png;base64,${png.toString("base64")}"/></svg>`, { fitTo: { mode: "zoom", value: fit } }).render();
    return { png: rendered.asPng(), box: { x, y, w, h }, width: rendered.width, height: rendered.height };
  }
  const scaled = zoom > 1 ? enlarge(raw, zoom) : raw;
  return { png: encodePng(scaled.rgba, scaled.width, scaled.height), box: { x, y, w, h }, width: scaled.width, height: scaled.height };
}

/** Nearest-neighbour enlargement by a whole factor. */
function enlarge(raw: { rgba: Buffer; width: number; height: number }, n: number) {
  const width = raw.width * n, height = raw.height * n;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = Math.floor(y / n) * raw.width;
    for (let x = 0; x < width; x++) raw.rgba.copy(out, (y * width + x) * 4, (from + Math.floor(x / n)) * 4, (from + Math.floor(x / n)) * 4 + 4);
  }
  return { rgba: out, width, height };
}

/** A grayscale region of a mask. */
export interface MaskRegion { x: number; y: number; width: number; height: number; gray: Uint8Array }

/**
 * The rows and columns of an 8-bit grayscale, non-interlaced PNG inside a
 * pixel rectangle. SAM 3's masks are this shape and almost all black, so
 * inflating them is fast; it is the full RGBA decode that costs. Returns null
 * for any other PNG, so the caller can fall back to a full decode.
 */
export function readMaskRegion(png: Buffer, rect: { x: number; y: number; width: number; height: number }): { region: MaskRegion; width: number; height: number } | null {
  if (png.length < 33 || png.readUInt32BE(0) !== 0x89504e47 || png.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 0 || png[28] !== 0) return null;
  const parts: Buffer[] = [];
  for (let o = 8; o + 8 <= png.length;) {
    const length = png.readUInt32BE(o), type = png.toString("ascii", o + 4, o + 8);
    if (type === "IDAT") parts.push(png.subarray(o + 8, o + 8 + length));
    if (type === "IEND") break;
    o += 12 + length;
  }
  let raw: Buffer;
  try { raw = inflateSync(Buffer.concat(parts)); } catch { return null; }
  if (raw.length !== (width + 1) * height) return null;
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y);
  const x1 = Math.min(width, rect.x + rect.width), y1 = Math.min(height, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) return null;
  // PNG filters refer to the previous row, so rows above the region are still unfiltered.
  let prev = new Uint8Array(width), row = new Uint8Array(width);
  const gray = new Uint8Array((x1 - x0) * (y1 - y0));
  for (let y = 0; y < y1; y++) {
    const filter = raw[y * (width + 1)], line = raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1));
    for (let x = 0; x < width; x++) {
      const a = x ? row[x - 1] : 0, b = prev[x], c = x ? prev[x - 1] : 0, v = line[x];
      row[x] = filter === 0 ? v : filter === 1 ? v + a : filter === 2 ? v + b : filter === 3 ? v + ((a + b) >> 1)
        : v + (Math.abs(b - c) <= Math.abs(a - c) && Math.abs(b - c) <= Math.abs(a + b - 2 * c) ? b : Math.abs(a - c) <= Math.abs(a + b - 2 * c) ? a : c);
    }
    if (y >= y0) gray.set(row.subarray(x0, x1), (y - y0) * (x1 - x0));
    [prev, row] = [row, prev];
  }
  return { region: { x: x0, y: y0, width: x1 - x0, height: y1 - y0, gray }, width, height };
}

/**
 * The region alone on transparency: the mask's brightness becomes the crop's
 * alpha. SAM 3's masks match the source's pixel size; one that doesn't is
 * refused rather than misaligned. Pixels are copied, never re-rendered.
 */
export function regionCutout(image: ImageRef, mask: Buffer, box: Box, minSide = 96): Buffer | undefined {
  const pad = 2;
  const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
  const w = Math.min(image.width, box.x + box.w + pad) - x, h = Math.min(image.height, box.y + box.h + pad) - y;
  const pixels = slice(image, x, y, w, h);
  const px = Math.round(x * image.scale), py = Math.round(y * image.scale);
  let alphaAt: (col: number, row: number) => number;
  const fast = readMaskRegion(mask, { x: px, y: py, width: pixels.width, height: pixels.height });
  if (fast) {
    if (fast.width !== image.pixelWidth || fast.height !== image.pixelHeight) return undefined;
    const r = fast.region;
    alphaAt = (col, row) => r.gray[Math.min(r.height - 1, row) * r.width + Math.min(r.width - 1, col)];
  } else {
    let ref: ImageRef;
    try { ref = imageRef(mask, image.width, image.height); } catch { return undefined; }
    if (ref.pixelWidth !== image.pixelWidth || ref.pixelHeight !== image.pixelHeight) return undefined;
    const r = slice(ref, x, y, w, h);
    alphaAt = (col, row) => { const m = (Math.min(r.height - 1, row) * r.width + Math.min(r.width - 1, col)) * 4; return Math.round((r.rgba[m] + r.rgba[m + 1] + r.rgba[m + 2]) / 3); };
  }
  let covered = 0;
  for (let i = 0; i < pixels.rgba.length; i += 4) {
    const p = i / 4, a = alphaAt(p % pixels.width, Math.floor(p / pixels.width));
    pixels.rgba[i + 3] = Math.round((pixels.rgba[i + 3] * a) / 255);
    if (a > 127) covered++;
  }
  if (!covered) return undefined;
  const zoom = Math.max(1, Math.min(Math.floor(4 / image.scale), Math.ceil(minSide / Math.min(pixels.width, pixels.height))));
  const out = zoom > 1 ? enlarge(pixels, zoom) : pixels;
  return encodePng(out.rgba, out.width, out.height);
}

interface SamOutput {
  masks?: Array<{ url?: string } | null>;
  boxes?: unknown[] | null;
  scores?: Array<number | null> | null;
  metadata?: Array<{ index?: number; score?: number | null; box?: unknown } | null> | null;
}

/** Find what each prompt names. A prompt that fails is skipped, not fatal. */
export async function findRegions(image: { png: Buffer; width: number; height: number; ref?: ImageRef }, prompts: string[], opts: { falKey?: string; signal?: AbortSignal; onPrompt?: (prompt: string, count: number) => void } = {}): Promise<{ regions: Region[]; failed: string[] }> {
  const imageUrl = await falBytesInput(image.png, "image/png", { key: opts.falKey });
  const failed: string[] = [];
  const perPrompt = await pool(prompts.slice(0, SEGMENT.maxPrompts), 3, async (prompt) => {
    if (opts.signal?.aborted) return [];
    try {
      const result = await falRun<SamOutput>(SEGMENT.model, {
        image_url: imageUrl, prompt, apply_mask: false, output_format: "png",
        return_multiple_masks: true, max_masks: SEGMENT.maxPerPrompt, include_scores: true, include_boxes: true,
      }, { key: opts.falKey, timeoutMs: 120_000 });
      const masks = result.masks ?? [];
      const found: Array<Omit<Region, "prompts"> & { prompt: string }> = [];
      for (let i = 0; i < Math.max(masks.length, result.boxes?.length ?? 0); i++) {
        const meta = result.metadata?.find((m) => m?.index === i) ?? result.metadata?.[i];
        const score = meta?.score ?? result.scores?.[i] ?? 0;
        const box = pixelBox(result.boxes?.[i] ?? meta?.box, image.width, image.height);
        if (box && score >= SEGMENT.minScore) found.push({ box, score, prompt, ...(masks[i]?.url ? { maskUrl: masks[i]!.url } : {}) });
      }
      opts.onPrompt?.(prompt, found.length);
      return found;
    } catch {
      failed.push(prompt);
      return [];
    }
  });
  const regions = mergeRegions(perPrompt.flat());
  // Cut out only the merged regions, the best first.
  const ref = image.ref ?? imageRef(image.png, image.width, image.height);
  // Downloads overlap; decoding a mask is synchronous work, so wider pools gain little beyond this.
  await pool(regions.slice(0, SEGMENT.maxCutouts), 8, async (region) => {
    if (!region.maskUrl || opts.signal?.aborted) return;
    try { region.cutout = regionCutout(ref, await falDownloadBytes(region.maskUrl, 32 * 1024 * 1024), region.box); }
    catch { /* the rectangular crop is still kept */ }
  });
  for (const region of regions) delete region.maskUrl;
  return { regions, failed };
}
