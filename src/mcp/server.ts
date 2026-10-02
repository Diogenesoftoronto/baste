/**
 * Baste MCP Server
 *
 * Exposes Baste capabilities as MCP tools and resources.
 * Supports stdio transport (local agent integration) and
 * Streamable HTTP (remote). Used via `baste mcp` CLI or
 * imported programmatically.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getPersona,
  listPersonas,
  savePersona,
  initStore,
  isBasePersona,
  deletePersona,
} from "../persona/store.js";
import { buildPersona, extendPersona } from "../persona/builder.js";
import type { Persona } from "../persona/types.js";
import {
  generateDesignTokens,
  exportCSS,
  exportTailwindConfig,
  exportPandaTheme,
} from "../assets/design-system.js";
import { loadBrandKit, saveBrandKit } from "../decompose/store.js";
import { toBasteConfig, resolveConfig } from "../config/baste-config.js";
import { generatePrompts } from "../generation/prompts.js";
import { slugifyUrl } from "../shared/url.js";
import { dirname } from "node:path";

export interface MCPOptions {
  /** Persona store directory. Defaults to ./personas */
  personaDir?: string;
  /** Output directory for assets. Defaults to ./assets/output */
  outputDir?: string;
}

/**
 * Create an MCP server instance wired with Baste tools.
 */
export function createBasteMCPServer(options: MCPOptions = {}) {
  initStore(options.personaDir ? { customDir: options.personaDir } : undefined);

  const server = new McpServer({
    name: "baste",
    version: "0.2.0",
  });

  // ── Tool: list_personas ──────────────────────────────────────────────
  server.registerTool(
    "list_personas",
    {
      description:
        "List all available personas (built-in templates + user-created). Each has an id, name, source, and summary.",
      inputSchema: z.object({
        includeDetails: z
          .boolean()
          .optional()
          .describe("Return full persona objects instead of summaries"),
      }),
    },
    async ({ includeDetails }) => {
      const ids = listPersonas().sort();
      const personas = ids.map((id) => {
        const p = getPersona(id)!;
        if (includeDetails) return { ...p, _source: isBasePersona(id) ? "base" : "custom" };
        return {
          id,
          name: p.name,
          source: isBasePersona(id) ? "base" : "custom",
          summary: p.summary,
        };
      });
      return {
        content: [{ type: "text", text: JSON.stringify(personas, null, 2) }],
      };
    }
  );

  // ── Tool: show_persona ───────────────────────────────────────────────
  server.registerTool(
    "show_persona",
    {
      description:
        "Show the full persona definition (culture, influences, aesthetic, behaviors) for a given persona ID.",
      inputSchema: z.object({
        id: z.string().describe("Persona ID, e.g. 'cyberbotanist'"),
      }),
    },
    async ({ id }) => {
      const persona = getPersona(id);
      if (!persona) {
        return {
          content: [{ type: "text", text: `Persona not found: ${id}` }],
          isError: true,
        };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(persona, null, 2) },
        ],
      };
    }
  );

  // ── Tool: create_persona ─────────────────────────────────────────────
  server.registerTool(
    "create_persona",
    {
      description:
        "Create a new custom persona with a unique ID. You can optionally base it on an existing persona.",
      inputSchema: z.object({
        id: z.string().describe("Unique identifier for the new persona"),
        name: z.string().describe("Display name"),
        summary: z.string().optional().describe("Short description"),
        baseId: z
          .string()
          .optional()
          .describe("Existing persona ID to extend from"),
        cultureSubcultures: z
          .array(z.string())
          .optional()
          .describe("Subcultures, e.g. ['solarpunk', 'mycology']"),
        cultureValues: z
          .array(z.string())
          .optional()
          .describe("Values, e.g. ['sustainability', 'open-source']"),
        films: z.array(z.string()).optional(),
        anime: z.array(z.string()).optional(),
        musicGenres: z.array(z.string()).optional(),
        visualArtists: z.array(z.string()).optional(),
        spaces: z.array(z.string()).optional(),
        obsessions: z.array(z.string()).optional(),
        colorTemperature: z
          .enum(["warm", "cool", "neutral", "high-contrast", "muted"])
          .optional(),
        density: z
          .enum(["minimal", "dense", "rich", "maximalist"])
          .optional(),
        edgeStyle: z
          .enum(["sharp", "soft", "organic", "geometric", "brutalist"])
          .optional(),
        motionStyle: z
          .enum(["smooth", "snappy", "liquid", "mechanical"])
          .optional(),
        typographyStyle: z
          .enum(["clean", "expressive", "retro", "futuristic", "handcrafted"])
          .optional(),
        textureStyle: z
          .enum(["flat", "textured", "noisy", "clean", "grainy"])
          .optional(),
        iconStyle: z
          .enum(["line", "filled", "hand-drawn", "geometric", "abstract"])
          .optional(),
        layoutStyle: z
          .enum(["grid", "organic", "asymmetric", "brutalist", "editorial"])
          .optional(),
        visualKeywords: z.array(z.string()).optional(),
        moodKeywords: z.array(z.string()).optional(),
      }),
    },
    async (args) => {
      if (isBasePersona(args.id)) {
        return {
          content: [
            { type: "text", text: `Cannot overwrite base persona "${args.id}"` },
          ],
          isError: true,
        };
      }

      let persona: Persona;
      const draft = {
        id: args.id,
        name: args.name,
        summary: args.summary,
      };

      if (args.baseId) {
        const base = getPersona(args.baseId);
        if (!base) {
          return {
            content: [
              { type: "text", text: `Base persona not found: ${args.baseId}` },
            ],
            isError: true,
          };
        }
        persona = extendPersona(base, draft);
      } else {
        persona = buildPersona(draft);
      }

      // Overlay optional fields
      if (args.cultureSubcultures)
        persona.culture.subcultures = args.cultureSubcultures;
      if (args.cultureValues) persona.culture.values = args.cultureValues;
      if (args.films) persona.influences.films = args.films;
      if (args.anime) persona.influences.anime = args.anime;
      if (args.musicGenres)
        persona.influences.music.genres = args.musicGenres;
      if (args.visualArtists)
        persona.influences.visualArtists = args.visualArtists;
      if (args.spaces) persona.influences.spaces = args.spaces;
      if (args.obsessions) persona.influences.obsessions = args.obsessions;
      if (args.colorTemperature)
        persona.aesthetic.colorTemperature = args.colorTemperature;
      if (args.density) persona.aesthetic.density = args.density;
      if (args.edgeStyle) persona.aesthetic.edgeStyle = args.edgeStyle;
      if (args.motionStyle) persona.aesthetic.motionStyle = args.motionStyle;
      if (args.typographyStyle)
        persona.aesthetic.typographyStyle = args.typographyStyle;
      if (args.textureStyle) persona.aesthetic.textureStyle = args.textureStyle;
      if (args.iconStyle) persona.aesthetic.iconStyle = args.iconStyle;
      if (args.layoutStyle) persona.aesthetic.layoutStyle = args.layoutStyle;
      if (args.visualKeywords)
        persona.aesthetic.visualKeywords = args.visualKeywords;
      if (args.moodKeywords)
        persona.aesthetic.moodKeywords = args.moodKeywords;

      savePersona(persona);
      return {
        content: [
          { type: "text", text: `Created persona: ${args.id} (${args.name})` },
        ],
      };
    }
  );

  // ── Tool: delete_persona ─────────────────────────────────────────────
  server.registerTool(
    "delete_persona",
    {
      description: "Delete a custom persona (base personas cannot be removed).",
      inputSchema: z.object({
        id: z.string().describe("Persona ID to delete"),
      }),
    },
    async ({ id }) => {
      const ok = deletePersona(id);
      if (!ok) {
        return {
          content: [
            {
              type: "text",
              text: `Cannot delete "${id}" — base persona or not found`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: `Deleted persona: ${id}` }],
      };
    }
  );

  // ── Tool: generate_design_tokens ─────────────────────────────────────
  server.registerTool(
    "generate_design_tokens",
    {
      description:
        "Generate and export design tokens (CSS, Tailwind, or JSON) for a persona. Uses a decomposed BrandKit if available.",
      inputSchema: z.object({
        personaId: z.string().describe("Persona ID"),
        format: z
          .enum(["css", "tailwind", "json", "panda"])
          .describe("Output format: css, tailwind, json, or panda")
          .default("css"),
      }),
    },
    async ({ personaId, format }) => {
      const persona = getPersona(personaId);
      if (!persona) {
        return {
          content: [{ type: "text", text: `Persona not found: ${personaId}` }],
          isError: true,
        };
      }
      const brandKit = loadBrandKit(personaId);

      let output = "";
      let extension = "";
      switch (format) {
        case "css":
          output = exportCSS(persona, brandKit);
          extension = "css";
          break;
        case "tailwind":
          output = exportTailwindConfig(persona, brandKit);
          extension = "js";
          break;
        case "json":
          output = JSON.stringify(generateDesignTokens(persona, brandKit), null, 2);
          extension = "json";
          break;
        case "panda":
          output = exportPandaTheme(persona, brandKit);
          extension = "ts";
          break;
      }

      return {
        content: [
          {
            type: "text",
            text: `Generated design tokens for ${persona.name} (${format})\n\n${output}`,
          },
        ],
      };
    }
  );

  // ── Tool: generate_prompts ───────────────────────────────────────────
  server.registerTool(
    "generate_prompts",
    {
      description:
        "Generate optimized image / SVG / video prompts for a persona. Does not call generation APIs — returns only the prompts.",
      inputSchema: z.object({
        personaId: z.string().describe("Persona ID"),
        kind: z
          .enum(["image", "svg", "video"])
          .describe("Asset type")
          .default("image"),
        purpose: z
          .string()
          .describe("What the asset is for, e.g. 'hero', 'icon', 'background'")
          .default("hero"),
        description: z
          .string()
          .describe("Short description of the desired asset")
          .default("Hero banner"),
      }),
    },
    async ({ personaId, kind, purpose, description }) => {
      const persona = getPersona(personaId);
      if (!persona) {
        return {
          content: [{ type: "text", text: `Persona not found: ${personaId}` }],
          isError: true,
        };
      }
      const prompts = generatePrompts(persona, { kind, purpose, description });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                persona: personaId,
                purpose,
                image: prompts.image,
                svg: prompts.svg,
                video: prompts.video,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool: decompose_url ──────────────────────────────────────────────
  server.registerTool(
    "decompose_url",
    {
      description:
        "Decompose a live website URL into a Persona + BrandKit. Returns inferred aesthetic, palette, fonts, and detected images.",
      inputSchema: z.object({
        url: z.string().describe("URL to decompose, e.g. https://example.com"),
        id: z.string().optional().describe("Persona ID to assign (auto-slugified if omitted)"),
        name: z.string().optional().describe("Display name (auto-detected if omitted)"),
        deep: z
          .boolean()
          .optional()
          .describe("Use Playwright browser for JS-rendered SPAs")
          .default(false),
        mirrorAssets: z
          .boolean()
          .optional()
          .describe("Download and mirror assets locally")
          .default(false),
        initVersioning: z
          .boolean()
          .optional()
          .describe("Initialize design versioning for the result")
          .default(false),
      }),
    },
    async ({ url, id, name, deep, mirrorAssets, initVersioning }) => {
      try {
        const { decomposeUrl } = await import("../decompose/index.js");
        const slug = id || slugifyUrl(url);
        if (isBasePersona(slug)) {
          return {
            content: [
              { type: "text", text: `Cannot overwrite base persona "${slug}"` },
            ],
            isError: true,
          };
        }
        const { persona, brandKit } = await decomposeUrl(url, {
          id: slug,
          name,
          deep: !!deep,
          saveAssetsDir: mirrorAssets ? "./assets/decomposed" : undefined,
          generatePaletteSwatch: !!mirrorAssets,
        });
        savePersona(persona);
        saveBrandKit(slug, brandKit);

        let notes = "";
        if (initVersioning) {
          const { DesignVersionRegistry } = await import("../versioning/registry.js");
          const registry = new DesignVersionRegistry();
          registry.initPersona(persona);
          const sources = [brandKit.logo, brandKit.ogImage, ...brandKit.images.slice(0, 8).map((i) => i.url)]
            .filter((s): s is string => !!s);
          if (sources.length) {
            registry.scanCulturalImages(persona.id, sources, `Decomposed from ${brandKit.sourceUrl}`);
          }
          notes = `Design versioning initialized with ${sources.length} cultural refs.`;
        }

        return {
          content: [
            {
              type: "text",
              text: `Decomposed ${url}\n\nPersona: ${persona.id} (${persona.name})\nPalette roles: ${JSON.stringify(brandKit.paletteRoles, null, 2)}\nFonts: ${brandKit.fonts.join(", ") || "(none)"}\nLogo: ${brandKit.logo || "(none)"}\nOG Image: ${brandKit.ogImage || "(none)"}\nImages: ${brandKit.images.length}\nSignals: edge≈${brandKit.signals.borderRadiusAvg.toFixed(1)}px, grid=${brandKit.signals.hasGrid}${notes ? "\n" + notes : ""}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Decompose failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Tool: remix_personas ─────────────────────────────────────────────
  server.registerTool(
    "remix_personas",
    {
      description:
        "Cross two existing personas into a new one. Merges aesthetics, influences, and brand kits.",
      inputSchema: z.object({
        personaA: z.string().describe("First persona ID"),
        personaB: z.string().describe("Second persona ID"),
        newId: z.string().describe("ID for the remixed persona"),
        name: z.string().optional().describe("Name (auto-generated if omitted)"),
      }),
    },
    async ({ personaA, personaB, newId, name }) => {
      const pa = getPersona(personaA);
      const pb = getPersona(personaB);
      if (!pa || !pb) {
        return {
          content: [
            { type: "text", text: `Unknown persona: ${!pa ? personaA : personaB}` },
          ],
          isError: true,
        };
      }
      if (isBasePersona(newId)) {
        return {
          content: [
            { type: "text", text: `Cannot overwrite base persona "${newId}"` },
          ],
          isError: true,
        };
      }

      const remix = extendPersona(pa, {
        id: newId,
        name: name || `${pa.name} × ${pb.name}`,
        summary: `Remix of ${pa.name} and ${pb.name}.`,
        culture: {
          subcultures: pb.culture.subcultures,
          values: pb.culture.values,
        },
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

      // Merge brand kits if any exist
      const ka = loadBrandKit(personaA);
      const kb = loadBrandKit(personaB);
      if (ka || kb) {
        const merged = {
          ...(kb || ka)!,
          sourceUrl: `remix:${personaA}+${personaB}`,
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
        saveBrandKit(newId, merged);
      }

      return {
        content: [
          { type: "text", text: `Remixed: ${personaA} + ${personaB} → ${newId}` },
        ],
      };
    }
  );

  // ── Tool: get_brand_kit ──────────────────────────────────────────────
  server.registerTool(
    "get_brand_kit",
    {
      description:
        "Retrieve the BrandKit (palette, fonts, images, CSS signals) for a decomposed persona.",
      inputSchema: z.object({
        personaId: z.string().describe("Persona ID whose brand kit to fetch"),
      }),
    },
    async ({ personaId }) => {
      const kit = loadBrandKit(personaId);
      if (!kit) {
        return {
          content: [
            { type: "text", text: `No brand kit found for ${personaId}` },
          ],
          isError: true,
        };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(kit, null, 2) },
        ],
      };
    }
  );

  // ── Tool: export_persona ─────────────────────────────────────────────
  server.registerTool(
    "export_persona",
    {
      description:
        "Export a persona and its brand kit to a shareable .baste file.",
      inputSchema: z.object({
        personaId: z.string().describe("Persona ID to export"),
        path: z
          .string()
          .optional()
          .describe("Destination path (defaults to ./assets/output/<id>.baste)"),
      }),
    },
    async ({ personaId, path: exportPath }) => {
      const persona = getPersona(personaId);
      if (!persona) {
        return {
          content: [{ type: "text", text: `Persona not found: ${personaId}` }],
          isError: true,
        };
      }
      const { DesignVersionRegistry } = await import("../versioning/registry.js");
      const registry = new DesignVersionRegistry();
      const outPath =
        exportPath || `${options.outputDir ?? "./assets/output"}/${personaId}.baste`;
      const { mkdirSync } = await import("node:fs");
      mkdirSync(dirname(outPath), { recursive: true });
      registry.exportToFile(personaId, outPath);
      return {
        content: [
          {
            type: "text",
            text: `Exported design system for ${persona.name} to ${outPath}`,
          },
        ],
      };
    }
  );

  // ── Tool: import_persona ─────────────────────────────────────────────
  server.registerTool(
    "import_persona",
    {
      description: "Import a .baste file that was previously exported.",
      inputSchema: z.object({
        path: z.string().describe("Path to the .baste file"),
      }),
    },
    async ({ path }) => {
      const { existsSync } = await import("node:fs");
      if (!existsSync(path)) {
        return {
          content: [{ type: "text", text: `File not found: ${path}` }],
          isError: true,
        };
      }
      const { DesignVersionRegistry } = await import("../versioning/registry.js");
      const registry = new DesignVersionRegistry();
      const result = registry.importFromFile(path);
      return {
        content: [
          {
            type: "text",
            text: `Imported from ${path}\nPersona: ${result.personaId}\nComponents: ${result.componentsImported}\nVersions: ${result.versionsImported}\nCultural refs: ${result.refsImported}`,
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Run the MCP server over stdio (default for local agent integrations).
 */
export async function runBasteMcpStdio(options?: MCPOptions): Promise<void> {
  const server = createBasteMCPServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ---------------------------------------------------------------------------
// Streamable HTTP transport — stateful MCP server over HTTP/S
// ---------------------------------------------------------------------------
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

export type HTTPMCPOptions = MCPOptions & {
  /** Port to listen on. Defaults to 3457. */
  port?: number;
  /** Optional HTTPS path key (future). For now terminate TLS upstream or pass --key/--cert. */
  key?: string;
  cert?: string;
};

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createBasteMCPServer>;
}

/**
 * Run the MCP server via Streamable HTTP transport.
 *
 * Supports both HTTP (via plain createServer) and HTTPS when key/cert files are provided.
 * Clients POST to /mcp, GET for SSE, DELETE to close session.
 *
 * Usage:
 *   baste mcp --http [--port 3457]
 *   baste mcp --http --port 3457 --key ./key.pem --cert ./cert.pem
 */
export async function runBasteMcpHttp(options: HTTPMCPOptions = {}): Promise<Server> {
  const port = options.port ?? 3457;
  const sessions = new Map<string, SessionEntry>();

  const createMcpServer = () => createBasteMCPServer(options);

  // Request handler
  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    if (url.pathname !== "/mcp" && url.pathname !== "/mcp/") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Not found" }, id: null }));
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // POST — handle MCP requests
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString(); });
      await new Promise<void>((resolve) => req.on("end", resolve));
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
        return;
      }

      // Reuse existing transport
      if (sessionId && sessions.has(sessionId)) {
        const entry = sessions.get(sessionId)!;
        await entry.transport.handleRequest(req, res, parsedBody);
        return;
      }

      // New session (must be initialize request)
      if (!sessionId && isInitializeRequest(parsedBody)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            // session saved below after creation
          },
        });
        const server = createMcpServer();
        await server.connect(transport);
        // The sessionId is generated inside handleRequest so store after
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && sessions.has(sid)) {
            sessions.delete(sid);
          }
        };
        await transport.handleRequest(req, res, parsedBody);
        const sid = transport.sessionId;
        if (sid) {
          sessions.set(sid, { transport, server });
        }
        return;
      }

      // Invalid — no session and not initializing
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request: no valid session" }, id: null }));
      return;
    }

    // GET — SSE stream for notifications
    if (req.method === "GET") {
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid or missing session ID");
        return;
      }
      const entry = sessions.get(sessionId)!;
      await entry.transport.handleRequest(req, res);
      return;
    }

    // DELETE — close session
    if (req.method === "DELETE") {
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid or missing session ID");
        return;
      }
      const entry = sessions.get(sessionId)!;
      await entry.transport.handleRequest(req, res);
      sessions.delete(sessionId);
      return;
    }

    // OPTIONS
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
      });
      res.end();
      return;
    }

    // Method not allowed
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
  };

  const createServerFn = options.key && options.cert
    ? (await import("node:https")).createServer.bind(null, {
        key: (await import("node:fs")).readFileSync(options.key),
        cert: (await import("node:fs")).readFileSync(options.cert),
      })
    : createServer;

  const httpServer = createServerFn(handleRequest);
  httpServer.listen(port, () => {
    console.log(`\n🟢 Baste MCP HTTP server listening on port ${port}`);
    console.log(`   POST http://localhost:${port}/mcp   → RPC messages / initialize`);
    console.log(`   GET  http://localhost:${port}/mcp   → SSE stream (requires mcp-session-id)`);
    console.log(`   DELETE http://localhost:${port}/mcp → Close session`);
    if (options.key && options.cert) console.log(`   Using TLS (HTTPS)`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down MCP HTTP server...");
    for (const [, entry] of sessions) {
      try { await entry.transport.close(); } catch { /* ignore */ }
    }
    sessions.clear();
    httpServer.close();
    process.exit(0);
  });

  return httpServer;
}
