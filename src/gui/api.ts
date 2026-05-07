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

const DEFAULT_CONFIG_PATH = "./baste.config.json";

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
  json(res, { status: "ok", version: "0.1.0" });
};

// Route table: [method, pattern, handler]
const routes: Array<[string, RegExp, RouteHandler]> = [
  ["GET", /^\/api\/personas$/, listPersonasHandler],
  ["GET", /^\/api\/personas\/([^/]+)$/, getPersonaHandler],
  ["POST", /^\/api\/personas$/, createPersonaHandler],
  ["PUT", /^\/api\/personas\/([^/]+)$/, updatePersonaHandler],
  ["DELETE", /^\/api\/personas\/([^/]+)$/, deletePersonaHandler],
  ["GET", /^\/api\/config$/, getConfigHandler],
  ["POST", /^\/api\/config$/, saveConfigHandler],
  ["GET", /^\/api\/health$/, healthHandler],
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
