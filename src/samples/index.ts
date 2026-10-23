import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Persona } from "../persona/types.js";
import { safeFetchBuffer } from "../shared/url.js";
import { parseImageDimensions } from "../shared/img-dims.js";
import { CAPTURE, capturePage, type Box, type DomElement, type PageCapture, type PageStyles } from "./capture.js";
import { crop, findRegions, imageRef, iou } from "./regions.js";
import { judge, pool, readPage, readText, reader, reasons, traitsOf, type Judgement, type PageReading, type Reader, type Trait } from "./read.js";

/**
 * Sampling a site: capture its first screens, find what the person asks for
 * (and logos, icons, imagery and controls by default) with SAM 3, link each
 * find to the original file the page used when there is one, read the words
 * in it and judge how much the audience would want it, and why, with Clairic.
 *
 * Every number shown comes from a measurement or a calibrated estimate:
 * colours and type from the DOM, positions from SAM, words and relevance from
 * Clairic. Nothing here writes prose about the design.
 */

export const DEFAULT_LOOK_FOR = ["logo", "icon", "illustration or photo", "button"] as const;
export const SAMPLE_LIMITS = { lookFor: 6, lookForChars: 60, judged: 18, clairicConcurrency: 4 } as const;

export interface SampleOriginal {
  kind: "image" | "svg" | "background";
  /** Remote URL of an image the page loaded. */
  src?: string;
  /** Saved file name under the run, for inline SVG. */
  file?: string;
  alt?: string;
}

export interface Sample {
  id: string;
  box: Box;
  /** What found it: SAM prompts, or "page" for DOM-only finds. */
  foundBy: string[];
  score: number;
  /** File names under the run directory. */
  crop: string;
  cutout?: string;
  original?: SampleOriginal;
  text?: string;
  judgement?: Judgement;
}

export interface SampleRun {
  schemaVersion: 1;
  id: string;
  url: string;
  finalUrl: string;
  title: string;
  personaId: string;
  lookFor: string[];
  createdAt: string;
  screenshot: string;
  width: number;
  height: number;
  scale: number;
  styles: PageStyles;
  page: PageReading | null;
  screen: Judgement | null;
  traits: Trait[];
  samples: Sample[];
  /** What could not be done, in words: a prompt SAM failed on, Clairic unavailable. */
  notes: string[];
  usage: { clairicInputTokens: number; samPrompts: number };
}

export interface SampleOptions {
  url: string;
  persona: Persona;
  lookFor?: string[];
  dir: string;
  falKey?: string;
  /** False when Clairic is not configured: samples are still found, but not read or judged. */
  read: boolean;
  allowPrivateHosts?: boolean;
  signal?: AbortSignal;
  progress?: (stage: string) => void;
  /** Injected in tests. */
  capture?: (url: string) => Promise<PageCapture>;
  regions?: typeof findRegions;
  reader?: Reader;
}

export function cleanLookFor(input: unknown): string[] {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\n]/) : [];
  const out = [...new Set(list.filter((v): v is string => typeof v === "string").map((v) => v.trim().replace(/\s+/g, " ").slice(0, SAMPLE_LIMITS.lookForChars)).filter(Boolean))];
  return (out.length ? out : [...DEFAULT_LOOK_FOR]).slice(0, SAMPLE_LIMITS.lookFor);
}

/** The page element a region covers, if one matches it closely. */
export function original(box: Box, elements: DomElement[]): DomElement | undefined {
  let best: DomElement | undefined, bestScore = 0.5;
  for (const e of elements) {
    if (e.kind !== "image" && e.kind !== "svg" && e.kind !== "background") continue;
    const score = iou(box, e.box);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best;
}

const write = (dir: string, name: string, data: Buffer | string) => { writeFileSync(join(dir, name), data); return name; };

/** An inline SVG is drawable on its own, or it is not kept as an original. */
function validSvg(svg: string): boolean {
  try { new Resvg(svg).render(); return true; } catch { return false; }
}

export async function sampleSite(opts: SampleOptions): Promise<SampleRun> {
  const id = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
  const dir = join(opts.dir, id);
  mkdirSync(dir, { recursive: true });
  const notes: string[] = [];
  const lookFor = cleanLookFor(opts.lookFor);
  const progress = opts.progress ?? (() => undefined);

  progress("Opening the page");
  const page = await (opts.capture ?? ((url) => capturePage(url, { allowPrivateHosts: opts.allowPrivateHosts })))(opts.url);
  const screenshot = write(dir, "screen.png", page.screenshot);
  const scale = page.scale ?? 1;
  const ref = imageRef(page.screenshot, page.width, page.height);
  const image = { png: page.screenshot, width: page.width, height: page.height, ref };

  progress(`Looking for ${lookFor.join(", ")}`);
  const found = await (opts.regions ?? findRegions)(image, lookFor, { falKey: opts.falKey, signal: opts.signal, onPrompt: (prompt, n) => progress(`Found ${n} × ${prompt}`) });
  for (const prompt of found.failed) notes.push(`Segmentation failed for “${prompt}”.`);

  // Regions SAM found, then page images and icons it did not, so nothing visible is missed.
  const candidates: Array<{ box: Box; foundBy: string[]; score: number; cutout?: Buffer }> = found.regions.map((r) => ({ box: r.box, foundBy: r.prompts, score: r.score, cutout: r.cutout }));
  for (const e of page.elements) {
    if ((e.kind === "image" || e.kind === "svg") && e.box.w >= 16 && e.box.h >= 16 && !candidates.some((c) => iou(c.box, e.box) >= 0.5)) {
      candidates.push({ box: e.box, foundBy: ["page"], score: 0.5 });
    }
  }

  const samples: Sample[] = [];
  for (const [i, c] of candidates.entries()) {
    const sampleId = `s${i + 1}`;
    const cropped = crop(ref, c.box);
    const sample: Sample = { id: sampleId, box: c.box, foundBy: c.foundBy, score: c.score, crop: write(dir, `${sampleId}.png`, cropped.png) };
    if (c.cutout) sample.cutout = write(dir, `${sampleId}-cutout.png`, c.cutout);
    const o = original(c.box, page.elements);
    if (o?.kind === "svg" && o.svg && validSvg(o.svg)) sample.original = { kind: "svg", file: write(dir, `${sampleId}.svg`, o.svg), ...(o.alt ? { alt: o.alt } : {}) };
    else if (o?.src) sample.original = { kind: o.kind as "image" | "background", src: o.src, ...(o.alt ? { alt: o.alt } : {}) };
    samples.push(sample);
  }

  const r = opts.reader ?? reader(opts.signal);
  const traits = traitsOf(opts.persona);
  let pageReading: PageReading | null = null, screen: Judgement | null = null;
  if (opts.read) {
    progress("Reading the page and judging what matters");
    // The model sees a downscaled image, so the page is read from its first screen only.
    const first = crop(ref, { x: 0, y: 0, w: page.width, h: Math.min(page.height, CAPTURE.viewportHeight) }, { pad: 0, minSide: 0, maxSide: 1568 }).png;
    const [pr, sj] = await Promise.allSettled([readPage(r, first), judge(r, first, opts.persona, traits, "screen")]);
    pageReading = pr.status === "fulfilled" ? pr.value : null;
    screen = sj.status === "fulfilled" ? sj.value : null;
    if (pr.status === "rejected" || sj.status === "rejected") notes.push(`Clairic could not read the whole page: ${errorText(pr.status === "rejected" ? pr.reason : (sj as PromiseRejectedResult).reason)}`);
    const judged = [...samples].sort((a, b) => b.score - a.score).slice(0, SAMPLE_LIMITS.judged);
    let failures = 0;
    await pool(judged, SAMPLE_LIMITS.clairicConcurrency, async (sample) => {
      if (opts.signal?.aborted) return;
      // Large crops (a product shot) are shrunk to stay inside Clairic's image limit.
      const png = crop(ref, sample.box, { maxSide: 1024 }).png;
      const [text, judgement] = await Promise.allSettled([readText(r, png), judge(r, png, opts.persona, traits, "element")]);
      if (text.status === "fulfilled" && text.value) sample.text = text.value;
      if (judgement.status === "fulfilled" && judgement.value) sample.judgement = judgement.value;
      if (text.status === "rejected" || judgement.status === "rejected") failures++;
    });
    if (failures) notes.push(`Clairic could not judge ${failures} sample${failures === 1 ? "" : "s"}.`);
    if (samples.length > judged.length) notes.push(`Judged the ${judged.length} most confident of ${samples.length} samples.`);
  } else {
    notes.push("Clairic isn't configured, so samples were found but not read or judged.");
  }
  samples.sort((a, b) => (b.judgement?.relevance.median ?? -1) - (a.judgement?.relevance.median ?? -1) || b.score - a.score);

  const run: SampleRun = {
    schemaVersion: 1, id, url: opts.url, finalUrl: page.finalUrl, title: page.title, personaId: opts.persona.id, lookFor,
    createdAt: new Date().toISOString(), screenshot, width: page.width, height: page.height, scale, styles: page.styles,
    page: pageReading, screen, traits, samples, notes,
    usage: { clairicInputTokens: r.tokens, samPrompts: lookFor.length },
  };
  write(dir, "run.json", JSON.stringify(run, null, 2));
  return run;
}

function errorText(error: unknown): string {
  return error instanceof Error && error.name === "ClairicError" ? error.message : "an unexpected error.";
}

export function listRuns(dir: string, personaId?: string): Array<Pick<SampleRun, "id" | "url" | "title" | "personaId" | "createdAt"> & { count: number }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((id) => {
    const run = readRun(dir, id);
    return run && (!personaId || run.personaId === personaId) ? [{ id, url: run.url, title: run.title, personaId: run.personaId, createdAt: run.createdAt, count: run.samples.length }] : [];
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function readRun(dir: string, id: string): SampleRun | null {
  if (!/^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/.test(id)) return null;
  try {
    const run = JSON.parse(readFileSync(join(dir, id, "run.json"), "utf8")) as SampleRun;
    return run.schemaVersion === 1 && run.id === id ? run : null;
  } catch { return null; }
}

export interface KeptSample {
  /** File name in the run directory to serve. */
  file: string;
  kind: "original" | "cutout" | "crop";
}

/**
 * The best file to keep for a sample: the page's own image or SVG, else the
 * cut-out, else the crop. A remote original is fetched through the public-host
 * check and kept only when it is a real PNG, JPEG, WebP or SVG.
 */
export async function keepSample(dir: string, run: SampleRun, sample: Sample, opts: { allowPrivateHosts?: boolean } = {}): Promise<KeptSample> {
  const runDir = join(dir, run.id);
  if (sample.original?.file) return { file: sample.original.file, kind: "original" };
  if (sample.original?.src && /^https?:/.test(sample.original.src)) {
    try {
      const { data } = await safeFetchBuffer(sample.original.src, { allowPrivateHosts: opts.allowPrivateHosts, maxBytes: 8_000_000, timeoutMs: 15_000 });
      const info = parseImageDimensions(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      const svg = !info && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(data.subarray(0, 512).toString("utf8")) && validSvg(data.toString("utf8"));
      const ext = info && ["png", "jpeg", "webp"].includes(info.format) ? (info.format === "jpeg" ? "jpg" : info.format) : svg ? "svg" : null;
      if (ext) {
        const name = `${sample.id}-original-${createHash("sha256").update(data).digest("hex").slice(0, 8)}.${ext}`;
        if (!existsSync(join(runDir, name))) writeFileSync(join(runDir, name), data);
        sample.original.file = name;
        writeFileSync(join(runDir, "run.json"), JSON.stringify(run, null, 2));
        return { file: name, kind: "original" };
      }
    } catch { /* fall back to the cut-out or crop */ }
  }
  return sample.cutout ? { file: sample.cutout, kind: "cutout" } : { file: sample.crop, kind: "crop" };
}
