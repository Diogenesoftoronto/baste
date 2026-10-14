/**
 * fal.ai queue client for Baste's generators and judge.
 *
 * One FAL_KEY covers images, vector SVG, video loops and a vision judge.
 * Requests go through the queue so long video jobs survive slow models:
 * https://docs.fal.ai/model-apis/model-endpoints/queue
 * The key is only ever sent to queue.fal.run; results are downloaded from
 * fal's HTTPS media hosts without credentials.
 */

import { writeFileSync } from "node:fs";

const QUEUE = "https://queue.fal.run";

export interface FalOptions {
  key?: string;
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

/** Download a fal-hosted result without credentials. Returns the URL for provenance. */
export async function falDownload(rawUrl: unknown, outputPath: string, maxBytes = 200 * 1024 * 1024): Promise<string> {
  const url = falMediaUrl(rawUrl);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`fal result download failed (${response.status}).`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) throw new Error("fal result was larger than expected.");
  writeFileSync(outputPath, data);
  return url.toString();
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
