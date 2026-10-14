import { AccountError } from "./server.js";

export const IMAGE_REQUEST_MAX = 500000;
export const JUDGEMENT_REQUEST_MAX = 100000;
export function generationPlan(config: { qd: { iterations: number; batchSize: number }; outputCount: number }, assetCount: number, requested?: number) {
  const operatorMaxCostMicrousd = Number(process.env.NOTORGANIC_MAX_COST_MICROUSD ?? "10000000");
  const requestedMaxCostMicrousd = requested ?? 1000000;
  if (!Number.isSafeInteger(operatorMaxCostMicrousd) || operatorMaxCostMicrousd <= 0) throw new AccountError(503, "The hosted spending limit is not configured.");
  if (!Number.isSafeInteger(requestedMaxCostMicrousd) || requestedMaxCostMicrousd <= 0) throw new AccountError(400, "Choose a positive spending limit in whole microdollars.");
  if (!Number.isSafeInteger(config.qd.iterations) || config.qd.iterations < 0 || config.qd.iterations > 10 || !Number.isSafeInteger(config.qd.batchSize) || config.qd.batchSize < 1 || config.qd.batchSize > 10 || !Number.isSafeInteger(config.outputCount) || config.outputCount < 1 || config.outputCount > 10) throw new AccountError(400, "Choose 0–10 iterations, 1–10 candidates per batch and 1–10 final variations.");
  const imageCalls = (config.qd.iterations + 1) * config.qd.batchSize + config.outputCount * assetCount;
  const judgementCalls = imageCalls;
  const minimumBudgetMicrousd = imageCalls * IMAGE_REQUEST_MAX + judgementCalls * JUDGEMENT_REQUEST_MAX;
  return { imageCalls, judgementCalls, minimumBudgetMicrousd, operatorMaxCostMicrousd, requestedMaxCostMicrousd, perImageMaxCostMicrousd: IMAGE_REQUEST_MAX, perJudgementMaxCostMicrousd: JUDGEMENT_REQUEST_MAX, withinOperatorLimit: minimumBudgetMicrousd <= operatorMaxCostMicrousd && requestedMaxCostMicrousd <= operatorMaxCostMicrousd, withinRequestedBudget: minimumBudgetMicrousd <= requestedMaxCostMicrousd };
}
/** The current gateway bounds Jev charges by its conservative token reservation.
 * It does not consume the inference budget header. Using all serialized body
 * characters overestimates its state+question length before we dispatch.
 * Source: notorganic-provider/apps/gateway/src/judgement.ts estimateMicrousd.
 */
export function assertJudgementCeiling(body: BodyInit | null | undefined): void {
  if (typeof body !== "string" || Math.max(50, Math.ceil(Math.ceil(body.length / 4) * 2 * 0.042)) > JUDGEMENT_REQUEST_MAX) throw new AccountError(400, "The quality review is too large for this request's spending limit.");
}
