/**
 * Sampling a site (src/samples/ on the server): SAM 3 finds what you name on a
 * captured page, Clairic reads it and judges it against the persona's traits.
 * Types mirror the server's run.json; keep them in step with src/samples/index.ts.
 */

export interface Box { x: number; y: number; w: number; h: number }
export interface Interval { median: number; p10: number; p90: number }
export interface TraitReading extends Interval { id: string; label: string; kind: "value" | "look" | "peeve" }
export interface Judgement { relevance: Interval; traits: TraitReading[] }

export interface Sample {
  id: string;
  box: Box;
  foundBy: string[];
  score: number;
  crop: string;
  cutout?: string;
  original?: { kind: "image" | "svg" | "background"; src?: string; file?: string; alt?: string };
  text?: string;
  judgement?: Judgement;
}

export interface SampleRun {
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
  styles: { background: string; text: string; headingFont: string; headingSize: number; headingColor: string; bodyFont: string; buttonBackground?: string; buttonColor?: string; buttonRadius?: number };
  page: { headline: string | null; primaryAction: string | null; navigation: string[]; density: Interval | null; cornerRadius: Interval | null } | null;
  screen: Judgement | null;
  samples: Sample[];
  notes: string[];
  usage: { clairicInputTokens: number; samPrompts: number };
}

export interface RunSummary { id: string; url: string; title: string; personaId: string; createdAt: string; count: number }
export interface Progress { id: string; status: "running" | "done" | "failed"; stage: string; error?: string; runId?: string }

export const DEFAULT_LOOK_FOR = ["logo", "icon", "illustration or photo", "button"];

/** Traits that clearly show (their 80% interval starts at 4 or more). Mirrors reasons() in src/samples/read.ts. */
export function reasons(traits: TraitReading[] = [], n = 3) {
  return {
    fits: traits.filter((t) => t.kind !== "peeve" && t.p10 >= 4).sort((a, b) => b.median - a.median || b.p10 - a.p10).slice(0, n),
    clashes: traits.filter((t) => t.kind === "peeve" && t.p10 >= 4).sort((a, b) => b.median - a.median).slice(0, n),
  };
}

export class SamplingError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "SamplingError"; }
}

async function call<T>(base: string, path: string, opts: { body?: unknown; csrf?: string; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(`${base.replace(/\/+$/, "")}/samples${path}`, {
    method: opts.body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    signal: opts.signal,
    ...(opts.body === undefined ? {} : { headers: { "Content-Type": "application/json", "X-Baste-CSRF": opts.csrf ?? "" }, body: JSON.stringify(opts.body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new SamplingError(typeof data?.error === "string" ? data.error : `Sampling failed (${response.status}).`, response.status);
  return data as T;
}

export const startSampling = (base: string, body: { url: string; personaId: string; lookFor: string[] }, csrf?: string) => call<Progress>(base, "", { body, csrf });
export const samplingProgress = (base: string, id: string, signal?: AbortSignal) => call<Progress>(base, `/active/${id}`, { signal });
export const cancelSampling = (base: string, id: string, csrf?: string) => call<{ ok: true }>(base, `/active/${id}/cancel`, { body: {}, csrf });
export const listSampleRuns = (base: string, personaId: string, signal?: AbortSignal) => call<RunSummary[]>(base, `?persona=${encodeURIComponent(personaId)}`, { signal });
export const getSampleRun = (base: string, id: string, signal?: AbortSignal) => call<SampleRun>(base, `/${id}`, { signal });
export const keepSample = (base: string, runId: string, sampleId: string, why: string, csrf?: string) =>
  call<{ src: string; kind: "original" | "cutout" | "crop"; personaId: string }>(base, `/${runId}/keep`, { body: { sampleId, why }, csrf });
export const sampleFile = (base: string, runId: string, file: string) => `${base.replace(/\/+$/, "")}/samples/${runId}/${file}`;
