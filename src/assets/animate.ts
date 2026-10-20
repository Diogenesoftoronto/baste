/**
 * Animated loops from a finished image, shaped by the persona's animation.
 *
 * Parallax: the cut-out subject and the painted-out scene move at different
 * depths along the persona's camera. It ships as a self-contained HTML page
 * (CSS only, no script), a JSON layer spec, and with ffmpeg an MP4 whose last
 * frame flows into its first.
 *
 * Video: Seedance animates from the image to an edited end frame showing the
 * persona's motifs at their height; ffmpeg plays it forward and back so the
 * loop closes on itself.
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { Resvg } from "@resvg/resvg-js";
import type { Persona, PersonaAnimation } from "../persona/types.js";
import { CAMERA_MOVES, animationFor, motionTokens, videoMotionPhrase } from "./motion.js";
import { falDownload, falImageInput, falRun, falUpload } from "./fal.js";
import { editMask, repaint, segmentSubject, type EditRegion, type LayerConfig, type Layers } from "./layers.js";
import type { DerivedAssets, GeneratedAsset } from "./generators.js";
import { ffmpegAvailable } from "../shared/stills.js";

const run = promisify(execFile);

export type ParallaxFiles = NonNullable<DerivedAssets["parallax"]>;
export type VideoLoop = NonNullable<DerivedAssets["loop"]>;

/** How one layer moves: travel as a percentage of its box, and how much it grows. */
export interface LayerMotion { travel: number; scale: number }

export interface ParallaxSpec {
  version: 1;
  width: number;
  height: number;
  loopSeconds: number;
  camera: PersonaAnimation["camera"];
  depth: PersonaAnimation["depth"];
  focus: PersonaAnimation["focus"];
  /** The persona's standard curve, for moves that go there and back. */
  easing: string;
  /** How far past the frame each layer extends, as a percentage, so a move never shows an edge. */
  bleed: number;
  layers: Array<{ name: "background" | "subject"; file: string } & LayerMotion>;
}

/** How much more the front layer moves than the back. */
const DEPTH_RATIO: Record<PersonaAnimation["depth"], number> = { flat: 1.25, parallax: 2, deep: 3 };

/** Each layer's motion for the persona's camera, depth and focus, scaled by its travel token. */
export function parallaxMotion(persona: Persona): { background: LayerMotion; subject: LayerMotion; bleed: number } {
  const animation = animationFor(persona);
  const travel = Math.min(4, Math.max(0.8, (parseFloat(motionTokens(persona.aesthetic).distance.travel) / 1280) * 100));
  const ratio = DEPTH_RATIO[animation.depth];
  const background = { travel: 0, scale: 0 };
  const subject = { travel: 0, scale: 0 };
  if (animation.camera === "drift" || animation.camera === "orbit") {
    background.travel = travel;
    subject.travel = travel * ratio;
  } else if (animation.camera === "push") {
    background.scale = travel / 100;
    subject.scale = (travel / 100) * ratio;
  } else {
    // A locked camera: the scene moves, not the view. The background breathes and the
    // subject sways, so the two layers never move as one.
    if (animation.focus !== "subject") background.scale = 0.015;
    if (animation.focus !== "background") subject.travel = travel;
  }
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    background: { travel: round(background.travel), scale: round(background.scale) },
    subject: { travel: round(subject.travel), scale: round(subject.scale) },
    bleed: round(Math.max(background.travel, subject.travel) * 1.2 + 0.5),
  };
}

function keyframes(name: string, m: LayerMotion, camera: PersonaAnimation["camera"]): string | undefined {
  if (camera === "orbit" && m.travel > 0) {
    const steps = Array.from({ length: 9 }, (_, i) => {
      const angle = (i / 8) * 2 * Math.PI;
      return `${Math.round((i / 8) * 1000) / 10}% { transform: translate(${(m.travel * Math.cos(angle)).toFixed(3)}%, ${(m.travel * 0.6 * Math.sin(angle)).toFixed(3)}%); }`;
    });
    return `@keyframes ${name} { ${steps.join(" ")} }`;
  }
  if (m.travel > 0) return `@keyframes ${name} { from { transform: translateX(${-m.travel}%); } to { transform: translateX(${m.travel}%); } }`;
  if (m.scale > 0) return `@keyframes ${name} { from { transform: scale(1); } to { transform: scale(${1 + m.scale}); } }`;
  return undefined;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A self-contained parallax page: both layers inline as PNG data, CSS
 * keyframes only, and stillness for people who ask for reduced motion.
 */
export function parallaxHtml(spec: ParallaxSpec, images: { background: Buffer; subject: Buffer }, title: string): string {
  const animated = spec.layers.map((layer) => {
    const frames = keyframes(`move-${layer.name}`, layer, spec.camera);
    const timing = spec.camera === "orbit"
      ? `${spec.loopSeconds}s linear infinite`
      // There and back again: two halves make one loop.
      : `${spec.loopSeconds / 2}s ${spec.easing} infinite alternate`;
    return { layer, frames, rule: frames ? `animation: move-${layer.name} ${timing};` : "" };
  });
  const png = (data: Buffer) => `url("data:image/png;base64,${data.toString("base64")}")`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #0e0e10; }
  body { display: grid; place-items: center; }
  .stage { position: relative; width: min(100vw, calc(100vh * ${spec.width} / ${spec.height})); aspect-ratio: ${spec.width} / ${spec.height}; overflow: hidden; }
  .layer { position: absolute; inset: -${spec.bleed}%; background: center / cover no-repeat; will-change: transform; }
  .background { background-image: ${png(images.background)}; ${animated[0].rule} }
  .subject { background-image: ${png(images.subject)}; ${animated[1].rule} }
  ${animated.map((a) => a.frames).filter(Boolean).join("\n  ")}
  @media (prefers-reduced-motion: reduce) { .layer { animation: none; } }
</style>
</head>
<body>
<div class="stage" role="img" aria-label="${escapeHtml(title)}">
  <div class="layer background"></div>
  <div class="layer subject"></div>
</div>
</body>
</html>
`;
}

/**
 * Layers inside the page are drawn at most this long, like the MP4; the
 * full-size PNGs ship beside it.
 */
const PAGE_LONG_SIDE = 1280;

function pageLayer(path: string, width: number, height: number): Buffer {
  const data = readFileSync(path);
  const scale = Math.min(1, PAGE_LONG_SIDE / Math.max(width, height));
  if (scale === 1) return data;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image width="${w}" height="${h}" preserveAspectRatio="none" href="data:image/png;base64,${data.toString("base64")}"/></svg>`, { fitTo: { mode: "original" } }).render().asPng();
}

/** An even size no wider or taller than 1280 px, for H.264. */
function videoSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const even = (n: number) => Math.max(2, 2 * Math.floor((n * scale) / 2));
  return { width: even(width), height: even(height) };
}

/** One layer's ffmpeg chain: scaled past the frame by the bleed, then cropped along a path that repeats every loop. */
function layerChain(input: number, label: string, m: LayerMotion, spec: ParallaxSpec, out: { width: number; height: number }): string {
  const boxWidth = Math.round(out.width * (1 + (2 * spec.bleed) / 100));
  const boxHeight = Math.round(out.height * (1 + (2 * spec.bleed) / 100));
  const phase = `2*PI*t/${spec.loopSeconds}`;
  const ax = ((m.travel / 100) * boxWidth).toFixed(2);
  const ay = ((m.travel / 100) * boxHeight * 0.6).toFixed(2);
  const x = spec.camera === "orbit" ? `(iw-ow)/2+${ax}*cos(${phase})` : `(iw-ow)/2+${ax}*sin(${phase})`;
  const y = spec.camera === "orbit" ? `(ih-oh)/2+${ay}*sin(${phase})` : "(ih-oh)/2";
  const grow = `(1+${m.scale}*(1-cos(${phase}))/2)`;
  const scale = m.scale > 0
    ? `scale=w='2*trunc(${boxWidth}*${grow}/2)':h='2*trunc(${boxHeight}*${grow}/2)':eval=frame:flags=bicubic`
    : `scale=${boxWidth}:${boxHeight}:flags=lanczos`;
  return `[${input}:v]format=rgba,${scale},crop=${out.width}:${out.height}:x='${x}':y='${y}'[${label}]`;
}

/** The parallax loop as an MP4 whose motion repeats exactly every `loopSeconds`. */
async function renderParallax(spec: ParallaxSpec, files: { background: string; subject: string }, output: string): Promise<void> {
  const out = videoSize(spec.width, spec.height);
  const [background, subject] = spec.layers;
  const graph = [
    layerChain(0, "back", background, spec, out),
    layerChain(1, "front", subject, spec, out),
    "[back][front]overlay=0:0:format=auto,format=yuv420p[v]",
  ].join(";");
  await run("ffmpeg", [
    "-v", "error", "-y",
    "-loop", "1", "-framerate", "30", "-i", `file:${files.background}`,
    "-loop", "1", "-framerate", "30", "-i", `file:${files.subject}`,
    "-filter_complex", graph, "-map", "[v]",
    "-t", String(spec.loopSeconds), "-r", "30",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", "-an",
    `file:${output}`,
  ], { timeout: 180_000 });
}

/** A parallax loop from an image's layers: HTML, a JSON spec and, with ffmpeg, an MP4. */
export async function buildParallax(asset: GeneratedAsset, layers: Layers, persona: Persona, outputDir: string): Promise<ParallaxFiles> {
  const animation = animationFor(persona);
  const motion = parallaxMotion(persona);
  const dir = join(outputDir, "animation");
  mkdirSync(dir, { recursive: true });
  const spec: ParallaxSpec = {
    version: 1,
    width: layers.width,
    height: layers.height,
    loopSeconds: animation.loopSeconds!,
    camera: animation.camera,
    depth: animation.depth,
    focus: animation.focus,
    easing: motionTokens(persona.aesthetic).curves.standard,
    bleed: motion.bleed,
    layers: [
      { name: "background", file: layers.background.split(/[\\/]/).pop()!, ...motion.background },
      { name: "subject", file: layers.foreground.split(/[\\/]/).pop()!, ...motion.subject },
    ],
  };
  const files: ParallaxFiles = { html: join(dir, `${asset.id}-parallax.html`), spec: join(dir, `${asset.id}-parallax.json`) };
  writeFileSync(files.spec, JSON.stringify(spec, null, 2));
  writeFileSync(files.html, parallaxHtml(spec, { background: pageLayer(layers.background, layers.width, layers.height), subject: pageLayer(layers.foreground, layers.width, layers.height) },
    `${persona.name}: ${asset.metadata.assetPurpose} in parallax`));
  if (ffmpegAvailable()) {
    const video = join(dir, `${asset.id}-parallax.mp4`);
    await renderParallax(spec, { background: layers.background, subject: layers.foreground }, video);
    files.video = video;
  }
  return files;
}

/** The brief for an image-to-video loop: what moves, how, and what to leave out. */
export function loopPrompt(persona: Persona): string {
  const animation = animationFor(persona);
  const moves = animation.motifs.length ? `${animation.motifs.slice(0, 3).join("; ")}. ` : "";
  const avoid = animation.avoid.length ? ` Avoid ${animation.avoid.join(", ")}.` : "";
  return `${moves}${videoMotionPhrase(persona.aesthetic.motionStyle)}. Camera: ${CAMERA_MOVES[animation.camera]}. One continuous shot with no cuts, no text and no people entering.${avoid}`;
}

/**
 * An end frame repaints at most this share of the image. Repainting more
 * invents a new scene, and the loop morphs between two places instead of
 * moving one.
 */
export const MAX_END_REPAINT = 0.5;

/** What the edit model paints into an end frame's region. */
export function endPrompt(persona: Persona, region: EditRegion, subject: string): string {
  const animation = animationFor(persona);
  const world = persona.aesthetic.visualKeywords.slice(0, 3).join(", ");
  if (region === "subject") {
    const word = subject.toLowerCase().split(/\s+/).pop()!;
    const motif = animation.motifs.find((m) => m.toLowerCase().includes(word));
    return `The ${subject}, the same size and in the same spot, a moment later${motif ? `: ${motif}` : ", caught mid-motion"}. ${world}. No text, no lettering.`;
  }
  return `The same scene a moment later, at its height: ${animation.motifs.slice(0, 2).join(" and ")}. Same composition, camera and light direction. ${world}. No text, no lettering.`;
}

/**
 * A video loop from a finished image. With motifs and a subject to mask by,
 * the edit model paints an end frame in the persona's focus region, when
 * that region is small enough to keep the composition (the subject when the
 * focus is both); Seedance animates from the image to it, or from the motifs
 * alone; ffmpeg plays the clip forward then back, dropping the repeated frame
 * at each turn.
 */
export async function buildVideoLoop(
  asset: GeneratedAsset,
  persona: Persona,
  subjects: string[],
  cfg: LayerConfig & { animateModel: string; resolution?: "480p" | "720p" | "1080p" },
): Promise<VideoLoop> {
  const animation = animationFor(persona);
  const dir = join(cfg.outputDir, "animation");
  mkdirSync(dir, { recursive: true });
  const image = { path: asset.content, sourceUrl: asset.metadata.sourceUrl };
  let end: { path: string; url: string } | undefined;
  if (animation.motifs.length && subjects.length) {
    const subject = await segmentSubject(image, subjects, cfg);
    const region: EditRegion = animation.focus === "background" ? "background" : "subject";
    const share = subject ? (region === "subject" ? subject.coverage : 1 - subject.coverage) : 1;
    if (subject && share <= MAX_END_REPAINT) {
      const edited = await repaint(image, editMask(subject, region), endPrompt(persona, region, subject.subject), cfg);
      const path = join(dir, `${asset.id}-end.png`);
      writeFileSync(path, edited.png);
      end = { path, url: edited.sourceUrl ?? await falUpload(edited.png, "image/png", { key: cfg.falKey, notOrganicFetch: cfg.notOrganicFetch }) };
    }
  }
  // Played there and back, so each half is half the persona's loop.
  const seconds = Math.min(12, Math.max(2, Math.round(animation.loopSeconds! / 2)));
  const result = await falRun<{ video?: { url?: string } }>(cfg.animateModel, {
    prompt: loopPrompt(persona),
    image_url: await falImageInput(asset.content, { key: cfg.falKey, notOrganicFetch: cfg.notOrganicFetch, sourceUrl: image.sourceUrl, upload: true }),
    ...(end ? { end_image_url: end.url } : {}),
    duration: String(seconds),
    resolution: cfg.resolution ?? "720p",
    camera_fixed: animation.camera === "locked",
  }, { key: cfg.falKey, notOrganicFetch: cfg.notOrganicFetch, hostedModel: "image-animate", timeoutMs: 15 * 60_000, pollIntervalMs: cfg.pollIntervalMs });
  if (!result.video?.url) throw new Error("The video model returned no video.");
  const transition = join(dir, `${asset.id}-transition.mp4`);
  await falDownload(result.video.url, transition);
  const loop: VideoLoop = { transition, ...(end ? { end: end.path } : {}) };
  if (ffmpegAvailable()) {
    const video = join(dir, `${asset.id}-loop.mp4`);
    await run("ffmpeg", [
      "-v", "error", "-y", "-i", `file:${transition}`,
      "-filter_complex", "[0:v]split[a][b];[a]trim=start_frame=1,setpts=PTS-STARTPTS[forward];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[back];[forward][back]concat=n=2:v=1:a=0[v]",
      "-map", "[v]", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart",
      `file:${video}`,
    ], { timeout: 300_000 });
    loop.video = video;
  }
  return loop;
}
