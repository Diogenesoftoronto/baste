import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createDpopKey, dpopProof, hash, type DpopKey } from "./dpop.js";

const COOKIE = "baste_session";
const TTL = 8 * 60 * 60 * 1000;
const SCOPE = "wallet:read usage:read billing:checkout infer:image judgement:evaluate";
interface Token { access_token: string; token_type: string; expires_in: number; refresh_token?: string; refresh_expires_in?: number }
interface Profile { did: string; handle?: string }
interface Session { id: string; csrf: string; deadline: number; profile?: Profile; key?: DpopKey; token?: Token; expires?: number; refreshExpires?: number; pendingRefresh?: Promise<void>; transaction?: { state: string; verifier: string; created: number } }
export class AccountError extends Error { constructor(public status: number, message: string) { super(message); } }
const random = () => randomBytes(32).toString("base64url");
function secureURL(value: string): URL {
  const url = new URL(value);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) || url.username || url.password || url.hash) throw new Error("Use HTTPS or a loopback HTTP URL without credentials.");
  return url;
}
export function accountEnabled(): boolean { return /^(true|1)$/i.test(process.env.NOTORGANIC_ENABLED ?? ""); }
export function publicOrigin(): string { return secureURL(process.env.BASTE_PUBLIC_ORIGIN ?? "http://localhost:3456").origin; }
function settings() {
  const issuer = secureURL(process.env.NOTORGANIC_ISSUER ?? "https://api.notorganic.info");
  if (issuer.pathname !== "/" || issuer.search) throw new Error("Issuer must be an origin.");
  const authorization = secureURL(process.env.NOTORGANIC_AUTHORIZATION_URL ?? "https://id.notorganic.info/authorize");
  const origin = publicOrigin();
  return { issuer: issuer.origin, authorization, origin, redirect: `${origin}/api/notorganic/callback`, manage: `${authorization.origin}/account` };
}
function send(res: ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
export async function readJSON(req: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > 65536) throw new AccountError(413, "Request is too large.");
  }
  try { const value = body ? JSON.parse(body) : {}; if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new AccountError(400, "Send a JSON object."); }
}
/** Cookies are never accepted across origins; all writes require the session CSRF token. */
export function guardOrigin(req: IncomingMessage, mutation: boolean): void {
  const headers = req.headers ?? {};
  if (headers.origin && headers.origin !== publicOrigin()) throw new AccountError(403, "This request origin is not allowed.");
  if (headers["sec-fetch-site"] === "cross-site") throw new AccountError(403, "Cross-site requests are not allowed.");
  if (mutation && headers.cookie && headers.origin !== publicOrigin()) throw new AccountError(403, "Send requests from the Studio.");
}
export class AccountManager {
  private sessions = new Map<string, Session>();
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  private find(req: IncomingMessage): Session | undefined {
    const id = String(req.headers?.cookie ?? "").split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const session = id ? this.sessions.get(id) : undefined;
    if (session && session.deadline <= Date.now()) { this.sessions.delete(session.id); return; }
    return session;
  }
  private cookie(res: ServerResponse, id: string) {
    res.setHeader("Set-Cookie", `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TTL / 1000}${publicOrigin().startsWith("https:") ? "; Secure" : ""}`);
  }
  private ensure(req: IncomingMessage, res: ServerResponse): Session {
    let session = this.find(req);
    if (!session) {
      // Expired sessions are removed without timers, and allocation is bounded.
      for (const [id, value] of this.sessions) if (value.deadline <= Date.now()) this.sessions.delete(id);
      if (this.sessions.size >= 10000) throw new AccountError(503, "Account service is busy. Try again later.");
      session = { id: random(), csrf: random(), deadline: Date.now() + TTL };
      this.sessions.set(session.id, session);
      this.cookie(res, session.id);
    }
    return session;
  }
  private csrf(req: IncomingMessage, session: Session) {
    guardOrigin(req, true);
    if (req.headers?.["x-baste-csrf"] !== session.csrf) throw new AccountError(403, "Refresh the Studio and try again.");
  }
  validateMutation(req: IncomingMessage): void {
    const session = this.find(req);
    if (!session) throw new AccountError(401, "Sign in to Not Organic to continue.");
    this.csrf(req, session);
  }
  private async raw(path: string, init: RequestInit = {}): Promise<Response> {
    return this.fetcher(`${settings().issuer}${path}`, { ...init, redirect: "error", signal: init.signal ?? AbortSignal.timeout(20000) });
  }
  private async providerError(response: Response): Promise<never> {
    const status = response.status;
    throw new AccountError([400, 401, 402, 403, 429].includes(status) ? status : 502,
      status === 402 ? "Your Not Organic balance is too low." : status === 401 ? "Sign in to Not Organic again." : status === 403 ? "Not Organic has not approved this access for Baste." : status === 429 ? "Not Organic is busy. Try again shortly." : "Not Organic could not complete this request.");
  }
  private setToken(session: Session, value: unknown) {
    const token = value as Token;
    if (!token || typeof token.access_token !== "string" || token.token_type !== "DPoP" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new AccountError(502, "Not Organic returned an invalid session.");
    let claims: { product?: unknown; iss?: unknown; sub?: unknown };
    try { claims = JSON.parse(Buffer.from(token.access_token.split(".")[1] ?? "", "base64url").toString()); }
    catch { throw new AccountError(502, "Not Organic returned an invalid session."); }
    // The token response comes only from the configured issuer. Check product
    // on every rotation too: an operator changing registration must never cause
    // Baste to spend another product's grant balance.
    if (claims.product !== "baste" || claims.iss !== settings().issuer || (session.profile && claims.sub !== session.profile.did)) throw new AccountError(403, "This provider session is not approved for Baste. Ask the operator to register Baste.");
    session.token = token;
    session.expires = Date.now() + token.expires_in * 1000;
    if (token.refresh_token && token.refresh_expires_in) session.refreshExpires = Date.now() + token.refresh_expires_in * 1000;
  }
  private async active(session: Session): Promise<void> {
    if (!session.key || !session.token) throw new AccountError(401, "Sign in to Not Organic to continue.");
    if ((session.expires ?? 0) > Date.now() + 10000) return;
    if (session.pendingRefresh) return session.pendingRefresh;
    if (!session.token.refresh_token || (session.refreshExpires ?? 0) <= Date.now()) throw new AccountError(401, "Sign in to Not Organic again.");
    const refresh = session.token.refresh_token;
    session.pendingRefresh = (async () => {
      const url = `${settings().issuer}/v1/public/device/token`;
      const response = await this.raw("/v1/public/device/token", { method: "POST", headers: { "content-type": "application/json", dpop: dpopProof(session.key!, url, "POST") }, body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refresh }) });
      if (!response.ok) { session.profile = undefined; session.token = undefined; await this.providerError(response); }
      this.setToken(session, await response.json());
    })().finally(() => { session.pendingRefresh = undefined; });
    return session.pendingRefresh;
  }
  private async request(session: Session, path: string, init: RequestInit = {}): Promise<Response> {
    if (session.profile && this.sessions.get(session.id) !== session) throw new AccountError(401, "This account session has ended. Sign in again to continue.");
    if (!/^\/v1\/(account|models|wallet|billing\/checkout|images\/generations|judgement)$/.test(path)) throw new AccountError(400, "Unsupported Not Organic route.");
    await this.active(session);
    if (session.profile && this.sessions.get(session.id) !== session) throw new AccountError(401, "This account session has ended. Sign in again to continue.");
    const headers = new Headers(init.headers);
    const url = `${settings().issuer}${path}`;
    headers.set("authorization", `DPoP ${session.token!.access_token}`);
    headers.set("dpop", dpopProof(session.key!, url, init.method ?? "GET", session.token!.access_token));
    headers.set("x-notorganic-product", "baste");
    headers.set("x-notorganic-feature", path.endsWith("judgement") ? "asset-quality" : "studio");
    if (init.method && init.method !== "GET") headers.set("idempotency-key", headers.get("idempotency-key") ?? random());
    const response = await this.raw(path, { ...init, headers });
    if (!response.ok) await this.providerError(response);
    return response;
  }
  async getContext(req: IncomingMessage): Promise<{ did: string; fetch: (path: string, init?: RequestInit) => Promise<Response> } | undefined> {
    if (!accountEnabled()) return;
    const session = this.find(req);
    if (!session?.profile) throw new AccountError(401, "Sign in to Not Organic to continue.");
    await this.active(session);
    return { did: session.profile.did, fetch: (path, init) => this.request(session, path, init) };
  }
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", publicOrigin());
    if (!url.pathname.startsWith("/api/notorganic/")) return false;
    res.setHeader("Cache-Control", "no-store");
    const route = url.pathname.slice("/api/notorganic/".length);
    try {
      // OAuth callback is a top-level cross-site navigation, verified using one-time state.
      if (route !== "callback") guardOrigin(req, req.method !== "GET");
      const session = this.ensure(req, res);
      if (route === "status" && req.method === "GET") {
        let reason: string | undefined;
        if (session.profile) { try { await this.active(session); } catch (e) { session.profile = undefined; reason = e instanceof AccountError ? e.message : "Account service is unavailable."; } }
        send(res, { enabled: accountEnabled(), configured: accountEnabled(), authenticated: !!session.profile, csrfToken: session.csrf, profile: session.profile ?? null, manageAccountUrl: settings().manage, capabilities: { profileEdit: false, imageGeneration: true, videoGeneration: false, serverConfigEdit: !accountEnabled(), externalFileEdit: !accountEnabled(), serverCropSave: !accountEnabled() }, ...(reason ? { reason } : {}) }); return true;
      }
      if (!accountEnabled()) throw new AccountError(503, "Not Organic is not enabled on this Baste server.");
      if (route === "login" && req.method === "POST") {
        this.csrf(req, session); await readJSON(req);
        const verifier = random(); const state = random();
        session.transaction = { verifier, state, created: Date.now() };
        const config = settings(); const authorization = new URL(config.authorization);
        for (const [key, value] of Object.entries({ client_id: config.origin, redirect_uri: config.redirect, response_type: "code", code_challenge_method: "S256", code_challenge: hash(verifier), scope: SCOPE, state, product: "baste", prompt: "select_account" })) authorization.searchParams.set(key, value);
        send(res, { url: authorization.toString() }); return true;
      }
      if (route === "callback" && req.method === "GET") {
        const tx = session.transaction;
        delete session.transaction;
        if (!tx || url.searchParams.get("state") !== tx.state || Date.now() - tx.created > 300000 || url.searchParams.has("error")) throw new AccountError(400, "Sign-in could not be verified. Try again.");
        const code = url.searchParams.get("code");
        if (!code || code.length > 512) throw new AccountError(400, "Sign-in could not be verified.");
        const key = createDpopKey(); const config = settings();
        const response = await this.raw("/v1/public/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, code_verifier: tx.verifier, client_id: config.origin, redirect_uri: config.redirect, dpop_jwk: key.publicJwk, device_session: true, device_name: "Baste Studio" }) });
        if (!response.ok) await this.providerError(response);
        const next: Session = { id: random(), csrf: random(), deadline: Date.now() + TTL, key };
        this.setToken(next, await response.json());
        // Authenticate through the issuer before inspecting token claims. Never trust a browser DID.
        const account = await (await this.request(next, "/v1/account")).json() as { account?: { did?: string; handle?: string } };
        const claims = JSON.parse(Buffer.from(next.token!.access_token.split(".")[1] ?? "", "base64url").toString());
        if (!account.account?.did || !/^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/.test(account.account.did) || account.account.did !== claims.sub || claims.product !== "baste" || claims.iss !== config.issuer) throw new AccountError(403, "This provider session is not approved for Baste. Ask the operator to register Baste.");
        // A concurrent logout/new login invalidates the original transaction.
        if (this.sessions.get(session.id) !== session || session.transaction) throw new AccountError(400, "Sign-in was cancelled. Try again.");
        next.profile = { did: account.account.did, ...(typeof account.account.handle === "string" ? { handle: account.account.handle } : {}) };
        this.sessions.delete(session.id); this.sessions.set(next.id, next); this.cookie(res, next.id);
        res.writeHead(303, { location: "/gui/?flow=settings&account=connected" }); res.end(); return true;
      }
      if (route === "logout" && req.method === "POST") {
        this.csrf(req, session); this.sessions.delete(session.id);
        // Local authority is removed even if provider revocation cannot complete.
        if (session.token?.refresh_token && session.key) {
          const target = `${settings().issuer}/v1/public/device/revoke`;
          await this.raw("/v1/public/device/revoke", { method: "POST", headers: { "content-type": "application/json", dpop: dpopProof(session.key, target, "POST") }, body: JSON.stringify({ refresh_token: session.token.refresh_token }) }).catch(() => undefined);
        }
        res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${publicOrigin().startsWith("https:") ? "; Secure" : ""}`);
        send(res, { success: true }); return true;
      }
      if (!session.profile) throw new AccountError(401, "Sign in to Not Organic to continue.");
      if (route === "models" && req.method === "GET") {
        const value = await (await this.request(session, "/v1/models")).json() as { data?: Array<{ id: string }> };
        send(res, { data: (value.data ?? []).filter(m => typeof m.id === "string").map(m => ({ id: m.id, kind: m.id === "image" ? "image" : m.id === "judgement" ? "judgement" : ["fast", "balanced", "reasoning", "vision"].includes(m.id) ? "text" : "other" })) }); return true;
      }
      if ((route === "wallet" || route === "packs") && req.method === "GET") { send(res, normalizeWallet(await (await this.request(session, "/v1/wallet")).json())); return true; }
      if (route === "checkout" && req.method === "POST") {
        this.csrf(req, session); const body = await readJSON(req);
        const wallet = normalizeWallet(await (await this.request(session, "/v1/wallet")).json());
        if (!wallet.checkout.available) throw new AccountError(503, "Checkout is not available for Baste yet.");
        const pack = typeof body.packId === "string" && wallet.checkout.packIds.includes(body.packId) ? body.packId : undefined;
        const plan = typeof body.planId === "string" && wallet.checkout.planIds.includes(body.planId) ? body.planId : undefined;
        if (!!pack === !!plan) throw new AccountError(400, "Choose one available credit pack or plan.");
        if (!settings().origin.startsWith("https:")) throw new AccountError(503, "Checkout needs an HTTPS Studio return address.");
        const result = await (await this.request(session, "/v1/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(pack ? { pack_id: pack } : { plan_id: plan }), return_url: `${settings().origin}/gui/?flow=settings&payment=returned` }) })).json() as { url?: string };
        const checkout = result.url ? secureURL(result.url) : undefined;
        if (checkout?.protocol !== "https:") throw new AccountError(502, "Not Organic returned no secure checkout address.");
        send(res, { url: checkout.toString() }); return true;
      }
      throw new AccountError(404, "Not found.");
    } catch (error) {
      const safe = error instanceof AccountError ? error : new AccountError(502, "Account service is unavailable. Try again later.");
      if (route === "callback") { res.writeHead(303, { location: `/gui/?flow=settings&account=error&reason=${encodeURIComponent(safe.message)}` }); res.end(); }
      else send(res, { error: safe.message }, safe.status);
      return true;
    }
  }
}
function micros(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
export function normalizeWallet(input: unknown) {
  const value = input as Record<string, any>;
  if (!value || typeof value !== "object") throw new AccountError(502, "Your balance could not be verified.");
  const cash = value.balanceMicros ?? value.balance_microusd;
  const held = value.reservedMicros ?? 0;
  if (value.availableMicros !== undefined && !micros(value.availableMicros)) throw new AccountError(502, "Your balance could not be verified.");
  const available = micros(value.availableMicros) ? value.availableMicros : micros(cash) && micros(held) ? Math.max(0, cash - held) : undefined;
  if (available === undefined) throw new AccountError(502, "Your balance could not be verified.");
  const ids = (x: unknown): string[] => Array.isArray(x) ? x.filter((id): id is string => typeof id === "string" && /^[a-z0-9_-]{1,100}$/i.test(id)) : [];
  const checkoutAvailable = value.checkout?.available === true;
  return { availableMicros: available, ...(micros(cash) ? { balanceMicros: cash } : {}), debtMicros: micros(value.debtMicros) ? value.debtMicros : 0, blocked: value.hostedInferenceBlocked === true || value.debtMicros > 0, checkout: { available: checkoutAvailable, packIds: checkoutAvailable ? ids(value.checkout?.packIds) : [], planIds: checkoutAvailable ? ids(value.checkout?.planIds) : [] } };
}
export const accountManager = new AccountManager();
export async function getNotOrganicFetch(req: IncomingMessage) { return (await accountManager.getContext(req))?.fetch; }
