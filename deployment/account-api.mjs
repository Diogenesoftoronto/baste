import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import manifest from '../dist/site/src/lib/account-policy.json' with { type: 'json' };
import { AccountManager, publicOrigin } from '../dist/src/notorganic/server.js';

// This entry point intentionally imports no local GUI/project/filesystem API.
const routes = new Set(['GET status', 'GET consent/policy', 'POST login', 'GET callback', 'POST consent', 'POST logout']);
export function createAccountAPIServer(manager = new AccountManager(undefined, undefined, 'wallet:read'), port = 3456) {
  const allowedHosts = new Set([new URL(publicOrigin()).host, `127.0.0.1:${port}`, `localhost:${port}`]);
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!allowedHosts.has(req.headers.host ?? '')) { res.writeHead(403); res.end('Invalid host'); return; }
    const url = new URL(req.url ?? '/', publicOrigin());
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, {'Content-Type':'application/json'}); res.end('{"status":"ok","service":"baste-account-api"}'); return;
    }
    const prefix = '/api/notorganic/';
    if (!url.pathname.startsWith(prefix) || !routes.has(`${req.method} ${url.pathname.slice(prefix.length)}`)) {
      res.writeHead(404, {'Content-Type':'application/json'}); res.end('{"error":"Not found"}'); return;
    }
    try { await manager.handle(req,res); }
    catch { if (!res.headersSent) res.writeHead(502, {'Content-Type':'application/json'}); res.end('{"error":"Account service is unavailable."}'); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (manifest.status === 'adopted') {
    const mounts = readFileSync('/proc/self/mountinfo','utf8').split('\n');
    if (!mounts.some(line => line.split(' ')[4] === '/app/data')) throw new Error('Adopted account policies require the approved persistent /app/data mount.');
  }
  createAccountAPIServer().listen(3456,'127.0.0.1');
}
