/**
 * Baste GUI Server - Web interface for managing personas and configs
 *
 * Serves a minimal HTML/JS frontend that communicates with the
 * Baste API (via the Flue agent or direct integration).
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, sep } from "node:path";
import type { Server } from "node:http";
import { handleAPIRequest } from "./api.js";
import { accountEnabled, publicOrigin } from "../notorganic/server.js";

const GUI_ROOT = resolve(
  import.meta.dirname || ".",
  existsSync(resolve(import.meta.dirname || ".", "public"))
    ? "public"
    : "../../../src/gui/public"
);

function getMimeType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function serveFile(res: any, path: string, status = 200): void {
  try {
    const content = readFileSync(path);
    res.writeHead(status, { "Content-Type": getMimeType(path) });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

export function createGUIServer(port = 3456): Server {
  const server = createServer((req, res) => {
    // Host validation prevents DNS rebinding against the local server and its keys.
    const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`, new URL(publicOrigin()).host]);
    if (!req.headers.host || !allowedHosts.has(req.headers.host)) { res.writeHead(403); res.end("Invalid host"); return; }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = resolve(GUI_ROOT, `.${pathname}`);
    if (!filePath.startsWith(`${GUI_ROOT}${sep}`)) { res.writeHead(404); res.end("Not found"); return; }

    // API routes — handled by api.ts
    handleAPIRequest(req, res).then((isApi) => {
      if (isApi) return;

      // Static files
      if (existsSync(filePath)) {
        serveFile(res, filePath);
      } else {
        // Fallback to index.html for SPA routing
        const indexPath = join(GUI_ROOT, "index.html");
        if (existsSync(indexPath)) {
          serveFile(res, indexPath);
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("GUI not built. Run the build step first.");
        }
      }
    }).catch(() => {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal server error");
    });
  });

  return server;
}

export async function startGUIServer(port = 3456): Promise<Server> {
  const server = createGUIServer(port);
  const started = await new Promise<Server>((resolve, reject) => {
    const host = process.env.BASTE_API_HOST ?? (accountEnabled() ? "127.0.0.1" : "127.0.0.1");
    if (!accountEnabled() && !["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("Local mode must bind to loopback. Enable Not Organic account mode before exposing the API.");
    server.listen(port, host, () => {
      console.log(`\n🌐 Baste GUI running at http://localhost:${port}`);
      resolve(server);
    });
    server.on("error", reject);
  });

  // Graceful shutdown on SIGINT
  process.on("SIGINT", () => {
    console.log("\n[gui] SIGINT received, closing server...");
    server.close(() => process.exit(0));
    // Force-exit after 5s in case of stuck connections
    setTimeout(() => process.exit(1), 5000);
  });

  return started;
}
