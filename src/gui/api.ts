/**
 * Baste GUI API - REST endpoints for the web interface
 *
 * Provides CRUD operations for personas and config management.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, writeFileSync, existsSync, realpathSync, statSync } from "node:fs";
import { resolve, join, basename, sep } from "node:path";
import type { Persona } from "../persona/types.js";
import {
  getPersona,
  listPersonas,
  savePersona,
  deletePersona,
  isBasePersona,
} from "../notorganic/personas.js";
import { accountScope, accountPath, accountKey } from "../notorganic/scope.js";
import { accountManager, accountEnabled, publicOrigin, guardOrigin, AccountError, readJSON, normalizeWallet } from "../notorganic/server.js";
import { generationPlan, IMAGE_REQUEST_MAX, JUDGEMENT_REQUEST_MAX, assertJudgementCeiling } from "../notorganic/budget.js";
import { extendPersona } from "../persona/builder.js";
import { resolveConfig, toBasteConfig, type BasteUserConfig } from "../config/baste-config.js";
import { generateAssetSuite, generateUIKit } from "../baste.js";
import { generateDesignTokens, exportCSS, exportTailwindConfig, exportPandaTheme } from "../assets/design-system.js";
import { slugifyUrl, safeFetch } from "../shared/url.js";
import { loadBrandKit, saveBrandKit } from "../notorganic/brandkits.js";
import { DesignVersionRegistry } from "../versioning/registry.js";
import {
  appendFeedback,
  buildLearnedPreferencesDocument,
  summarizeFeedback,
} from "../evaluation/feedback-memory.js";
import {
  personaToOpenPencil,
  serializeOpenPencil,
  deserializeOpenPencil,
  extractTokensFromOpenPencil,
} from "../openpencil/bridge.js";
import { watch, type FSWatcher } from "node:fs";
import { applyProjectCommand, createProject, getProject, listProjects, ProjectError } from "../projects/commands.js";

const DEFAULT_CONFIG_PATH = "./baste.config.json";

// In-memory moodboard + ranking store (persisted to disk best-effort)
interface Moodboard {
  personaId: string;
  references: Array<{ id: string; src: string; tags: string[]; pinned: boolean; addedAt: number }>;
  notes: string;
  vibe: string[];
}
interface AssetRank {
  owner?: string;
  assetId: string;
  personaId: string;
  score: number; // -1, 0, +1
  feedback: string;
  ts: number;
}
const moodboards = new Map<string, Moodboard>();
const ranks: AssetRank[] = [];
const MOODBOARD_FILE = ".baste/moodboards.json";
const RANKS_FILE = ".baste/ranks.json";
function boardKey(id: string): string { return accountKey() ? `${accountKey()}:${id}` : id; }

import { mkdirSync } from "node:fs";

function persistMoodboards(): void {
  try {
    const dir = resolve(".baste");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(MOODBOARD_FILE), JSON.stringify(Array.from(moodboards.entries()), null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn(`[gui/api] Failed to persist moodboards: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function persistRanks(): void {
  try {
    const dir = resolve(".baste");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(RANKS_FILE), JSON.stringify(ranks, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn(`[gui/api] Failed to persist ranks: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function loadStores(): void {
  try {
    if (existsSync(resolve(MOODBOARD_FILE))) {
      const data = JSON.parse(readFileSync(resolve(MOODBOARD_FILE), "utf-8")) as Array<Moodboard | [string, Moodboard]>;
      data.forEach((m) => Array.isArray(m) ? moodboards.set(m[0], m[1]) : moodboards.set(m.personaId, m));
    }
    if (existsSync(resolve(RANKS_FILE))) {
      const data = JSON.parse(readFileSync(resolve(RANKS_FILE), "utf-8")) as AssetRank[];
      ranks.push(...data);
    }
  } catch (err) {
    console.warn(`[gui/api] Failed to load stores: ${err instanceof Error ? err.message : String(err)}`);
  }
}
loadStores();

// Active generation jobs for SSE streaming
interface GenerationJob {
  owner?: string;
  id: string;
  personaId: string;
  type: "suite" | "ui-kit";
  status: "running" | "completed" | "error";
  logs: string[];
  result?: unknown;
  error?: string;
}

const jobs = new Map<string, GenerationJob>();
let jobIdCounter = 0;

function makeJobId(): string {
  return `job-${++jobIdCounter}-${Date.now()}`;
}

interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void>;
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return readJSON(req);
}

async function corsMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
): Promise<void> {
  if (req.headers?.origin === publicOrigin()) res.setHeader("Access-Control-Allow-Origin", publicOrigin());
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Baste-CSRF");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  await next();
}

/**
 * Route: GET /api/personas
 * List all personas (base + custom) with their source.
 */
const listPersonasHandler: RouteHandler = async (_req, res) => {
  const ids = listPersonas();
  const personas = ids.map((id) => {
    const p = getPersona(id)!;
    return { ...p, _source: isBasePersona(id) ? "base" : "custom" };
  });
  json(res, personas);
};

/**
 * Route: GET /api/personas/:id
 * Get a single persona.
 */
const getPersonaHandler: RouteHandler = async (_req, res, params) => {
  const persona = getPersona(params.id);
  if (!persona) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }
  json(res, { ...persona, _source: isBasePersona(params.id) ? "base" : "custom" });
};

/**
 * Route: POST /api/personas
 * Create a new custom persona.
 */
const createPersonaHandler: RouteHandler = async (req, res) => {
  const body = await parseBody(req) as Persona;
  if (!body.id || !body.name) {
    json(res, { error: "id and name are required" }, 400);
    return;
  }
  if (isBasePersona(body.id)) {
    json(res, { error: `Cannot overwrite base persona "${body.id}"` }, 400);
    return;
  }
  savePersona(body);
  json(res, { success: true, id: body.id });
};

/**
 * Route: PUT /api/personas/:id
 * Update an existing custom persona.
 */
const updatePersonaHandler: RouteHandler = async (req, res, params) => {
  const body = await parseBody(req) as Partial<Persona>;
  const existing = getPersona(params.id);
  if (!existing) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }
  if (isBasePersona(params.id)) {
    json(res, { error: "Cannot modify base personas" }, 400);
    return;
  }
  const updated: Persona = { ...existing, ...body, id: params.id };
  savePersona(updated);
  json(res, { success: true, id: params.id });
};

/**
 * Route: DELETE /api/personas/:id
 * Delete a custom persona.
 */
const deletePersonaHandler: RouteHandler = async (_req, res, params) => {
  const success = deletePersona(params.id);
  if (!success) {
    json(res, { error: "Cannot delete base persona or not found" }, 400);
    return;
  }
  json(res, { success: true });
};

/**
 * Route: GET /api/config
 * Get current config.
 */
const getConfigHandler: RouteHandler = async (_req, res) => {
  const config = resolveConfig();
  // Configuration keys and custom server endpoints never belong in browser responses.
  const safe = JSON.parse(JSON.stringify(config, (key, value) => /key|secret|token|baseurl/i.test(key) ? undefined : value));
  json(res, accountEnabled() ? { ...safe, generators: { image: { provider: "notorganic", model: "image" } }, evaluator: { provider: "notorganic", model: "judgement" } } : safe);
};

/**
 * Route: POST /api/config
 * Save/update config.
 */
const saveConfigHandler: RouteHandler = async (req, res) => {
  if (accountEnabled()) throw new AccountError(403, "Hosted provider configuration is managed by the server operator.");
  const body = await parseBody(req) as BasteUserConfig;
  try {
    writeFileSync(resolve(DEFAULT_CONFIG_PATH), JSON.stringify(body, null, 2));
    json(res, { success: true });
  } catch (err) {
    json(res, { error: "Configuration could not be saved." }, 500);
  }
};

/**
 * Route: GET /api/health
 * Health check.
 */
const healthHandler: RouteHandler = async (_req, res) => {
  json(res, { status: "ok", version: "0.2.0" });
};
interface GenerateRequest {
  type?: string; assetTypes?: unknown[]; dryRun?: boolean; imageProvider?: string;
  imageModel?: string; videoProvider?: string; videoModel?: string;
  maxCostMicrousd?: number; qd?: { iterations?: number; batchSize?: number }; outputCount?: number;
}
function applyRunSettings(config: ReturnType<typeof toBasteConfig>, body: GenerateRequest): void {
  if (body.qd?.iterations !== undefined) config.qd.iterations = body.qd.iterations;
  if (body.qd?.batchSize !== undefined) config.qd.batchSize = body.qd.batchSize;
  if (body.outputCount !== undefined) config.outputCount = body.outputCount;
}
const generationPlanHandler: RouteHandler = async (req, res, params) => {
  if (!getPersona(params.id)) throw new AccountError(404, "Persona not found.");
  if (!accountEnabled()) throw new AccountError(400, "Spending plans are available for Not Organic account generation.");
  const body = await parseBody(req) as GenerateRequest;
  const config = toBasteConfig(resolveConfig(), { imageProvider: "notorganic", imageModel: "image" });
  applyRunSettings(config, body);
  const assets = body.assetTypes ?? [{ kind: "image" }, { kind: "image" }];
  if (!Array.isArray(assets) || assets.length < 1 || assets.length > 8 || assets.some(a => !a || typeof a !== "object" || (a as { kind?: string }).kind !== "image")) throw new AccountError(400, "Choose 1–8 image assets for the spending plan.");
  json(res, generationPlan(config, assets.length, body.maxCostMicrousd));
};

/**
 * Route: POST /api/generate/:id
 * Start asset generation for a persona (non-blocking, returns job id).
 */
const generateHandler: RouteHandler = async (req, res, params) => {
  const persona = getPersona(params.id);
  if (!persona) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }

  const body = await parseBody(req) as GenerateRequest;
  const context = await accountManager.getContext(req);
  if (context && body.assetTypes && (!Array.isArray(body.assetTypes) || body.assetTypes.length === 0 || body.assetTypes.length > 8 || body.assetTypes.some(a => !a || typeof a !== "object" || typeof (a as { purpose?: unknown }).purpose !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(String((a as { purpose?: unknown }).purpose)) || typeof (a as { description?: unknown }).description !== "string" || String((a as { description?: unknown }).description).length > 4000))) throw new AccountError(400, "Choose up to eight image assets with simple purpose names and descriptions under 4,000 characters.");
  if (context && (body.type === "ui-kit" || body.videoProvider || body.videoModel || (body.imageProvider && body.imageProvider !== "notorganic") || (body.imageModel && body.imageModel !== "image") || body.assetTypes?.some(a => !a || typeof a !== "object" || (a as { kind?: string }).kind !== "image"))) {
    throw new AccountError(400, "Your Not Organic account supports image assets here. Choose an image suite; hosted SVG and video generation are unavailable.");
  }
  const config = resolveConfig();
  const basteConfig = toBasteConfig(config, {
    imageProvider: context ? "notorganic" : body.imageProvider,
    imageModel: context ? "image" : body.imageModel,
    videoProvider: body.videoProvider,
    videoModel: body.videoModel,
  });
  applyRunSettings(basteConfig, body);
  if (context && !body.dryRun) {
    const plan = generationPlan(basteConfig, body.assetTypes?.length ?? 2, body.maxCostMicrousd);
    if (plan.requestedMaxCostMicrousd > plan.operatorMaxCostMicrousd) throw new AccountError(400, `Choose a spending limit no higher than the server's $${(plan.operatorMaxCostMicrousd / 1000000).toFixed(2)} limit.`);
    if (!plan.withinOperatorLimit) throw new AccountError(400, `This plan needs a ceiling of $${(plan.minimumBudgetMicrousd / 1000000).toFixed(2)}. The server allows $${(plan.operatorMaxCostMicrousd / 1000000).toFixed(2)} per suite. Reduce iterations, batch size or final variations.`);
    if (!plan.withinRequestedBudget) throw new AccountError(400, `This plan needs a ceiling of $${(plan.minimumBudgetMicrousd / 1000000).toFixed(2)}. Increase your spending limit or reduce iterations, batch size or final variations.`);
    const models = await (await context.fetch("/v1/models")).json() as { data?: Array<{ id: string }> };
    if (!models.data?.some(m => m.id === "image") || !models.data.some(m => m.id === "judgement")) throw new AccountError(503, "Not Organic must enable image generation and Jev judgement for this suite.");
    const wallet = normalizeWallet(await (await context.fetch("/v1/wallet")).json());
    if (wallet.blocked || wallet.availableMicros < plan.minimumBudgetMicrousd) throw new AccountError(402, `Your available Not Organic credit must cover this plan's $${(plan.minimumBudgetMicrousd / 1000000).toFixed(2)} ceiling before generation starts. Open your wallet in Settings.`);
    let remainingBudget = plan.requestedMaxCostMicrousd;
    // Reserve every request's cost ceiling before dispatch, so concurrent QD candidates
    // cannot exceed the operator's per-suite budget even if the upstream fails.
    const budgetedFetch = async (path: string, init: RequestInit = {}) => {
      const requestBudget = path === "/v1/judgement" ? JUDGEMENT_REQUEST_MAX : IMAGE_REQUEST_MAX;
      if (requestBudget > remainingBudget) throw new AccountError(402, "This suite reached its spending limit. Reduce the number of iterations or assets.");
      if (path === "/v1/judgement") assertJudgementCeiling(init.body);
      remainingBudget -= requestBudget;
      const headers = new Headers(init.headers);
      headers.set("x-notorganic-max-cost-microusd", String(requestBudget));
      return context.fetch(path, { ...init, headers });
    };
    basteConfig.generation.notOrganicFetch = budgetedFetch;
    basteConfig.generation.outputDir = accountPath("assets/output", "assets/output");
    basteConfig.evaluator = { ...basteConfig.evaluator, provider: "notorganic", model: "judgement", apiKey: undefined, baseUrl: undefined, notOrganicFetch: budgetedFetch };
  }

  const jobId = makeJobId();
  const job: GenerationJob = {
    owner: accountScope.getStore(),
    id: jobId,
    personaId: params.id,
    type: body.type === "ui-kit" ? "ui-kit" : "suite",
    status: "running",
    logs: [`Starting generation for "${persona.name}"...`],
  };
  jobs.set(jobId, job);

  // Respond immediately with job ID
  json(res, { jobId, status: "started" }, 202);

  // Run generation in background
  (async () => {
    try {
      if (body.dryRun) {
        job.logs.push("[DRY RUN] Prompts would be generated but no API calls made.");
        const { generatePrompts } = await import("../generation/prompts.js");
        const prompts = generatePrompts(persona, { kind: "image", purpose: "hero", description: "Hero banner" });
        job.logs.push(`Sample image prompt: ${prompts.image.prompt.slice(0, 120)}...`);
        job.status = "completed";
        job.result = { dryRun: true, samplePrompt: prompts.image.prompt };
        return;
      }

      if (job.type === "ui-kit") {
        job.logs.push("Generating full UI kit...");
        const suite = await generateUIKit(persona, basteConfig);
        job.logs.push(`Done: ${suite.assets.svgs.length} SVGs, ${suite.assets.images.length} images, ${suite.assets.videos.length} videos`);
        job.result = {
          svgs: suite.assets.svgs.map(a => assetSummary(a, "svg", !!context)),
          images: suite.assets.images.map(a => assetSummary(a, "images", !!context)),
          videos: suite.assets.videos.map(a => assetSummary(a, "videos", !!context)),
          metadata: suite.metadata,
        };
      } else {
        const assetTypes = body.assetTypes && Array.isArray(body.assetTypes)
          ? body.assetTypes as Array<{ kind: "svg" | "image" | "video"; purpose: string; description: string }>
          : [
              ...(context ? [] : [{ kind: "svg" as const, purpose: "icon", description: "App icon" }]),
              { kind: "image" as const, purpose: "hero", description: "Hero banner" },
              { kind: "image" as const, purpose: "background", description: "Ambient background" },
            ];
        job.logs.push(`Generating ${assetTypes.length} asset types...`);
        const suite = await generateAssetSuite(persona, assetTypes, basteConfig);
        job.logs.push(`Done: ${suite.assets.svgs.length} SVGs, ${suite.assets.images.length} images, ${suite.assets.videos.length} videos`);
        job.result = {
          svgs: suite.assets.svgs.map(a => assetSummary(a, "svg", !!context)),
          images: suite.assets.images.map(a => assetSummary(a, "images", !!context)),
          videos: suite.assets.videos.map(a => assetSummary(a, "videos", !!context)),
          metadata: suite.metadata,
        };
      }
      job.status = "completed";
    } catch (err) {
      job.status = "error";
      job.error = context ? (err instanceof AccountError ? err.message : "Generation could not finish. Check your account balance and try again.") : String(err);
      job.logs.push(`Error: ${job.error}`);
    }
  })();
};

function assetSummary(asset: { id: string; content: string; metadata: { assetPurpose: string } }, kind: string, hosted: boolean) {
  const file = basename(asset.content);
  return { id: asset.id, purpose: asset.metadata.assetPurpose, path: hosted ? file : asset.content, url: `/api/assets/${kind}/${encodeURIComponent(file)}` };
}

/** Only media inside the requesting account's output directory can be downloaded. */
const getAssetHandler: RouteHandler = async (_req, res, params) => {
  const { id: kind, assetId: file } = params;
  const mime: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4" };
  const extension = file?.split(".").pop()?.toLowerCase() ?? "";
  if (!file || !/^[a-zA-Z0-9_.-]{1,255}$/.test(file) || file.includes("..") || !mime[extension] || (accountEnabled() && (kind !== "images" || !["png", "jpg", "jpeg", "webp"].includes(extension)))) throw new AccountError(404, "Asset not found.");
  const localRoot = toBasteConfig(resolveConfig()).generation.outputDir;
  const root = accountPath(`assets/output/${kind}`, join(localRoot, kind));
  let path: string;
  try {
    const realRoot = realpathSync(root);
    path = realpathSync(join(root, file));
    if (!path.startsWith(`${realRoot}${sep}`) || !statSync(path).isFile()) throw new Error();
  } catch { throw new AccountError(404, "Asset not found."); }
  res.writeHead(200, { "Content-Type": mime[extension], "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" });
  res.end(readFileSync(path));
};

/**
 * Route: GET /api/jobs/:id
 * Get job status and logs.
 */
const getJobHandler: RouteHandler = async (_req, res, params) => {
  const job = jobs.get(params.id);
  if (!job || job.owner !== accountScope.getStore()) {
    json(res, { error: "Job not found" }, 404);
    return;
  }
  json(res, {
    id: job.id,
    personaId: job.personaId,
    type: job.type,
    status: job.status,
    logs: job.logs,
    result: job.result,
    error: job.error,
  });
};

/**
 * Route: GET /api/jobs
 * List recent jobs.
 */
const listJobsHandler: RouteHandler = async (_req, res) => {
  const all = Array.from(jobs.values()).filter(job => job.owner === accountScope.getStore()).sort((a, b) => {
    const na = Number(a.id.split("-")[2]);
    const nb = Number(b.id.split("-")[2]);
    return nb - na;
  });
  json(res, all.map(j => ({ id: j.id, personaId: j.personaId, type: j.type, status: j.status })));
};

/**
 * Route: POST /api/tokens/:id
 * Export design tokens for a persona.
 */
const exportTokensHandler: RouteHandler = async (req, res, params) => {
  const persona = getPersona(params.id);
  if (!persona) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }
  const body = await parseBody(req) as { format?: string };
  const format = body.format || "css";
  const brandKit = loadBrandKit(params.id);

  let output = "";
  let ext = "";
  switch (format) {
    case "css":
      output = exportCSS(persona, brandKit);
      ext = "css";
      break;
    case "tailwind":
      output = exportTailwindConfig(persona, brandKit);
      ext = "js";
      break;
    case "json":
      output = JSON.stringify(generateDesignTokens(persona, brandKit), null, 2);
      ext = "json";
      break;
    case "panda":
      output = exportPandaTheme(persona, brandKit);
      ext = "ts";
      break;
    default:
      json(res, { error: "Unknown format. Use css, tailwind, json, or panda" }, 400);
      return;
  }

  json(res, { format, ext, content: output, personaId: params.id });
};

/**
 * Route: POST /api/prompts/:id
 * Preview prompts without generating.
 */
const previewPromptsHandler: RouteHandler = async (_req, res, params) => {
  const persona = getPersona(params.id);
  if (!persona) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }
  const { generatePrompts } = await import("../generation/prompts.js");
  const prompts = generatePrompts(persona, { kind: "image", purpose: "hero", description: "Hero banner" });
  json(res, {
    personaId: params.id,
    image: prompts.image,
    svg: prompts.svg,
    video: prompts.video,
  });
};

/** GET /api/moodboard/:id — get a persona's moodboard */
const getMoodboardHandler: RouteHandler = async (_req, res, params) => {
  const board = moodboards.get(boardKey(params.id)) || { personaId: params.id, references: [], notes: "", vibe: [] };
  json(res, board);
};

/** PUT /api/moodboard/:id — replace board */
const putMoodboardHandler: RouteHandler = async (req, res, params) => {
  const body = (await parseBody(req)) as Partial<Moodboard>;
  const board: Moodboard = {
    personaId: params.id,
    references: body.references || [],
    notes: body.notes || "",
    vibe: body.vibe || [],
  };
  moodboards.set(boardKey(params.id), board);
  persistMoodboards();
  json(res, { success: true });
};

/** POST /api/moodboard/:id/reference — add a reference */
const addReferenceHandler: RouteHandler = async (req, res, params) => {
  const body = (await parseBody(req)) as { src: string; tags?: string[] };
  if (!body.src) {
    json(res, { error: "src required" }, 400);
    return;
  }
  const board = moodboards.get(boardKey(params.id)) || { personaId: params.id, references: [], notes: "", vibe: [] };
  const ref = {
    id: `ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    src: body.src,
    tags: body.tags || [],
    pinned: false,
    addedAt: Date.now(),
  };
  board.references.push(ref);
  moodboards.set(boardKey(params.id), board);
  persistMoodboards();
  json(res, ref);
};

/** POST /api/rank — submit an asset ranking */
const rankAssetHandler: RouteHandler = async (req, res) => {
  const body = (await parseBody(req)) as Partial<AssetRank> & {
    assetType?: "svg" | "image" | "video";
    prompt?: string;
    features?: number[];
    tags?: string[];
  };
  if (!body.assetId || !body.personaId || typeof body.score !== "number") {
    json(res, { error: "assetId, personaId, score required" }, 400);
    return;
  }
  const entry: AssetRank = {
    owner: accountScope.getStore(),
    assetId: body.assetId,
    personaId: body.personaId,
    score: Math.max(-1, Math.min(1, body.score)),
    feedback: body.feedback || "",
    ts: Date.now(),
  };
  ranks.push(entry);
  persistRanks();

  // Mirror into the learned-preferences memory so the judge can consume it
  // on subsequent generations.
  appendFeedback({
    personaId: entry.personaId,
    score: entry.score,
    feedback: entry.feedback,
    assetId: entry.assetId,
    assetType: body.assetType,
    prompt: body.prompt,
    features: body.features,
    tags: body.tags,
    ts: entry.ts,
  });

  json(res, { success: true, total: ranks.filter(r => r.owner === accountScope.getStore()).length });
};

/** GET /api/feedback/:id — returns the learned-preferences document fed to the judge. */
const getFeedbackHandler: RouteHandler = async (_req, res, params) => {
  const summary = summarizeFeedback(params.id);
  const document = buildLearnedPreferencesDocument(params.id);
  json(res, { ...summary, document });
};

// ── OpenPencil edit loop ─────────────────────────────────────────────────────
const OPENPENCIL_DIR = ".baste/openpencil";

function openpencilPath(id: string): string {
  return resolve(join(OPENPENCIL_DIR, `${id}.openpencil.json`));
}

function ensureOpenpencilDir(): string {
  const dir = resolve(OPENPENCIL_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

const openpencilWatchers = new Map<string, FSWatcher>();

function importOpenPencilEdits(personaId: string, json: string): { ok: boolean; error?: string } {
  try {
    const doc = deserializeOpenPencil(json);
    const partial = extractTokensFromOpenPencil(doc);
    const kit = loadBrandKit(personaId) ?? {
      sourceUrl: `openpencil:${personaId}`,
      fetchedAt: new Date().toISOString(),
      title: doc.metadata.personaName,
      description: "OpenPencil-edited persona",
      palette: [],
      paletteRoles: {},
      fonts: [],
      fontFaces: [],
      images: [],
      rawText: "",
      signals: {
        borderRadiusMax: 0, borderRadiusAvg: 0, transitionTimings: [],
        hasGrid: false, hasMonoFont: false, bodyFontCategory: "unknown" as const,
        imageCount: 0, ratingPalette: 0,
      },
    };
    if (partial.colors) {
      kit.palette = Array.from(
        new Set(Object.values(partial.colors).filter((c): c is string => typeof c === "string" && c.startsWith("#")))
      ).slice(0, 12);
      kit.paletteRoles = {
        background: partial.colors.background,
        surface: partial.colors.surface,
        text: partial.colors.text,
        textMuted: partial.colors.textMuted,
        border: partial.colors.border,
        primary: partial.colors.primary,
        secondary: partial.colors.secondary,
        accent: partial.colors.accent,
      };
    }
    if (partial.typography) {
      kit.fonts = Array.from(
        new Set([
          partial.typography.fontFamily.heading,
          partial.typography.fontFamily.body,
          partial.typography.fontFamily.mono,
          ...kit.fonts,
        ].filter(Boolean))
      ).slice(0, 8);
    }
    kit.fetchedAt = new Date().toISOString();
    saveBrandKit(personaId, kit);

    try {
      const registry = new DesignVersionRegistry(accountScope.getStore() ? { dbPath: accountPath("versions.db", ".baste/versions.db") } : {});
      const persona = getPersona(personaId);
      if (persona) registry.initPersona(persona);
    } catch (err) {
      console.warn(`[gui/api/openpencil] versioning snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** GET /api/openpencil/:id — return the OpenPencil document for a persona. */
const getOpenPencilHandler: RouteHandler = async (_req, res, params) => {
  const persona = getPersona(params.id);
  if (!persona) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }
  const kit = loadBrandKit(params.id);
  const tokens = generateDesignTokens(persona, kit);
  const doc = personaToOpenPencil(persona, tokens);
  json(res, doc);
};

/** POST /api/openpencil/:id — accept edited OpenPencil JSON and import. */
const postOpenPencilHandler: RouteHandler = async (req, res, params) => {
  if (!getPersona(params.id)) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }
  const body = await parseBody(req) as { document?: unknown };
  if (!body.document) {
    json(res, { error: "document required" }, 400);
    return;
  }
  const result = importOpenPencilEdits(params.id, JSON.stringify(body.document));
  if (!result.ok) {
    json(res, { error: result.error }, 400);
    return;
  }
  json(res, { success: true });
};

/** POST /api/openpencil/:id/file — write the doc to disk for external editing. */
const writeOpenPencilFileHandler: RouteHandler = async (_req, res, params) => {
  if (accountEnabled()) throw new AccountError(403, "External file editing is available in local mode. Use the in-browser editor for this account.");
  const persona = getPersona(params.id);
  if (!persona) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }
  const kit = loadBrandKit(params.id);
  const tokens = generateDesignTokens(persona, kit);
  const doc = personaToOpenPencil(persona, tokens);
  ensureOpenpencilDir();
  const path = openpencilPath(params.id);
  writeFileSync(path, serializeOpenPencil(doc));
  json(res, { path, watching: openpencilWatchers.has(params.id) });
};

/** POST /api/openpencil/:id/watch — toggle a file watcher that re-imports on save. */
const toggleOpenPencilWatchHandler: RouteHandler = async (req, res, params) => {
  if (accountEnabled()) throw new AccountError(403, "External file watching is available in local mode. Use the in-browser editor for this account.");
  const persona = getPersona(params.id);
  if (!persona) {
    json(res, { error: "Persona not found" }, 404);
    return;
  }
  const body = await parseBody(req) as { enabled?: boolean };
  const path = openpencilPath(params.id);

  if (body.enabled === false) {
    openpencilWatchers.get(params.id)?.close();
    openpencilWatchers.delete(params.id);
    json(res, { watching: false });
    return;
  }

  if (openpencilWatchers.has(params.id)) {
    json(res, { watching: true, path });
    return;
  }

  if (!existsSync(path)) {
    ensureOpenpencilDir();
    const kit = loadBrandKit(params.id);
    const tokens = generateDesignTokens(persona, kit);
    writeFileSync(path, serializeOpenPencil(personaToOpenPencil(persona, tokens)));
  }

  let lastImport = 0;
  const watcher = watch(path, { persistent: false }, () => {
    const now = Date.now();
    if (now - lastImport < 200) return; // debounce noisy editor saves
    lastImport = now;
    try {
      const json = readFileSync(path, "utf-8");
      const result = importOpenPencilEdits(params.id, json);
      if (!result.ok) console.warn(`[openpencil] watch import failed: ${result.error}`);
    } catch (err) {
      console.warn(`[openpencil] watch read failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  openpencilWatchers.set(params.id, watcher);
  json(res, { watching: true, path });
};

/** GET /api/rank/:id — get aggregate ranking stats for a persona */
const getRanksHandler: RouteHandler = async (_req, res, params) => {
  const personaRanks = ranks.filter((r) => r.personaId === params.id && r.owner === accountScope.getStore());
  const positive = personaRanks.filter((r) => r.score > 0).length;
  const negative = personaRanks.filter((r) => r.score < 0).length;
  const trend = personaRanks.slice(-10).map((r) => r.score);
  json(res, {
    personaId: params.id,
    total: personaRanks.length,
    positive,
    negative,
    score: personaRanks.length ? (positive - negative) / personaRanks.length : 0,
    trend,
    recent: personaRanks.slice(-20).reverse(),
  });
};

/** POST /api/decompose — pull a live URL into a persona + brand kit. */
const decomposeHandler: RouteHandler = async (req, res) => {
  const body = (await parseBody(req)) as {
    url?: string;
    id?: string;
    name?: string;
    seedMoodboard?: boolean;
    deep?: boolean;
    mirrorAssets?: boolean;
    initVersioning?: boolean;
  };
  if (!body.url) {
    json(res, { error: "url is required" }, 400);
    return;
  }
  try {
    const { decomposeUrl } = await import("../decompose/index.js");
    const slug = body.id || slugifyUrl(body.url);
    if (isBasePersona(slug)) {
      json(res, { error: `Cannot overwrite base persona "${slug}"` }, 400);
      return;
    }
    const { persona, brandKit } = await decomposeUrl(body.url, {
      id: slug,
      name: body.name,
      deep: !!body.deep,
      saveAssetsDir: body.mirrorAssets ? accountPath("assets/decomposed", "./assets/decomposed") : undefined,
      generatePaletteSwatch: !!body.mirrorAssets,
    });
    savePersona(persona);
    saveBrandKit(slug, brandKit);

    if (body.initVersioning) {
      try {
        const registry = new DesignVersionRegistry(accountScope.getStore() ? { dbPath: accountPath("versions.db", ".baste/versions.db") } : {});
        registry.initPersona(persona);
        const sources = [brandKit.logo, brandKit.ogImage, ...brandKit.images.slice(0, 8).map((i) => i.url)]
          .filter((s): s is string => !!s);
        if (sources.length) registry.scanCulturalImages(persona.id, sources, `Decomposed from ${brandKit.sourceUrl}`);
      } catch (err) {
        console.warn(`[gui/api] initVersioning failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (body.seedMoodboard !== false) {
      const board = moodboards.get(boardKey(slug)) || { personaId: slug, references: [], notes: "", vibe: [] };
      const seeds = [brandKit.logo, brandKit.ogImage, ...brandKit.images.slice(0, 12).map((i) => i.url)].filter(
        (s): s is string => !!s
      );
      const seen = new Set(board.references.map((r) => r.src));
      for (const src of seeds) {
        if (seen.has(src)) continue;
        seen.add(src);
        board.references.push({
          id: `ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          src,
          tags: ["decomposed", brandKit.sourceUrl],
          pinned: false,
          addedAt: Date.now(),
        });
      }
      board.vibe = Array.from(new Set([...(board.vibe || []), ...brandKit.palette])).slice(0, 16);
      if (!board.notes) board.notes = `Decomposed from ${brandKit.sourceUrl} on ${brandKit.fetchedAt}`;
      moodboards.set(boardKey(slug), board);
      persistMoodboards();
    }

    json(res, { persona, brandKit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    json(res, { error: msg }, 400);
  }
};

/** GET /api/proxy?url=… — fetches a remote image through the server (CORS / hotlink workaround). */
const proxyHandler: RouteHandler = async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const target = url.searchParams.get("url");
  if (!target) {
    json(res, { error: "url query param required" }, 400);
    return;
  }
  try {
    const upstream = await safeFetch(target, { timeoutMs: 10_000 });
    if (!upstream.ok) {
      res.writeHead(upstream.status, { "Content-Type": "text/plain" });
      res.end(`Upstream ${upstream.status}`);
      return;
    }
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    if (!/^image\//i.test(ct) && !/svg/i.test(ct)) {
      res.writeHead(415, { "Content-Type": "text/plain" });
      res.end(`Unsupported content-type: ${ct}`);
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(200, { "Content-Type": ct, "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff" });
    res.end(buf);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Proxy error: ${err instanceof Error ? err.message : String(err)}`);
  }
};

/** GET /api/brandkit/:id — fetch the saved brand kit for a persona. */
const getBrandKitHandler: RouteHandler = async (_req, res, params) => {
  const kit = loadBrandKit(params.id);
  if (!kit) {
    json(res, { error: "No brand kit found" }, 404);
    return;
  }
  json(res, kit);
};

/** POST /api/remix — cross two personas into a new one. */
const remixHandler: RouteHandler = async (req, res) => {
  const body = (await parseBody(req)) as { a?: string; b?: string; id?: string; name?: string };
  if (!body.a || !body.b || !body.id) {
    json(res, { error: "a, b, and id are required" }, 400);
    return;
  }
  const pa = getPersona(body.a);
  const pb = getPersona(body.b);
  if (!pa || !pb) {
    json(res, { error: `Unknown persona: ${!pa ? body.a : body.b}` }, 404);
    return;
  }
  if (isBasePersona(body.id)) {
    json(res, { error: `Cannot overwrite base persona "${body.id}"` }, 400);
    return;
  }
  const remix = extendPersona(pa, {
    id: body.id,
    name: body.name || `${pa.name} × ${pb.name}`,
    summary: `Remix of ${pa.name} and ${pb.name}.`,
    culture: { subcultures: pb.culture.subcultures, values: pb.culture.values },
    influences: {
      films: pb.influences.films,
      anime: pb.influences.anime,
      visualArtists: pb.influences.visualArtists,
      fashion: pb.influences.fashion,
      spaces: pb.influences.spaces,
      obsessions: pb.influences.obsessions,
    },
    aesthetic: {
      colorTemperature: pb.aesthetic.colorTemperature,
      density: pa.aesthetic.density,
      visualKeywords: pb.aesthetic.visualKeywords,
      moodKeywords: pa.aesthetic.moodKeywords,
    },
  });
  savePersona(remix);

  const ka = loadBrandKit(body.a);
  const kb = loadBrandKit(body.b);
  if (ka || kb) {
    const merged = {
      ...(kb || ka)!,
      sourceUrl: `remix:${body.a}+${body.b}`,
      fetchedAt: new Date().toISOString(),
      palette: [...new Set([...(ka?.palette ?? []), ...(kb?.palette ?? [])])].slice(0, 12),
      fonts: [...new Set([...(ka?.fonts ?? []), ...(kb?.fonts ?? [])])].slice(0, 8),
      paletteRoles: {
        ...(ka?.paletteRoles ?? {}),
        ...(kb?.paletteRoles ?? {}),
        primary: ka?.paletteRoles?.primary ?? kb?.paletteRoles?.primary,
        accent: kb?.paletteRoles?.accent ?? ka?.paletteRoles?.accent,
      },
    };
    saveBrandKit(body.id, merged);
  }
  json(res, { success: true, persona: remix });
};

/** POST /api/split — split a sheet image into asset regions.
 *
 *  strategy:
 *   - "grid"   uniform N×M (legacy behavior)
 *   - "auto"   detect content gutters via horizontal+vertical projections
 *              over transparency / luminance and label each region by aspect
 *   - "detect" alias for auto when image dims are readable, else falls back to grid
 *
 *  If `saveTo` is set, each region is cropped via seamagic and the local path
 *  is returned. Otherwise crop coordinates are returned for the client to slice.
 */
const splitAssetsHandler: RouteHandler = async (req, res) => {
  const body = (await parseBody(req)) as {
    src?: string;
    cols?: number;
    rows?: number;
    strategy?: "detect" | "grid" | "auto";
    saveTo?: string;
    minRegionPx?: number;
    threshold?: number;
  };
  if (accountEnabled() && body.saveTo) throw new AccountError(403, "Save cropped assets on your device in account mode.");
  if (!body.src) {
    json(res, { error: "src required" }, 400);
    return;
  }

  const { safeFetchBuffer } = await import("../shared/url.js");
  const { parseImageDimensionsFromBuffer } = await import("../shared/img-dims.js");
  const { detectRegions, labelRegion, cropWithSeamagic } = await import("../assets/splitter.js");

  let dims: { width: number; height: number; format: string } | undefined;
  let buffer: Buffer | undefined;
  try {
    const { data } = await safeFetchBuffer(body.src, { timeoutMs: 15_000 });
    buffer = data;
    dims = parseImageDimensionsFromBuffer(data);
  } catch (err) {
    console.warn(`[gui/api/split] Could not fetch ${body.src}: ${err instanceof Error ? err.message : String(err)}`);
  }

  const strategy = body.strategy ?? (dims ? "auto" : "grid");

  // Auto-detect path
  if ((strategy === "auto" || strategy === "detect") && dims && buffer) {
    try {
      const regions = await detectRegions(buffer, dims, {
        minRegionPx: body.minRegionPx ?? 32,
        threshold: body.threshold ?? 0.04,
      });
      if (regions.length >= 2) {
        const cells = await Promise.all(regions.map(async (r, i) => {
          const label = labelRegion(r.w, r.h);
          const cell: {
            id: string; x: number; y: number; w: number; h: number;
            src: string; format?: string; label: string; localPath?: string;
          } = { id: `region-${i}`, ...r, src: body.src!, format: dims!.format, label };
          if (body.saveTo) {
            const out = await cropWithSeamagic(body.src!, body.saveTo, `region-${i}-${label}`, r);
            if (out) cell.localPath = out;
          }
          return cell;
        }));
        json(res, {
          src: body.src,
          strategy: "auto",
          detected: { width: dims.width, height: dims.height, format: dims.format },
          regions: cells.length,
          cells,
        });
        return;
      }
    } catch (err) {
      console.warn(`[gui/api/split] auto-detect failed, falling back to grid: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Grid fallback
  const cols = Math.max(1, body.cols || 4);
  const rows = Math.max(1, body.rows || 4);
  const cellW = dims ? Math.floor(dims.width / cols) : undefined;
  const cellH = dims ? Math.floor(dims.height / rows) : undefined;

  const cells: Array<{
    id: string; x: number; y: number; w: number; h: number;
    src: string; format?: string; label: string; localPath?: string;
  }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = dims ? c * cellW! : c / cols;
      const y = dims ? r * cellH! : r / rows;
      const w = dims ? cellW! : Math.round(1000 / cols) / 1000;
      const h = dims ? cellH! : Math.round(1000 / rows) / 1000;
      const cell = {
        id: `cell-${r}-${c}`,
        x, y, w, h,
        src: body.src,
        format: dims?.format,
        label: dims ? labelRegion(w, h) : "tile",
      };
      if (dims && body.saveTo) {
        const out = await cropWithSeamagic(body.src, body.saveTo, `cell-${r}-${c}`, { x, y, w, h });
        if (out) (cell as typeof cell & { localPath?: string }).localPath = out;
      }
      cells.push(cell);
    }
  }

  json(res, {
    src: body.src,
    strategy: "grid",
    cols,
    rows,
    detected: dims ? { width: dims.width, height: dims.height, format: dims.format } : null,
    cells,
  });
};

// Route table: [method, pattern, handler]
const routes: Array<[string, RegExp, RouteHandler]> = [
  ["GET", /^\/api\/projects$/, async (_req, res) => { json(res, await listProjects()); }],
  ["POST", /^\/api\/projects$/, async (req, res) => { json(res, await createProject(await parseBody(req)), 201); }],
  ["GET", /^\/api\/projects\/([^/]+)$/, async (_req, res, params) => { json(res, await getProject(params.id)); }],
  ["POST", /^\/api\/projects\/([^/]+)\/commands$/, async (req, res, params) => { json(res, await applyProjectCommand(params.id, await parseBody(req))); }],
  ["GET", /^\/api\/assets\/(images|svg|videos)\/([^/]+)$/, getAssetHandler],
  ["GET", /^\/api\/moodboard\/([^/]+)$/, getMoodboardHandler],
  ["PUT", /^\/api\/moodboard\/([^/]+)$/, putMoodboardHandler],
  ["POST", /^\/api\/moodboard\/([^/]+)\/reference$/, addReferenceHandler],
  ["POST", /^\/api\/rank$/, rankAssetHandler],
  ["GET", /^\/api\/rank\/([^/]+)$/, getRanksHandler],
  ["GET", /^\/api\/feedback\/([^/]+)$/, getFeedbackHandler],
  ["GET", /^\/api\/openpencil\/([^/]+)$/, getOpenPencilHandler],
  ["POST", /^\/api\/openpencil\/([^/]+)$/, postOpenPencilHandler],
  ["POST", /^\/api\/openpencil\/([^/]+)\/file$/, writeOpenPencilFileHandler],
  ["POST", /^\/api\/openpencil\/([^/]+)\/watch$/, toggleOpenPencilWatchHandler],
  ["POST", /^\/api\/split$/, splitAssetsHandler],
  ["POST", /^\/api\/decompose$/, decomposeHandler],
  ["GET", /^\/api\/proxy$/, proxyHandler],
  ["POST", /^\/api\/remix$/, remixHandler],
  ["GET", /^\/api\/brandkit\/([^/]+)$/, getBrandKitHandler],
  ["GET", /^\/api\/personas$/, listPersonasHandler],
  ["GET", /^\/api\/personas\/([^/]+)$/, getPersonaHandler],
  ["POST", /^\/api\/personas$/, createPersonaHandler],
  ["PUT", /^\/api\/personas\/([^/]+)$/, updatePersonaHandler],
  ["DELETE", /^\/api\/personas\/([^/]+)$/, deletePersonaHandler],
  ["GET", /^\/api\/config$/, getConfigHandler],
  ["POST", /^\/api\/config$/, saveConfigHandler],
  ["GET", /^\/api\/health$/, healthHandler],
  ["POST", /^\/api\/generate\/([^/]+)\/plan$/, generationPlanHandler],
  ["POST", /^\/api\/generate\/([^/]+)$/, generateHandler],
  ["GET", /^\/api\/jobs$/, listJobsHandler],
  ["GET", /^\/api\/jobs\/([^/]+)$/, getJobHandler],
  ["POST", /^\/api\/tokens\/([^/]+)$/, exportTokensHandler],
  ["POST", /^\/api\/prompts\/([^/]+)$/, previewPromptsHandler],
];

/**
 * Match a request against the route table.
 */
function matchRoute(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const match = pathname.match(pattern);
    if (match) {
      const params: Record<string, string> = {};
      if (match[1]) params.id = match[1];
      if (match[2]) params.assetId = match[2];
      return { handler, params };
    }
  }
  return null;
}

/**
 * Main API request handler. Call this from your HTTP server.
 */
export async function handleAPIRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || "/", `http://localhost`);
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/")) {
    return false; // Not an API request, let static file handler take over
  }
  res.setHeader("Cache-Control", "private, no-store");

  await corsMiddleware(req, res, async () => {
    if (await accountManager.handle(req, res)) return;
    const route = matchRoute(req.method || "GET", pathname);
    if (!route) {
      json(res, { error: "Not found" }, 404);
      return;
    }
    try {
      guardOrigin(req, !["GET", "HEAD"].includes(req.method ?? "GET"));
      if (route.params.id && !/^[a-zA-Z0-9_-]{1,100}$/.test(route.params.id)) throw new AccountError(400, "Invalid resource id.");
      if (pathname === "/api/health") { await route.handler(req, res, route.params); return; }
      const context = await accountManager.getContext(req);
      if (context && !["GET", "HEAD"].includes(req.method ?? "GET")) accountManager.validateMutation(req);
      if (context) await accountScope.run(context.did, () => route.handler(req, res, route.params));
      else await route.handler(req, res, route.params);
    } catch (err) {
      const knownError = err instanceof AccountError || err instanceof ProjectError;
      json(res, { error: knownError ? err.message : accountEnabled() ? "The request could not be completed." : String(err) }, knownError ? err.status : 500);
    }
  });

  return true;
}
