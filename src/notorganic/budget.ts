import { AccountError } from "./server.js";

export const IMAGE_REQUEST_MAX = 500000;
export const JUDGEMENT_REQUEST_MAX = 100000;
export const SEGMENT_REQUEST_MAX = 100000;
export const EDIT_REQUEST_MAX = 500000;
export const ANIMATE_REQUEST_MAX = 3000000;
export function generationPlan(config: { qd: { iterations: number; batchSize: number }; outputCount: number; edit?: boolean; animate?: string }, assetCount: number, requested?: number) {
  const operatorMaxCostMicrousd = Number(process.env.NOTORGANIC_MAX_COST_MICROUSD ?? "10000000");
  const requestedMaxCostMicrousd = requested ?? 1000000;
  if (!Number.isSafeInteger(operatorMaxCostMicrousd) || operatorMaxCostMicrousd <= 0) throw new AccountError(503, "The hosted spending limit is not configured.");
  if (!Number.isSafeInteger(requestedMaxCostMicrousd) || requestedMaxCostMicrousd <= 0) throw new AccountError(400, "Choose a positive spending limit in whole microdollars.");
  if (!Number.isSafeInteger(config.qd.iterations) || config.qd.iterations < 0 || config.qd.iterations > 10 || !Number.isSafeInteger(config.qd.batchSize) || config.qd.batchSize < 1 || config.qd.batchSize > 10 || !Number.isSafeInteger(config.outputCount) || config.outputCount < 1 || config.outputCount > 10) throw new AccountError(400, "Choose 0–10 iterations, 1–10 candidates per batch and 1–10 final variations.");
  const candidates = (config.qd.iterations + 1) * config.qd.batchSize;
  // The first image purpose ships judged candidates instead of drawing new ones; every final output is judged.
  const imageCalls = candidates + config.outputCount * Math.max(0, assetCount - 1);
  const finals = config.outputCount * assetCount;
  const videoCalls = config.animate === "video" || config.animate === "both" ? finals : 0;
  const editedCandidates = config.edit ? config.qd.iterations * Math.ceil(config.qd.batchSize / 2) : 0;
  const layerCalls = config.edit || config.animate ? finals : 0;
  // Each cut tries up to three subject names; end-frame edits may need a separate cut.
  const segmentCalls = 3 * (editedCandidates + layerCalls + videoCalls);
  const editCalls = editedCandidates + layerCalls + videoCalls;
  const judgementCalls = candidates + finals + layerCalls + videoCalls;
  const minimumBudgetMicrousd = imageCalls * IMAGE_REQUEST_MAX + judgementCalls * JUDGEMENT_REQUEST_MAX + segmentCalls * SEGMENT_REQUEST_MAX + editCalls * EDIT_REQUEST_MAX + videoCalls * ANIMATE_REQUEST_MAX;
  return { imageCalls, judgementCalls, segmentCalls, editCalls, videoCalls, minimumBudgetMicrousd, operatorMaxCostMicrousd, requestedMaxCostMicrousd, perImageMaxCostMicrousd: IMAGE_REQUEST_MAX, perJudgementMaxCostMicrousd: JUDGEMENT_REQUEST_MAX, withinOperatorLimit: minimumBudgetMicrousd <= operatorMaxCostMicrousd && requestedMaxCostMicrousd <= operatorMaxCostMicrousd, withinRequestedBudget: minimumBudgetMicrousd <= requestedMaxCostMicrousd };
}
/** The current gateway bounds Jev charges by its conservative token reservation.
 * It does not consume the inference budget header. Using all serialized body
 * characters overestimates its state+question length before we dispatch.
 * Source: notorganic-provider/apps/gateway/src/judgement.ts estimateMicrousd.
 */
export function assertJudgementCeiling(body: BodyInit | null | undefined): void {
  if (typeof body !== "string" || Math.max(50, Math.ceil(Math.ceil(body.length / 4) * 2 * 0.042)) > JUDGEMENT_REQUEST_MAX) throw new AccountError(400, "The quality review is too large for this request's spending limit.");
}

/** Every paid submission consumes its ceiling once. Polls only read an existing reservation. */
export function budgetedTransport(fetcher: (path: string, init?: RequestInit) => Promise<Response>, maximum: number) {
  let remaining = maximum;
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (/^\/v1\/fal\/jobs\/fal_[a-zA-Z0-9_-]{43}$/.test(path) && (!init.method || init.method === "GET")) return fetcher(path, init);
    let cap: number;
    if (path === "/v1/judgement") { cap = JUDGEMENT_REQUEST_MAX; assertJudgementCeiling(init.body); }
    else if (path === "/v1/images/generations") cap = IMAGE_REQUEST_MAX;
    else if (path === "/v1/fal/jobs" && init.method === "POST" && typeof init.body === "string") {
      const { model } = JSON.parse(init.body) as { model?: string };
      const ceilings: Record<string, number> = { "image-edit": EDIT_REQUEST_MAX, "image-segment": SEGMENT_REQUEST_MAX, "image-animate": ANIMATE_REQUEST_MAX };
      cap = ceilings[model ?? ""] ?? 0;
      if (!cap) throw new AccountError(400, "Choose an available hosted media role.");
    } else throw new AccountError(400, "Unsupported paid generation route.");
    if (cap > remaining) throw new AccountError(402, "This suite reached its spending limit. Reduce iterations or assets.");
    remaining -= cap;
    const headers = new Headers(init.headers);
    headers.set("x-notorganic-max-cost-microusd", String(cap));
    return fetcher(path, { ...init, headers });
  };
}
