/**
 * Baste GUI Server - Web interface for managing personas and configs
 *
 * Serves a minimal HTML/JS frontend that communicates with the
 * Baste API (via the Flue agent or direct integration).
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Server } from "node:http";
import { handleAPIRequest } from "./api.js";

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
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = join(GUI_ROOT, pathname);

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
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`\n🌐 Baste GUI running at http://localhost:${port}`);
      resolve(server);
    });
    server.on("error", reject);
  });
}
