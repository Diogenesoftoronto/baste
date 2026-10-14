import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function slugifyUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").replace(/\./g, "-");
    const path = u.pathname.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "");
    return path ? `${host}-${path}`.toLowerCase() : host.toLowerCase();
  } catch {
    return url.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  allowPrivateHosts?: boolean;
}

const DEFAULT_UA = "BasteDecomposer/0.2 (+https://github.com/Diogenesoftoronto/baste)";

export function isPrivateAddress(addr: string): boolean {
  const v = isIP(addr);
  if (v === 4) {
    const parts = addr.split(".").map(Number);
    const [a, b, c] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (v === 6) {
    const low = addr.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fc") || low.startsWith("fd")) return true;
    if (low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) return true;
    if (low.startsWith("::ffff:")) {
      const mapped = low.slice(7);
      if (isIP(mapped) === 4) return isPrivateAddress(mapped);
      const parts = mapped.split(":");
      if (parts.length === 2) {
        const n = parseInt(parts[0], 16) * 65536 + parseInt(parts[1], 16);
        return isPrivateAddress(`${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);
      }
      return true;
    }
    if (low.startsWith("ff") || low.startsWith("2001:db8:")) return true;
    return false;
  }
  return false;
}

const PRIVATE_HOSTS = new Set(["localhost", "ip6-localhost", "ip6-loopback", "broadcasthost"]);

export async function assertSafePublicUrl(rawUrl: string, opts: { allowPrivateHosts?: boolean } = {}): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Refusing non-http(s) URL: ${u.protocol}`);
  }
  if (u.username || u.password) throw new Error("Refusing a URL containing credentials.");
  if (opts.allowPrivateHosts) return u;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (PRIVATE_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error(`Refusing local hostname: ${host}`);
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error(`Refusing private/loopback IP: ${host}`);
    return u;
  }
  try {
    const records = await lookup(host, { all: true });
    for (const r of records) {
      if (isPrivateAddress(r.address)) {
        throw new Error(`Refusing host that resolves to private IP: ${host} → ${r.address}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Refusing")) throw err;
    throw new Error(`DNS lookup failed for ${host}: ${String(err)}`);
  }
  return u;
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  // Keep one deadline through redirect handling AND body consumption. Validate
  // every Location before sending a request; public URLs can redirect to LANs.
  const signal = AbortSignal.timeout(timeoutMs);
  let target = rawUrl;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const u = await assertSafePublicUrl(target, { allowPrivateHosts: opts.allowPrivateHosts });
    const res = await fetch(u.toString(), {
      redirect: "manual",
      signal,
      headers: { "User-Agent": DEFAULT_UA, ...(opts.headers ?? {}) },
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) return res;
      await res.body?.cancel();
      if (redirects === 5) throw new Error("Too many redirects.");
      target = new URL(location, u).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects.");
}

export async function safeFetchText(rawUrl: string, opts: SafeFetchOptions = {}): Promise<string> {
  const res = await safeFetch(rawUrl, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${rawUrl}`);
  const maxBytes = opts.maxBytes ?? 5_000_000;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error(`Response exceeded ${maxBytes} bytes for ${rawUrl}`);
  }
  return new TextDecoder("utf-8").decode(buf);
}

export async function safeFetchBuffer(rawUrl: string, opts: SafeFetchOptions = {}): Promise<{ data: Buffer; contentType: string }> {
  const res = await safeFetch(rawUrl, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${rawUrl}`);
  const maxBytes = opts.maxBytes ?? 10_000_000;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error(`Response exceeded ${maxBytes} bytes for ${rawUrl}`);
  }
  return { data: Buffer.from(buf), contentType: res.headers.get("content-type") || "application/octet-stream" };
}
