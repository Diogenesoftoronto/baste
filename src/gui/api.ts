/**
 * Baste GUI API - REST endpoints for the web interface
 *
 * Provides CRUD operations for personas and config management.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Persona } from "../persona/types.js";
import {
  getPersona,
  listPersonas,
  savePersona,
  deletePersona,
  getBasePersonas,
  getCustomPersonas,
  initStore,
  isBasePersona,
} from "../persona/store.js";
import { resolveConfig, toBasteConfig, type BasteUserConfig } from "../config/baste-config.js";
import { generateAssetSuite, generateUIKit } from "../baste.js";
import { generateDesignTokens, exportCSS, exportTailwindConfig, exportPandaTheme } from "../assets/design-system.js";

const DEFAULT_CONFIG_PATH = "./baste.config.json";

// In-memory moodboard + ranking store (persisted to disk best-effort)
interface Moodboard {
  personaId: string;
  references: Array<{ id: string; src: string; tags: string[]; pinned: boolean; addedAt: number }>;
  notes: string;
  vibe: string[];
}
interface AssetRank {
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

function persistMoodboards(): void {
  try {
    const dir = resolve(".baste");
    if (!existsSync(dir)) require("node:fs").mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(MOODBOARD_FILE), JSON.stringify(Array.from(moodboards.values()), null, 2));
  } catch {}
}
function persistRanks(): void {
  try {
    const dir = resolve(".baste");
    if (!existsSync(dir)) require("node:fs").mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(RANKS_FILE), JSON.stringify(ranks, null, 2));
  } catch {}
}
function loadStores(): void {
  try {
    if (existsSync(resolve(MOODBOARD_FILE))) {
      const data = JSON.parse(readFileSync(resolve(MOODBOARD_FILE), "utf-8")) as Moodboard[];
      data.forEach((m) => moodboards.set(m.personaId, m));
    }
    if (existsSync(resolve(RANKS_FILE))) {
      const data = JSON.parse(readFileSync(resolve(RANKS_FILE), "utf-8")) as AssetRank[];
      ranks.push(...data);
    }
  } catch {}
}
loadStores();

// Active generation jobs for SSE streaming
interface GenerationJob {
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
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

async function corsMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
  json(res, config);
};

/**
 * Route: POST /api/config
 * Save/update config.
 */
const saveConfigHandler: RouteHandler = async (req, res) => {
  const body = await parseBody(req) as BasteUserConfig;
  try {
    writeFileSync(resolve(DEFAULT_CONFIG_PATH), JSON.stringify(body, null, 2));
    json(res, { success: true });
  } catch (err) {
    json(res, { error: String(err) }, 500);
  }
};

/**
 * Route: GET /api/health
 * Health check.
 */
const healthHandler: RouteHandler = async (_req, res) => {
  json(res, { status: "ok", version: "0.2.0" });
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

  const body = await parseBody(req) as { type?: string; assetTypes?: unknown[]; dryRun?: boolean };
  const config = resolveConfig();
  const basteConfig = toBasteConfig(config);

  const jobId = makeJobId();
  const job: GenerationJob = {
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
          svgs: suite.assets.svgs.map(a => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
          images: suite.assets.images.map(a => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
          videos: suite.assets.videos.map(a => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
          metadata: suite.metadata,
        };
      } else {
        const assetTypes = body.assetTypes && Array.isArray(body.assetTypes)
          ? body.assetTypes as Array<{ kind: "svg" | "image" | "video"; purpose: string; description: string }>
          : [
              { kind: "svg" as const, purpose: "icon", description: "App icon" },
              { kind: "image" as const, purpose: "hero", description: "Hero banner" },
              { kind: "image" as const, purpose: "background", description: "Ambient background" },
            ];
        job.logs.push(`Generating ${assetTypes.length} asset types...`);
        const suite = await generateAssetSuite(persona, assetTypes, basteConfig);
        job.logs.push(`Done: ${suite.assets.svgs.length} SVGs, ${suite.assets.images.length} images, ${suite.assets.videos.length} videos`);
        job.result = {
          svgs: suite.assets.svgs.map(a => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
          images: suite.assets.images.map(a => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
          videos: suite.assets.videos.map(a => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
          metadata: suite.metadata,
        };
      }
      job.status = "completed";
    } catch (err) {
      job.status = "error";
      job.error = String(err);
      job.logs.push(`Error: ${String(err)}`);
    }
  })();
};

/**
 * Route: GET /api/jobs/:id
 * Get job status and logs.
 */
const getJobHandler: RouteHandler = async (_req, res, params) => {
  const job = jobs.get(params.id);
  if (!job) {
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
  const all = Array.from(jobs.values()).sort((a, b) => {
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

  let output = "";
  let ext = "";
  switch (format) {
    case "css":
      output = exportCSS(persona);
      ext = "css";
      break;
    case "tailwind":
      output = exportTailwindConfig(persona);
      ext = "js";
      break;
    case "json":
      output = JSON.stringify(generateDesignTokens(persona), null, 2);
      ext = "json";
      break;
    case "panda":
      output = exportPandaTheme(persona);
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
  const board = moodboards.get(params.id) || { personaId: params.id, references: [], notes: "", vibe: [] };
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
  moodboards.set(params.id, board);
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
  const board = moodboards.get(params.id) || { personaId: params.id, references: [], notes: "", vibe: [] };
  const ref = {
    id: `ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    src: body.src,
    tags: body.tags || [],
    pinned: false,
    addedAt: Date.now(),
  };
  board.references.push(ref);
  moodboards.set(params.id, board);
  persistMoodboards();
  json(res, ref);
};

/** POST /api/rank — submit an asset ranking */
const rankAssetHandler: RouteHandler = async (req, res) => {
  const body = (await parseBody(req)) as Partial<AssetRank>;
  if (!body.assetId || !body.personaId || typeof body.score !== "number") {
    json(res, { error: "assetId, personaId, score required" }, 400);
    return;
  }
  const entry: AssetRank = {
    assetId: body.assetId,
    personaId: body.personaId,
    score: Math.max(-1, Math.min(1, body.score)),
    feedback: body.feedback || "",
    ts: Date.now(),
  };
  ranks.push(entry);
  persistRanks();
  json(res, { success: true, total: ranks.length });
};

/** GET /api/rank/:id — get aggregate ranking stats for a persona */
const getRanksHandler: RouteHandler = async (_req, res, params) => {
  const personaRanks = ranks.filter((r) => r.personaId === params.id);
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

/** POST /api/split — split a sheet image into asset regions (stub). */
const splitAssetsHandler: RouteHandler = async (req, res) => {
  const body = (await parseBody(req)) as { src?: string; cols?: number; rows?: number };
  if (!body.src) {
    json(res, { error: "src required" }, 400);
    return;
  }
  const cols = body.cols || 4;
  const rows = body.rows || 4;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        id: `cell-${r}-${c}`,
        x: c / cols,
        y: r / rows,
        w: 1 / cols,
        h: 1 / rows,
        src: body.src,
      });
    }
  }
  json(res, { src: body.src, cols, rows, cells, note: "Pure-CSS crop regions. Pipe to QuiverAI for SVG remake." });
};

// Route table: [method, pattern, handler]
const routes: Array<[string, RegExp, RouteHandler]> = [
  ["GET", /^\/api\/moodboard\/([^/]+)$/, getMoodboardHandler],
  ["PUT", /^\/api\/moodboard\/([^/]+)$/, putMoodboardHandler],
  ["POST", /^\/api\/moodboard\/([^/]+)\/reference$/, addReferenceHandler],
  ["POST", /^\/api\/rank$/, rankAssetHandler],
  ["GET", /^\/api\/rank\/([^/]+)$/, getRanksHandler],
  ["POST", /^\/api\/split$/, splitAssetsHandler],
  ["GET", /^\/api\/personas$/, listPersonasHandler],
  ["GET", /^\/api\/personas\/([^/]+)$/, getPersonaHandler],
  ["POST", /^\/api\/personas$/, createPersonaHandler],
  ["PUT", /^\/api\/personas\/([^/]+)$/, updatePersonaHandler],
  ["DELETE", /^\/api\/personas\/([^/]+)$/, deletePersonaHandler],
  ["GET", /^\/api\/config$/, getConfigHandler],
  ["POST", /^\/api\/config$/, saveConfigHandler],
  ["GET", /^\/api\/health$/, healthHandler],
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

  await corsMiddleware(req, res, async () => {
    const route = matchRoute(req.method || "GET", pathname);
    if (!route) {
      json(res, { error: "Not found" }, 404);
      return;
    }
    try {
      await route.handler(req, res, route.params);
    } catch (err) {
      json(res, { error: String(err) }, 500);
    }
  });

  return true;
}
