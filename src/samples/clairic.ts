/**
 * Clairic (Cloudflare Workers AI) — typed values read out of images and text.
 * https://developers.cloudflare.com/workers-ai/models/clairic/
 *
 * One forward pass per field group, no generated prose: `text` answers are
 * read from the image or quoted from the state, `estimate` answers are a
 * median with an 80% interval (p10–p90). Measured behaviour that shapes how
 * Baste asks:
 *   - It reads words written in an image well (headlines, button labels, logo
 *     names), but cannot report values that are not written there: asked for a
 *     hex colour it quotes the state instead. Colours and fonts come from the
 *     DOM or pixels, never from Clairic.
 *   - `text` and `list` answers lean on the state: an absent value is quoted
 *     from it, and with a long state (a persona) lists quote it at near-zero
 *     confidence. Images are read with an empty state, and reasons are
 *     per-trait estimates, not quoted lists.
 *
 * Transport: direct to Cloudflare with CLOUDFLARE_AI_API_TOKEN and
 * CLOUDFLARE_ACCOUNT_ID, for local Baste only. Upstream text can echo the
 * request, so failures are reported as fixed categories.
 */

export type ClairicFieldType = "text" | "number" | "list" | "estimate";

export interface ClairicField {
  type: ClairicFieldType;
  instructions?: string;
  items?: "text";
  min?: number;
  max?: number;
  step?: number;
  null_threshold?: number;
}

export interface ClairicRequest {
  state: string;
  fields: Record<string, ClairicField>;
  /** PNG, JPEG or WebP, at most four, 4 MiB each. */
  images?: Array<{ data: Uint8Array; contentType: "image/png" | "image/jpeg" | "image/webp" }>;
}

export interface Interval { median: number; p10: number; p90: number }

export type ClairicAnswer =
  | { type: "text"; value: string | null; guess: string | null; pNull: number }
  | { type: "number"; value: number | null; pNull: number }
  | { type: "list"; value: string[]; confidence: number }
  | ({ type: "estimate" } & Interval);

export interface ClairicResult {
  answers: Record<string, ClairicAnswer | undefined>;
  inputTokens: number;
  truncated: boolean;
}

export class ClairicError extends Error {
  constructor(readonly category: "unavailable" | "rate-limited" | "rejected" | "provider" | "timeout") {
    super({
      unavailable: "Clairic isn't configured on this Baste server.",
      "rate-limited": "Clairic is rate limited. Try again in a minute.",
      rejected: "Clairic rejected the request.",
      provider: "Clairic could not answer.",
      timeout: "Clairic took too long to answer.",
    }[category]);
    this.name = "ClairicError";
  }
}

export const CLAIRIC_LIMITS = { images: 4, imageBytes: 4 * 1024 * 1024, totalImageBytes: 8 * 1024 * 1024 } as const;

export function clairicAvailable(accountMode: boolean): boolean {
  return !accountMode && !!process.env.CLOUDFLARE_AI_API_TOKEN && !!process.env.CLOUDFLARE_ACCOUNT_ID;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const probability = (value: unknown): number => finite(value) && value >= 0 && value <= 1 ? value : 1;

/** One field's answer, or undefined when it does not match what was asked. */
export function readAnswer(field: ClairicField, raw: unknown): ClairicAnswer | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  switch (field.type) {
    case "text": {
      const value = typeof a.value === "string" ? a.value : a.value === null ? null : undefined;
      if (value === undefined) return undefined;
      return { type: "text", value, guess: typeof a.guess === "string" ? a.guess : value, pNull: probability(a.p_null) };
    }
    case "number":
      if (!(finite(a.value) || a.value === null)) return undefined;
      return { type: "number", value: a.value as number | null, pNull: probability(a.p_null) };
    case "list":
      if (!Array.isArray(a.value) || !a.value.every((item) => typeof item === "string")) return undefined;
      return { type: "list", value: a.value as string[], confidence: finite(a.confidence) ? a.confidence : 0 };
    case "estimate": {
      const { median, p10, p90 } = a;
      const lo = field.min ?? -Infinity, hi = field.max ?? Infinity;
      if (![median, p10, p90].every((n) => finite(n) && n >= lo && n <= hi)) return undefined;
      if (!((p10 as number) <= (median as number) && (median as number) <= (p90 as number))) return undefined;
      return { type: "estimate", median: median as number, p10: p10 as number, p90: p90 as number };
    }
  }
}

export async function clairic(request: ClairicRequest, options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}): Promise<ClairicResult> {
  const token = process.env.CLOUDFLARE_AI_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) throw new ClairicError("unavailable");
  if (!request.state && !request.images?.length) throw new ClairicError("rejected");
  const images = request.images ?? [];
  if (images.length > CLAIRIC_LIMITS.images || images.some((i) => i.data.byteLength > CLAIRIC_LIMITS.imageBytes)
    || images.reduce((n, i) => n + i.data.byteLength, 0) > CLAIRIC_LIMITS.totalImageBytes) throw new ClairicError("rejected");
  const body = {
    model: "clairic",
    state: request.state,
    fields: request.fields,
    ...(images.length ? { images: images.map((i) => `data:${i.contentType};base64,${Buffer.from(i.data).toString("base64")}`) } : {}),
  };
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run/@cf/cloudflare/clairic`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal ?? AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new ClairicError((error as Error)?.name === "TimeoutError" || (error as Error)?.name === "AbortError" ? "timeout" : "provider");
  }
  if (response.status === 429) throw new ClairicError("rate-limited");
  if ([400, 413, 422].includes(response.status)) throw new ClairicError("rejected");
  if (!response.ok) throw new ClairicError("provider");
  const json = await response.json().catch(() => null) as Record<string, unknown> | null;
  const payload = (json?.result ?? json) as Record<string, unknown> | null;
  if (!payload || typeof payload.model !== "string" || !/^(?:clairic|@cf\/cloudflare\/clairic)(?:[-@:.][\w.-]+)?$/.test(payload.model)
    || !payload.answers || typeof payload.answers !== "object") throw new ClairicError("provider");
  const raw = payload.answers as Record<string, unknown>;
  const answers = Object.fromEntries(Object.entries(request.fields).map(([name, field]) => [name, readAnswer(field, raw[name])]));
  const usage = payload.usage as Record<string, unknown> | undefined;
  return { answers, inputTokens: finite(usage?.input_tokens) ? usage!.input_tokens as number : 0, truncated: payload.truncated === true };
}

/** A text answer the model is reasonably sure is present, trimmed, or null. */
export function presentText(answer: ClairicAnswer | undefined, maxPNull = 0.3): string | null {
  return answer?.type === "text" && answer.value && answer.pNull <= maxPNull ? answer.value.trim() || null : null;
}

export function estimateOf(answer: ClairicAnswer | undefined): Interval | null {
  return answer?.type === "estimate" ? { median: answer.median, p10: answer.p10, p90: answer.p90 } : null;
}
