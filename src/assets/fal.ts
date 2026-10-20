/**
 * fal.ai queue client for Baste's generators and judge.
 *
 * One FAL_KEY covers images, vector SVG, video loops and a vision judge.
 * Requests go through the queue so long video jobs survive slow models:
 * https://docs.fal.ai/model-apis/model-endpoints/queue
 * The key is only ever sent to queue.fal.run; results are downloaded from
 * fal's HTTPS media hosts without credentials.
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const QUEUE = "https://queue.fal.run";
const STORAGE = "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3";

export interface FalOptions {
  key?: string;
  notOrganicFetch?: (path: string, init?: RequestInit) => Promise<Response>;
  hostedModel?: "image-edit" | "image-segment" | "image-animate";
  /** Whole-request deadline, including time in the queue. */
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export function falKey(key?: string): string {
  const value = (key ?? process.env.FAL_KEY ?? "").trim();
  if (!value) throw new Error("fal needs FAL_KEY. Set it in the environment or configure the provider's apiKey.");
  return value;
}

/** Submit a job to a fal endpoint, wait for it, and return its JSON result. */
export async function falRun<T = Record<string, unknown>>(endpoint: string, input: object, opts: FalOptions = {}): Promise<T> {
  if (opts.notOrganicFetch) return hostedRun<T>(input, opts);
  if (!/^[a-z0-9-]+\/[a-z0-9._/-]+$/i.test(endpoint) || endpoint.includes("..")) throw new Error(`Invalid fal endpoint: ${endpoint}`);
  const headers = { Authorization: `Key ${falKey(opts.key)}`, "Content-Type": "application/json" };
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 10 * 60_000);
  const interval = opts.pollIntervalMs ?? 1_500;

  const submitted = await fetch(`${QUEUE}/${endpoint}`, { method: "POST", headers, body: JSON.stringify(input), signal, redirect: "error" });
  if (!submitted.ok) throw new Error(`fal ${endpoint} rejected the request (${submitted.status})${await detail(submitted)}`);
  const job = await submitted.json() as { status_url?: string; response_url?: string };
  const statusUrl = queueUrl(job.status_url);
  const responseUrl = queueUrl(job.response_url);

  for (;;) {
    const polled = await fetch(statusUrl, { headers, signal, redirect: "error" });
    if (!polled.ok) throw new Error(`fal ${endpoint} status check failed (${polled.status}).`);
    const { status } = await polled.json() as { status?: string };
    if (status === "COMPLETED") break;
    if (status !== "IN_QUEUE" && status !== "IN_PROGRESS") throw new Error(`fal ${endpoint} returned an unknown status.`);
    await wait(interval, signal);
  }

  const result = await fetch(responseUrl, { headers, signal, redirect: "error" });
  if (!result.ok) throw new Error(`fal ${endpoint} failed (${result.status})${await detail(result)}`);
  return await result.json() as T;
}

/** Account transport owns submission, billing and queue credentials. No direct-fal fallback. */
async function hostedRun<T>(input: object, opts: FalOptions): Promise<T> {
  if (!opts.hostedModel) throw new Error("Choose a hosted media role.");
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 15 * 60_000);
  const submitted = await opts.notOrganicFetch!("/v1/fal/jobs", {
    method: "POST", signal, headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: opts.hostedModel, input }),
  });
  if (!submitted.ok) throw new Error(`Not Organic media submission failed (${submitted.status}).`);
  let job = await submitted.json() as { job_id?: string; status?: string; result?: T };
  if (!/^fal_[a-zA-Z0-9_-]{43}$/.test(job.job_id ?? "")) throw new Error("Not Organic returned an invalid media job.");
  const id = job.job_id!;
  for (;;) {
    if (job.status === "succeeded" && job.result) return job.result;
    if (job.status === "failed") throw new Error(`Not Organic ${opts.hostedModel} failed.`);
    if (job.status !== "queued" && job.status !== "running") throw new Error("Not Organic returned an unknown media status.");
    await wait(opts.pollIntervalMs ?? 1500, signal);
    const response = await opts.notOrganicFetch!(`/v1/fal/jobs/${id}`, { signal });
    if (!response.ok) throw new Error(`Not Organic media status failed (${response.status}).`);
    job = await response.json() as typeof job;
  }
}

/** Download a fal-hosted result into memory, without credentials. */
export async function falDownloadBytes(rawUrl: unknown, maxBytes = 200 * 1024 * 1024): Promise<Buffer> {
  const url = falMediaUrl(rawUrl);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`fal result download failed (${response.status}).`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) throw new Error("fal result was larger than expected.");
  return data;
}

/** Download a fal-hosted result without credentials. Returns the URL for provenance. */
export async function falDownload(rawUrl: unknown, outputPath: string, maxBytes = 200 * 1024 * 1024): Promise<string> {
  writeFileSync(outputPath, await falDownloadBytes(rawUrl, maxBytes));
  return falMediaUrl(rawUrl).toString();
}

/** fal results live on its media CDN; anything else is refused. */
export function falMediaUrl(raw: unknown): URL {
  let url: URL;
  try { url = new URL(String(raw)); } catch { throw new Error("fal returned no result URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !/(^|\.)fal\.media$/.test(url.hostname)) {
    throw new Error("fal returned a result from an unexpected host.");
  }
  return url;
}

function queueUrl(raw: unknown): string {
  let url: URL;
  try { url = new URL(String(raw)); } catch { throw new Error("fal returned no queue URL."); }
  // Polling sends the key, so it may only go back to the queue host.
  if (url.origin !== QUEUE) throw new Error("fal returned an unexpected queue URL.");
  return url.toString();
}

async function detail(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    const message = typeof body.detail === "string" ? body.detail : Array.isArray(body.detail) ? (body.detail[0] as { msg?: string })?.msg : undefined;
    if (message === "User is locked. Reason: TOP_UP.") return ": the fal account needs a balance top-up";
    return message ? `: ${String(message).slice(0, 200)}` : "";
  } catch {
    return "";
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error("fal request timed out.")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Pixel size for an aspect ratio, within the long-edge budget most fal image models accept. */
export function sizeForRatio(ratio: string | undefined, longEdge = 2048): { width: number; height: number } {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(ratio ?? "1:1");
  const [w, h] = match ? [Number(match[1]), Number(match[2])] : [1, 1];
  const scale = longEdge / Math.max(w, h);
  // Multiples of 16 keep every model's latent grid happy.
  const snap = (n: number) => Math.max(512, Math.round((n * scale) / 16) * 16);
  return { width: snap(w), height: snap(h) };
}

/**
 * Upload bytes to fal's storage and return their fal.media URL. The key goes
 * only to fal's REST host; the signed upload URL it returns is used without it.
 * https://fal.ai/docs/model-apis/model-endpoints/files
 */
export async function falUpload(data: Uint8Array, contentType: string, opts: FalOptions & { fileName?: string } = {}): Promise<string> {
  if (opts.notOrganicFetch) return inlineImage(data, contentType);
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 120_000);
  const initiated = await fetch(STORAGE, {
    method: "POST", signal, redirect: "error",
    headers: { Authorization: `Key ${falKey(opts.key)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType, file_name: opts.fileName ?? `baste-${Date.now()}.${contentType.split("/")[1] ?? "bin"}` }),
  });
  if (!initiated.ok) throw new Error(`fal storage refused the upload (${initiated.status})${await detail(initiated)}`);
  const { upload_url: uploadUrl, file_url: fileUrl } = await initiated.json() as { upload_url?: string; file_url?: string };
  const target = new URL(String(uploadUrl));
  if (target.protocol !== "https:" || target.username || target.password) throw new Error("fal returned an unexpected upload URL.");
  const put = await fetch(target, { method: "PUT", body: new Blob([Buffer.from(data)], { type: contentType }), headers: { "Content-Type": contentType }, signal, redirect: "error" });
  if (!put.ok) throw new Error(`fal storage upload failed (${put.status}).`);
  return falMediaUrl(fileUrl).toString();
}

/** Files at or under this size go to fal inline as data URIs; larger ones are uploaded. */
export const FAL_INLINE_MAX = 1024 * 1024;

/** Uploads by file and version, so several edits of one image upload it once. */
const uploads = new Map<string, Promise<string>>();

const IMAGE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/**
 * An image fal can read: the asset's own fal URL when it came from fal, the
 * file inline when it is small, or an upload to fal's storage.
 */
export async function falImageInput(path: string, opts: FalOptions & { sourceUrl?: string; upload?: boolean } = {}): Promise<string> {
  if (opts.sourceUrl) {
    try { return falMediaUrl(opts.sourceUrl).toString(); } catch { /* not on fal: send the file */ }
  }
  const contentType = IMAGE_TYPES[extname(path).toLowerCase()];
  if (!contentType) throw new Error(`fal image inputs must be PNG, JPEG or WebP: ${path}`);
  const { size, mtimeMs } = statSync(path);
  if (opts.notOrganicFetch) return inlineImage(readFileSync(path), contentType);
  if (size <= FAL_INLINE_MAX && !opts.upload) return `data:${contentType};base64,${readFileSync(path).toString("base64")}`;
  const key = `${path}\n${size}\n${mtimeMs}`;
  let pending = uploads.get(key);
  if (!pending) {
    pending = falUpload(readFileSync(path), contentType, opts);
    uploads.set(key, pending);
    pending.catch(() => uploads.delete(key));
    while (uploads.size > 64) uploads.delete(uploads.keys().next().value!);
  }
  return pending;
}

/** Bytes as a data URI for fal, uploaded instead when they are large. */
export async function falBytesInput(data: Uint8Array, contentType: string, opts: FalOptions = {}): Promise<string> {
  if (opts.notOrganicFetch) return inlineImage(data, contentType);
  if (data.length <= FAL_INLINE_MAX) return `data:${contentType};base64,${Buffer.from(data).toString("base64")}`;
  return falUpload(data, contentType, opts);
}

function inlineImage(data: Uint8Array, type: string): string {
  if (data.length > 8 * 1024 * 1024) throw new Error("Hosted media inputs must be at most 8 MiB.");
  return `data:${type};base64,${Buffer.from(data).toString("base64")}`;
}
