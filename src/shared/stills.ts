/**
 * Stills a vision judge can read: lossless PNG inside TypeSafe's image limits.
 * https://docs.typesafe.ai/images.md takes only PNG or JPEG, 280–1568 px a
 * side, and never resizes, so everything is fitted here first and sent as PNG:
 * JPEG's artifacts would be judged as the asset's own. PNG, JPEG and SVG are
 * redrawn by resvg (already a dependency); WebP, GIF, AVIF and video frames
 * need ffmpeg, and are skipped without it.
 */
import { execFile, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { promisify } from "node:util";
import { Resvg } from "@resvg/resvg-js";
import { parseImageDimensions } from "./img-dims.js";

const run = promisify(execFile);

export interface Still {
  data: Uint8Array;
  format: "png";
  width: number;
  height: number;
}

export const STILL_MIN_SIDE = 280;
export const STILL_MAX_SIDE = 1568;
/** Neutral ground behind transparent pixels and letterboxing. */
const GROUND = "#e7e5e0";

/**
 * Pixel size for an image drawn with its long side at most `longSide`, then
 * enlarged until both sides reach the minimum. A canvas that is still too
 * narrow (a very wide banner) is padded rather than distorted.
 */
export function fitStill(width: number, height: number, longSide: number): { width: number; height: number; canvasWidth: number; canvasHeight: number } {
  if (!(width > 0 && height > 0)) throw new Error("Image has no size.");
  let scale = Math.min(1, Math.min(longSide, STILL_MAX_SIDE) / Math.max(width, height));
  if (Math.min(width, height) * scale < STILL_MIN_SIDE) scale = STILL_MIN_SIDE / Math.min(width, height);
  if (Math.max(width, height) * scale > STILL_MAX_SIDE) scale = STILL_MAX_SIDE / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const side = (n: number) => Math.min(STILL_MAX_SIDE, Math.max(STILL_MIN_SIDE, n));
  return { width: w, height: h, canvasWidth: side(w), canvasHeight: side(h) };
}

function render(svg: string): Still {
  const image = new Resvg(svg, { fitTo: { mode: "original" } }).render();
  return { data: image.asPng(), format: "png", width: image.width, height: image.height };
}

/** One image centred on a neutral canvas, drawn at its fitted size. */
function redraw(href: string, width: number, height: number, longSide: number): Still {
  const fit = fitStill(width, height, longSide);
  const x = (fit.canvasWidth - fit.width) / 2;
  const y = (fit.canvasHeight - fit.height) / 2;
  return render(`<svg xmlns="http://www.w3.org/2000/svg" width="${fit.canvasWidth}" height="${fit.canvasHeight}">`
    + `<rect width="100%" height="100%" fill="${GROUND}"/>`
    + `<image x="${x}" y="${y}" width="${fit.width}" height="${fit.height}" preserveAspectRatio="none" href="${href}"/></svg>`);
}

function isAvif(buffer: Buffer): boolean {
  return buffer.length > 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp" && ["avif", "avis"].includes(buffer.subarray(8, 12).toString("latin1"));
}

function isSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")) || (head.startsWith("<!--") && head.includes("<svg"));
}

/**
 * SVG ready for resvg: the namespace generated SVG often omits (browsers
 * tolerate it, resvg does not), and no references outside the file. resvg
 * reads `<image href="/abs/path">` straight from disk, so an untrusted SVG
 * could otherwise draw a private local image into a still that gets uploaded.
 * Only inline `data:` images and `#fragment` references survive.
 */
export function safeSvg(source: string): string {
  return source
    .replace(/<svg\b(?![^>]*\sxmlns=)/, '<svg xmlns="http://www.w3.org/2000/svg"')
    // Any namespace prefix may be bound to XLink, so every `prefix:href` counts.
    .replace(/(\s(?:[\w.-]+:)?href\s*=\s*)("[^"]*"|'[^']*')/gi, (match, attribute: string, value: string) =>
      /^["']\s*(?:data:|#)/i.test(value) ? match : `${attribute}""`);
}

/** Width and height an SVG draws at, from its attributes or viewBox. */
function svgSize(source: string): { width: number; height: number } {
  const resvg = new Resvg(source);
  return { width: resvg.width, height: resvg.height };
}

/**
 * An SVG drawn on its own at `width` px wide, as a PNG data URL. Drawing it
 * first, rather than nesting it in a canvas SVG, keeps raster images embedded
 * in it: resvg drops those inside a nested SVG.
 */
function drawSvg(source: string, width: number): string {
  const png = new Resvg(source, { fitTo: { mode: "width", value: Math.max(1, Math.round(width)) } }).render().asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
}

let ffmpegChecked: boolean | undefined;
/** Whether ffmpeg and ffprobe are on PATH; checked once per process. */
export function ffmpegAvailable(): boolean {
  ffmpegChecked ??= [
    spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }),
    spawnSync("ffprobe", ["-version"], { stdio: "ignore" }),
  ].every((result) => result.status === 0);
  return ffmpegChecked;
}

/** Decode anything ffmpeg reads (WebP, GIF, AVIF…) into a fitted PNG. */
async function viaFfmpeg(buffer: Buffer, width: number | undefined, height: number | undefined, longSide: number): Promise<Still | undefined> {
  if (!ffmpegAvailable()) return undefined;
  const size = width && height ? { width, height } : await probeBuffer(buffer);
  if (!size) return undefined;
  const fit = fitStill(size.width, size.height, longSide);
  const png = await pipeFfmpeg(["-v", "error", "-i", "pipe:0", "-frames:v", "1", "-vf", fitFilter(fit), ...PNG_OUT, "pipe:1"], buffer);
  return png ? { data: png, format: "png", width: fit.canvasWidth, height: fit.canvasHeight } : undefined;
}

/**
 * ffmpeg filter that scales to a fit and pads onto the neutral ground. Ending
 * in RGB keeps `scale` and `pad` in full-resolution colour: in a video's 4:2:0,
 * `pad` rounds odd sizes (512×289) down and fails.
 */
function fitFilter(fit: ReturnType<typeof fitStill>): string {
  return `scale=${fit.width}:${fit.height}:flags=lanczos,pad=${fit.canvasWidth}:${fit.canvasHeight}:(ow-iw)/2:(oh-ih)/2:color=${GROUND.slice(1)},format=rgb24`;
}

/** One PNG image, written to stdout. */
const PNG_OUT = ["-c:v", "png", "-f", "image2pipe"];

function pipeFfmpeg(args: string[], input: Buffer): Promise<Uint8Array | undefined> {
  return new Promise((resolve) => {
    const child = execFile("ffmpeg", args, { encoding: "buffer", maxBuffer: 32 * 1024 * 1024, timeout: 20_000 }, (error, stdout) => {
      resolve(error || !stdout.length ? undefined : new Uint8Array(stdout));
    });
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}

async function probeBuffer(buffer: Buffer): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const child = execFile("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", "-i", "pipe:0"], { timeout: 10_000 }, (error, stdout) => {
      const [width, height] = String(stdout).trim().split(",").map(Number);
      resolve(error || !(width > 0 && height > 0) ? undefined : { width, height });
    });
    child.stdin?.on("error", () => {});
    child.stdin?.end(buffer);
  });
}

/**
 * A still from image bytes: PNG, JPEG or SVG always; WebP, GIF and other
 * formats when ffmpeg is installed. Undefined when the bytes cannot be read.
 */
export async function stillFromBuffer(buffer: Buffer, longSide = 1024): Promise<Still | undefined> {
  try {
    if (isSvg(buffer)) {
      const source = safeSvg(buffer.toString("utf8"));
      const { width, height } = svgSize(source);
      // Vectors have no native resolution: draw them at the requested size.
      const scale = Math.min(longSide, STILL_MAX_SIDE) / Math.max(width, height);
      const fit = fitStill(width * scale, height * scale, longSide);
      return redraw(drawSvg(source, fit.width), width * scale, height * scale, longSide);
    }
    const info = parseImageDimensions(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    if (info && (info.format === "png" || info.format === "jpeg")) {
      return redraw(`data:image/${info.format};base64,${buffer.toString("base64")}`, info.width, info.height, longSide);
    }
    // Bytes that are no known image are not handed to a decoder.
    if (!info && !isAvif(buffer)) return undefined;
    return await viaFfmpeg(buffer, info?.width, info?.height, longSide);
  } catch {
    return undefined;
  }
}

/**
 * An image's own pixels as PNG at its native size: PNG as it is, JPEG redrawn
 * by resvg, anything else decoded by ffmpeg. For masks and layers, which must
 * line up with their source pixel for pixel.
 */
export async function nativePng(buffer: Buffer): Promise<{ png: Buffer; width: number; height: number } | undefined> {
  const info = parseImageDimensions(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  if (info?.format === "png") return { png: buffer, width: info.width, height: info.height };
  try {
    if (info?.format === "jpeg") {
      const image = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><image width="${info.width}" height="${info.height}" preserveAspectRatio="none" href="data:image/jpeg;base64,${buffer.toString("base64")}"/></svg>`, { fitTo: { mode: "original" } }).render();
      return { png: image.asPng(), width: image.width, height: image.height };
    }
    if (!ffmpegAvailable() || (!info && !isAvif(buffer))) return undefined;
    const png = await pipeFfmpeg(["-v", "error", "-i", "pipe:0", "-frames:v", "1", "-vf", "format=rgba", ...PNG_OUT, "pipe:1"], buffer);
    const size = png && parseImageDimensions(png);
    return png && size ? { png: Buffer.from(png), width: size.width, height: size.height } : undefined;
  } catch {
    return undefined;
  }
}

export async function stillFromFile(path: string, longSide = 1024): Promise<Still | undefined> {
  try {
    return await stillFromBuffer(readFileSync(path), longSide);
  } catch {
    return undefined;
  }
}

/**
 * An SVG on a light and a dark ground, large and at 64, 32 and 16 px, so a
 * judge can see whether it holds up on both backgrounds and at icon sizes.
 */
export function svgBoard(markup: string): Still | undefined {
  try {
    const source = safeSvg(markup);
    svgSize(source);
    // Each size is drawn from the vector, as a browser would, not shrunk from the large one.
    const drawn = new Map([352, 64, 32, 16].map((size) => [size, drawSvg(source, size)]));
    const half = (x: number, ground: string) => {
      const smalls = [[64, 112], [32, 216], [16, 288]].map(([size, y]) => {
        const left = x + 448 - size / 2;
        return `<image x="${left}" y="${y}" width="${size}" height="${size}" href="${drawn.get(size)}"/>`;
      });
      return `<rect x="${x}" width="512" height="512" fill="${ground}"/>`
        + `<image x="${x + 24}" y="80" width="352" height="352" href="${drawn.get(352)}"/>${smalls.join("")}`;
    };
    return render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512">${half(0, "#f4f1ea")}${half(512, "#16161a")}</svg>`);
  } catch {
    return undefined;
  }
}

/** Fractions of a clip's length at which frames are sampled, evenly from start to end. */
const FRAME_POSITIONS = [0, 0.2, 0.4, 0.6, 0.8, 1];

/**
 * Frames sampled across a video file, oldest first, each with its time in
 * seconds. The last sample is the clip's final frame, so a loop's seam can be
 * compared with its first. Empty without ffmpeg or for unreadable files.
 */
export async function videoFrames(path: string, longSide = 512): Promise<Array<{ seconds: number; still: Still }>> {
  if (!ffmpegAvailable()) return [];
  try {
    // Local files only, read through ffmpeg's file protocol: a URL or a
    // "concat:"-style name must never make ffmpeg fetch or splice something else.
    if (!statSync(path).isFile()) return [];
    const input = `file:${path}`;
    const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,avg_frame_rate,r_frame_rate:format=duration", "-of", "json", input], { timeout: 10_000 });
    const probe = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string }>; format?: { duration?: string } };
    const stream = probe.streams?.[0];
    const width = stream?.width ?? 0;
    const height = stream?.height ?? 0;
    const duration = Number(probe.format?.duration);
    if (!(width > 0 && height > 0 && duration > 0)) return [];
    const rate = (value?: string) => { const [n, d] = String(value).split("/").map(Number); return n > 0 && d > 0 ? n / d : 0; };
    const fps = rate(stream?.avg_frame_rate) || rate(stream?.r_frame_rate) || 25;
    // Seeking returns the first frame at or after the time asked for, so the last
    // sample asks for a moment inside the final frame, not past it.
    const last = Math.max(0, duration - Math.max(0.1, 1.5 / fps));
    const fit = fitStill(width, height, longSide);
    const frames = await Promise.all(FRAME_POSITIONS.map(async (position) => {
      const seconds = Math.min(duration * position, last);
      const { stdout: png } = await run("ffmpeg", ["-v", "error", "-ss", seconds.toFixed(3), "-i", input, "-frames:v", "1", "-vf", fitFilter(fit), ...PNG_OUT, "pipe:1"],
        { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, timeout: 20_000 });
      return png.length ? { seconds: Math.round(seconds * 100) / 100, still: { data: new Uint8Array(png), format: "png" as const, width: fit.canvasWidth, height: fit.canvasHeight } } : undefined;
    }));
    return frames.every(Boolean) ? frames as Array<{ seconds: number; still: Still }> : [];
  } catch {
    return [];
  }
}
