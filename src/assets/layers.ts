/**
 * Layers: a subject cut out of an image, and the scene behind it.
 *
 * Creating and editing are separate roles. Whichever model drew an image, SAM 3
 * finds its subject by name, resvg turns the mask into the masks an edit needs,
 * and Ideogram repaints, all on one FAL_KEY:
 * https://fal.ai/models/fal-ai/sam-3/image and
 * https://fal.ai/models/fal-ai/ideogram/v3/edit
 *
 * fal's Ideogram edit repaints a mask's white and keeps its black. Ideogram's
 * own API documents the opposite (https://developer.ideogram.ai); a live check
 * on 2026-10-18 changed the white region four times as much as the black.
 * `EDIT_COLOR` flips every mask at once.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Persona } from "../persona/types.js";
import type { EvaluatorConfig } from "../config/baste-config.js";
import type { AssetType, AxisStep } from "../generation/prompts.js";
import { falBytesInput, falDownloadBytes, falImageInput, falMediaUrl, falRun } from "./fal.js";
import { stamp, type DerivedAssets, type GeneratedAsset } from "./generators.js";
import { parseImageDimensions } from "../shared/img-dims.js";
import { nativePng, stillFromBuffer } from "../shared/stills.js";
import { askJev, noulAnswer, type ChoiceAnswer } from "../evaluation/typesafe-judge.js";

export type Layers = NonNullable<DerivedAssets["layers"]>;

export interface LayerConfig {
  outputDir: string;
  falKey?: string;
  notOrganicFetch?: (path: string, init?: RequestInit) => Promise<Response>;
  segmentModel: string;
  editModel: string;
  renderingSpeed?: "TURBO" | "BALANCED" | "QUALITY";
  /** Jev, for the cut check; without it the check is skipped. */
  judge?: Partial<EvaluatorConfig>;
  pollIntervalMs?: number;
}

/** A subject mask: white subject on black at the source image's exact size. */
export interface SubjectMask {
  subject: string;
  png: Buffer;
  width: number;
  height: number;
  /** Share of the frame the subject covers. */
  coverage: number;
  score?: number;
}

/** The region an edit repaints. */
export type EditRegion = "background" | "subject";

/** How a QD child repaints one region of its parent's image. */
export interface EditPlan {
  from: GeneratedAsset;
  /** Subjects to segment the parent by, most likely first. */
  subjects: string[];
  layer: EditRegion;
  step: AxisStep;
}

/** How a candidate was made, when it is an edit of another candidate's image. */
export interface EditLineage {
  /** The parent image's path. */
  from: string;
  layer: EditRegion;
  subject: string;
  instruction: string;
}

/** Which colour the edit model repaints: white on fal, black on Ideogram's own API. */
export const EDIT_COLOR: "black" | "white" = "white";
/** A cut-out subject covers this share of the frame: less is a speck, more is the scene. */
export const COVERAGE = { min: 0.02, max: 0.7 };
/** SAM masks scored below this are not used. */
export const MIN_MASK_SCORE = 0.5;
/** Instances of one subject (every lantern, every mushroom) are merged into one layer, up to this many. */
export const MAX_INSTANCES = 8;
/** Segmentation tries at most this many subject names per image. */
export const MAX_SUBJECTS = 3;
/** The name tried when a persona lists no subjects. */
export const GENERIC_SUBJECT = "main subject";

const dataUrl = (png: Uint8Array) => `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
const INVERT = `<feColorMatrix values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/>`;

function draw(width: number, height: number, body: string): { png: Buffer; pixels: Buffer } {
  const image = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`, { fitTo: { mode: "original" } }).render();
  return { png: image.asPng(), pixels: image.pixels };
}

function measure(pixels: Buffer, width: number, height: number): { coverage: number; border: number } {
  let on = 0;
  let edge = 0;
  let edgeOn = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lit = pixels[(y * width + x) * 4] > 127;
      if (lit) on++;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        edge++;
        if (lit) edgeOn++;
      }
    }
  }
  return { coverage: on / (width * height), border: edge ? edgeOn / edge : 0 };
}

/**
 * A segmenter's mask as white subject on black at the source's exact size. The
 * mask may come at another size, or inverted: one that is nearly all on around
 * the border and covers most of the frame is read as inverted.
 */
export function normalizeMask(bytes: Buffer, width: number, height: number): Omit<SubjectMask, "subject"> | undefined {
  const info = parseImageDimensions(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  if (!info || (info.format !== "png" && info.format !== "jpeg")) return undefined;
  const image = `<image width="${width}" height="${height}" preserveAspectRatio="none" href="data:image/${info.format};base64,${bytes.toString("base64")}"/>`;
  let mask = draw(width, height, `<rect width="100%" height="100%" fill="#000"/>${image}`);
  let { coverage, border } = measure(mask.pixels, width, height);
  if (border > 0.9 && coverage > 0.5) {
    mask = draw(width, height, `<filter id="invert" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${INVERT}</filter>`
      + `<image width="${width}" height="${height}" href="${dataUrl(mask.png)}" filter="url(#invert)"/>`);
    ({ coverage, border } = measure(mask.pixels, width, height));
  }
  return { png: mask.png, width, height, coverage };
}

/**
 * The mask an edit sends: `region` is repainted and the rest kept. The subject
 * grows by about 2% of the short side first, so a background repaint keeps
 * clear of its edge and a subject repaint has room to blend.
 */
export function editMask(mask: Pick<SubjectMask, "png" | "width" | "height">, region: EditRegion): Buffer {
  const { width, height } = mask;
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.02));
  // The grown subject is white on black. It is the repainted region when white is
  // repainted and the subject is the region; otherwise the mask is inverted.
  const invert = (region === "subject") === (EDIT_COLOR === "black");
  return draw(width, height, `<filter id="grow" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`
    + `<feMorphology operator="dilate" radius="${radius}"/>${invert ? INVERT : ""}</filter>`
    + `<image width="${width}" height="${height}" href="${dataUrl(mask.png)}" filter="url(#grow)"/>`).png;
}

/**
 * The subject alone on transparency, its edge feathered by 1.5 px. The mask is
 * stretched slightly after blurring so the subject's interior stays fully
 * opaque: a luminance mask otherwise rounds white to 254, and a parallax
 * background would show faintly through.
 */
export function cutout(source: { png: Buffer; width: number; height: number }, mask: Pick<SubjectMask, "png">): Buffer {
  const { width, height } = source;
  const fill = `width="${width}" height="${height}" preserveAspectRatio="none"`;
  // Blurring softens the mask's own alpha as well as its colour, so both are stretched.
  const stretch = ["R", "G", "B", "A"].map((c) => `<feFunc${c} type="linear" slope="1.05" intercept="-0.025"/>`).join("");
  return draw(width, height, `<filter id="soft" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.5"/><feComponentTransfer>${stretch}</feComponentTransfer></filter>`
    + `<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><image ${fill} href="${dataUrl(mask.png)}" filter="url(#soft)"/></mask>`
    + `<image ${fill} href="${dataUrl(source.png)}" mask="url(#cut)"/>`).png;
}

/**
 * Subjects to segment, most likely first. With Jev's reading of the image,
 * unlikely ones are dropped, and none are left when it is confident that no
 * listed subject is there.
 */
export function rankSubjects(subjects: string[], choice?: ChoiceAnswer): string[] {
  if (!choice) return subjects.length ? subjects.slice(0, MAX_SUBJECTS) : [GENERIC_SUBJECT];
  if (choice.choice === "none" && (choice.probabilities.none ?? 0) >= 0.6) return [];
  return Object.entries(choice.probabilities)
    .filter(([subject, p]) => subject !== "none" && p >= 0.05)
    .sort((a, b) => b[1] - a[1])
    .map(([subject]) => subject)
    .slice(0, MAX_SUBJECTS);
}

interface Source { path: string; sourceUrl?: string }
interface SamOutput { masks?: Array<{ url?: string }>; metadata?: Array<{ index?: number; score?: number | null }>; scores?: Array<number | null> }

/** One segmentation per image and subject list, shared by every child editing that image. */
const segmentations = new Map<string, Promise<SubjectMask | undefined>>();

/**
 * The first named subject SAM can cut out cleanly, or undefined. Every
 * instance it finds (each lantern, each mushroom) joins one layer, so a
 * subject that recurs in small pieces still makes a layer worth moving.
 */
export function segmentSubject(image: Source, subjects: string[], cfg: LayerConfig): Promise<SubjectMask | undefined> {
  const key = [image.path, cfg.segmentModel, ...subjects].join("\n");
  const cached = segmentations.get(key);
  if (cached) return cached;
  const pending = findSubject(image, subjects, cfg);
  segmentations.set(key, pending);
  // A failure is not remembered, so a later edit can try again.
  pending.catch(() => segmentations.delete(key));
  while (segmentations.size > 32) segmentations.delete(segmentations.keys().next().value!);
  return pending;
}

async function findSubject(image: Source, subjects: string[], cfg: LayerConfig): Promise<SubjectMask | undefined> {
  const source = await nativePng(readFileSync(image.path));
  if (!source || !subjects.length) return undefined;
  const imageUrl = await falImageInput(image.path, { key: cfg.falKey, notOrganicFetch: cfg.notOrganicFetch, sourceUrl: image.sourceUrl });
  for (const subject of subjects.slice(0, MAX_SUBJECTS)) {
    const result = await falRun<SamOutput>(cfg.segmentModel, {
      image_url: imageUrl,
      prompt: subject,
      apply_mask: false,
      output_format: "png",
      return_multiple_masks: true,
      max_masks: MAX_INSTANCES,
      include_scores: true,
    }, { key: cfg.falKey, notOrganicFetch: cfg.notOrganicFetch, hostedModel: "image-segment", timeoutMs: 180_000, pollIntervalMs: cfg.pollIntervalMs });
    const found = (result.masks ?? [])
      .map((mask, i) => ({ url: mask?.url, score: result.metadata?.find((m) => m.index === i)?.score ?? result.scores?.[i] ?? undefined }))
      .filter((mask): mask is { url: string; score: number | undefined } => !!mask.url && !(typeof mask.score === "number" && mask.score < MIN_MASK_SCORE));
    if (!found.length) continue;
    const masks = await Promise.all(found.map(async (mask) => normalizeMask(await falDownloadBytes(mask.url, 32 * 1024 * 1024), source.width, source.height)));
    const merged = mergeMasks(masks.filter((mask): mask is NonNullable<typeof mask> => !!mask), source.width, source.height);
    if (merged && merged.coverage >= COVERAGE.min && merged.coverage <= COVERAGE.max) {
      const scores = found.map((mask) => mask.score).filter((score): score is number => typeof score === "number");
      return { ...merged, subject, ...(scores.length ? { score: Math.max(...scores) } : {}) };
    }
  }
  return undefined;
}

/** White-on-black masks of one size, combined into one. */
export function mergeMasks(masks: Array<Omit<SubjectMask, "subject">>, width: number, height: number): Omit<SubjectMask, "subject"> | undefined {
  if (masks.length <= 1) return masks[0];
  // Lighten keeps the brighter pixel: white wherever any mask is white.
  const merged = draw(width, height, `<rect width="100%" height="100%" fill="#000"/>`
    + masks.map((mask) => `<image width="${width}" height="${height}" preserveAspectRatio="none" style="mix-blend-mode:lighten" href="${dataUrl(mask.png)}"/>`).join(""));
  return { png: merged.png, width, height, coverage: measure(merged.pixels, width, height).coverage };
}

/**
 * Ideogram repaints the masked region from `prompt`. The result comes back at
 * the source's exact size, so layers line up pixel for pixel; its fal URL is
 * kept only when no resizing was needed.
 */
export async function repaint(image: Source, mask: Buffer, prompt: string, cfg: LayerConfig): Promise<{ png: Buffer; sourceUrl?: string }> {
  const source = await nativePng(readFileSync(image.path));
  if (!source) throw new Error(`Cannot read ${image.path} to edit it.`);
  const result = await falRun<{ images?: Array<{ url?: string }> }>(cfg.editModel, {
    prompt,
    image_url: await falImageInput(image.path, { key: cfg.falKey, notOrganicFetch: cfg.notOrganicFetch, sourceUrl: image.sourceUrl }),
    mask_url: await falBytesInput(mask, "image/png", { key: cfg.falKey }),
    rendering_speed: cfg.renderingSpeed ?? "BALANCED",
    // The brief is already specific; MagicPrompt would rewrite it.
    expand_prompt: false,
    num_images: 1,
  }, { key: cfg.falKey, notOrganicFetch: cfg.notOrganicFetch, hostedModel: "image-edit", timeoutMs: 300_000, pollIntervalMs: cfg.pollIntervalMs });
  const url = result.images?.[0]?.url;
  if (!url) throw new Error("The edit model returned no image.");
  const edited = await nativePng(await falDownloadBytes(url, 64 * 1024 * 1024));
  if (!edited) throw new Error("The edit model returned an unreadable image.");
  if (edited.width === source.width && edited.height === source.height) return { png: edited.png, sourceUrl: falMediaUrl(url).toString() };
  return { png: draw(source.width, source.height, `<image width="${source.width}" height="${source.height}" preserveAspectRatio="none" href="${dataUrl(edited.png)}"/>`).png };
}

const LOOKS: Record<AxisStep["axis"], (to: string) => string> = {
  "color temperature": (to) => `${to} light and colour`,
  "visual density": (to) => `${to} detail`,
  rendering: (to) => `${to} rendering`,
};

/** What the edit model paints into the region, and the line people read in the candidate's history. */
export function editBrief(persona: Persona, description: string, layer: EditRegion, step: AxisStep, subject: string): { prompt: string; instruction: string } {
  const look = LOOKS[step.axis](step.to);
  const world = persona.aesthetic.visualKeywords.slice(0, 3).join(", ");
  return layer === "background"
    ? { instruction: `Repainted the background in ${look}, keeping the ${subject}.`, prompt: `The background of ${description}, behind the ${subject}: ${look}. ${world}. No text, no lettering.` }
    : { instruction: `Repainted the ${subject} in ${look}, keeping the background.`, prompt: `The ${subject} in the same place, pose and size: ${look}. ${world}. No text, no lettering.` };
}

/** A QD child made by repainting one region of its parent's image; undefined when no subject can be cut out. */
export async function editImage(persona: Persona, asset: AssetType, plan: EditPlan, cfg: LayerConfig): Promise<{ asset: GeneratedAsset; lineage: EditLineage } | undefined> {
  const started = Date.now();
  const parent = { path: plan.from.content, sourceUrl: plan.from.metadata.sourceUrl };
  const subject = await segmentSubject(parent, plan.subjects, cfg);
  if (!subject) return undefined;
  const brief = editBrief(persona, asset.description, plan.layer, plan.step, subject.subject);
  const edited = await repaint(parent, editMask(subject, plan.layer), brief.prompt, cfg);
  const id = `${persona.id}-${asset.purpose}-${stamp()}`;
  const dir = join(cfg.outputDir, "images");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${id}.png`);
  writeFileSync(path, edited.png);
  return {
    asset: {
      id, type: "image", content: path, prompt: plan.step.prompt,
      metadata: {
        service: "fal", model: cfg.editModel, personaId: persona.id, assetPurpose: asset.purpose,
        generationTime: Date.now() - started, ...(edited.sourceUrl ? { sourceUrl: edited.sourceUrl } : {}),
      },
    },
    lineage: { from: plan.from.content, layer: plan.layer, subject: subject.subject, instruction: brief.instruction },
  };
}

const PLATE_PROMPT = (persona: Persona) =>
  `Continue the surrounding scene seamlessly: an empty stretch of the same background, matching its light, texture and perspective. ${persona.aesthetic.visualKeywords.slice(0, 3).join(", ")}. No text, no lettering.`;

/** Jev's check that the cut-out is whole and the plate clean. Undefined when it cannot run. */
async function checkCut(foreground: Buffer, plate: Buffer, subject: string, judge: Partial<EvaluatorConfig>): Promise<{ whole: number; clean: number } | undefined> {
  const [cut, background] = await Promise.all([stillFromBuffer(foreground, 768), stillFromBuffer(plate, 768)]);
  if (!cut || !background) return undefined;
  const answers = await askJev({ subject, note: "`cutout` is the subject on a neutral grey ground. `plate` is the scene with the subject painted out." }, { cutout: cut, plate: background }, {
    whole: {
      type: "noul",
      instructions: "Does `cutout` show whole `subject`s (one or several) with clean edges, and no leftover pieces of the scene around them?",
      criteria: { true: "Each subject shown is whole, with clean edges and nothing else around it.", false: "Part of a subject is missing, holes run through it, or pieces of the scene are left around it." },
    },
    clean: {
      type: "noul",
      instructions: "Is `plate` free of the `subject`, with no ghost, outline or smear where it stood?",
      criteria: { true: "The scene reads as complete without the subject.", false: "A ghost, outline, smear or copy of the subject is visible." },
    },
  }, judge);
  return { whole: noulAnswer(answers.whole, "whole cut"), clean: noulAnswer(answers.clean, "clean plate") };
}

/**
 * Cut a finished image into layers: the subject on transparency, the scene
 * with the subject painted out, and the mask. A cut Jev finds incomplete is
 * dropped before anything is written.
 */
export async function buildLayers(asset: GeneratedAsset, persona: Persona, subjects: string[], cfg: LayerConfig): Promise<{ layers?: Layers; reason?: string }> {
  const image = { path: asset.content, sourceUrl: asset.metadata.sourceUrl };
  const subject = await segmentSubject(image, subjects, cfg);
  if (!subject) return { reason: "no subject stood apart clearly enough to cut out" };
  const source = await nativePng(readFileSync(asset.content));
  if (!source) return { reason: "the image could not be read" };
  const foreground = cutout(source, subject);
  const plate = await repaint(image, editMask(subject, "subject"), PLATE_PROMPT(persona), cfg);
  let check: { whole: number; clean: number } | undefined;
  if (cfg.judge) {
    try {
      check = await checkCut(foreground, plate.png, subject.subject, cfg.judge);
    } catch {
      check = undefined;
    }
    if (check && (check.whole < 0.5 || check.clean < 0.5)) {
      return { reason: `Jev found the cut ${check.whole < 0.5 ? "incomplete" : "unclean"} (whole ${check.whole.toFixed(2)}, clean ${check.clean.toFixed(2)})` };
    }
  }
  const dir = join(cfg.outputDir, "layers");
  mkdirSync(dir, { recursive: true });
  const files = { foreground: join(dir, `${asset.id}-fg.png`), background: join(dir, `${asset.id}-bg.png`), mask: join(dir, `${asset.id}-mask.png`) };
  writeFileSync(files.foreground, foreground);
  writeFileSync(files.background, plate.png);
  writeFileSync(files.mask, subject.png);
  return { layers: { subject: subject.subject, ...files, width: source.width, height: source.height, ...(check ? { check } : {}) } };
}
