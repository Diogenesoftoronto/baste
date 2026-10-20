/** CLI credentials stay on this device; only provider-verified identities are accepted. */
import { createServer } from "node:http";
import { randomBytes, createPrivateKey } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { createDpopKey, dpopProof, hash, type DpopKey } from "./dpop.js";
import { normalizeWallet } from "./server.js";

const SCOPES = "wallet:read usage:read billing:checkout infer:image judgement:evaluate videos:generate videos:read";
interface Token { access_token: string; token_type: string; expires_in: number; refresh_token?: string; refresh_expires_in?: number }
interface Credentials { issuer: string; clientId: string; did: string; key: string; publicJwk: JsonWebKey; token: Token; expires: number; refreshExpires: number }
export function credentialPath(): string { return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "baste", "account.json"); }
function issuerOrigin(): string {
  const url = new URL(process.env.NOTORGANIC_ISSUER || "https://api.notorganic.info");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("NOTORGANIC_ISSUER must be an HTTPS origin.");
  return url.origin;
}
function signingKey(c: Credentials): DpopKey { return { privateKey: createPrivateKey(c.key), publicJwk: c.publicJwk }; }
function save(c: Credentials) {
  const path = credentialPath(); mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomBytes(12).toString("hex")}`;
  writeFileSync(temporary, JSON.stringify(c), { mode: 0o600, flag: "wx" });
  try { renameSync(temporary, path); } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}
function token(c: Credentials, value: unknown): void {
  const t = value as Token;
  if (t?.token_type !== "DPoP" || !t.access_token || !Number.isFinite(t.expires_in) || t.expires_in <= 0) throw new Error("Not Organic returned an invalid session.");
  const claims = JSON.parse(Buffer.from(t.access_token.split(".")[1] || "", "base64url").toString());
  if (claims.iss !== c.issuer || claims.product !== "baste" || (c.did && claims.sub !== c.did)) throw new Error("This session is not approved for Baste.");
  c.token = t; c.expires = Date.now() + t.expires_in * 1000;
  if (t.refresh_token && t.refresh_expires_in) c.refreshExpires = Date.now() + t.refresh_expires_in * 1000;
}
export function openAccountUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Expected a secure account URL.");
  console.log(url.href);
  const executable = process.platform === "darwin" ? "open" : process.platform === "win32" ? "rundll32" : "xdg-open";
  const child = spawn(executable, process.platform === "win32" ? ["url.dll,FileProtocolHandler", url.href] : [url.href], { stdio: "ignore", detached: true });
  child.on("error", () => {}); child.unref();
}
async function checked(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(response.status === 402 ? "Not Organic needs more credit. Run baste credits." : response.status === 401 || response.status === 403 ? "Account access is unavailable. Run baste login and check permissions." : `Not Organic request failed (${response.status}).`);
  return response;
}
export class CliAccount {
  constructor(private c: Credentials, private fetcher: typeof fetch = fetch) {}
  static load(): CliAccount {
    if (!existsSync(credentialPath())) throw new Error("Sign in first: baste login");
    const c = JSON.parse(readFileSync(credentialPath(), "utf8")) as Credentials;
    if (c.issuer !== issuerOrigin()) throw new Error("The saved account uses another issuer. Run baste login.");
    return new CliAccount(c);
  }
  private async active() {
    if (this.c.expires > Date.now() + 10000) return;
    if (!this.c.token.refresh_token || this.c.refreshExpires <= Date.now()) throw new Error("Session expired. Run baste login.");
    const url = `${this.c.issuer}/v1/public/device/token`;
    const response = await checked(await this.fetcher(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(20000), headers: { "content-type": "application/json", dpop: dpopProof(signingKey(this.c), url, "POST") }, body: JSON.stringify({ grant_type: "refresh_token", refresh_token: this.c.token.refresh_token }) }));
    token(this.c, await response.json()); save(this.c);
  }
  private refreshing?: Promise<void>;
  fetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!/^\/v1\/(account|wallet|models|billing\/checkout|images\/generations|judgement|fal\/jobs(?:\/fal_[a-zA-Z0-9_-]{43})?)$/.test(path)) throw new Error("Unsupported account route.");
    if (!this.refreshing) this.refreshing = this.active().finally(() => { this.refreshing = undefined; });
    await this.refreshing;
    const url = `${this.c.issuer}${path}`; const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    headers.set("authorization", `DPoP ${this.c.token.access_token}`);
    headers.set("dpop", dpopProof(signingKey(this.c), url, method, this.c.token.access_token));
    headers.set("x-notorganic-product", "baste"); headers.set("x-notorganic-feature", "cli");
    if (method !== "GET") headers.set("idempotency-key", headers.get("idempotency-key") ?? randomBytes(24).toString("base64url"));
    return checked(await this.fetcher(url, { ...init, headers, redirect: "error", signal: init.signal ?? AbortSignal.timeout(120000) }));
  };
  async credits(offer?: { packId?: string; planId?: string }, open = true) {
    const wallet = normalizeWallet(await (await this.fetch("/v1/wallet")).json());
    console.log(`Available credit: $${(wallet.availableMicros / 1e6).toFixed(2)}${wallet.blocked ? " (blocked)" : ""}`);
    if (!offer) {
      console.log(`Credit packs: ${wallet.checkout.packIds.join(", ") || "none available"}`);
      console.log(`Plans: ${wallet.checkout.planIds.join(", ") || "none available"}`);
      console.log("Top up: baste credits --buy <pack-id> (review and pay in your browser)"); return;
    }
    if (!wallet.checkout.available || (!!offer.packId === !!offer.planId) || (offer.packId && !wallet.checkout.packIds.includes(offer.packId)) || (offer.planId && !wallet.checkout.planIds.includes(offer.planId))) throw new Error("Choose one currently advertised credit pack or plan.");
    const result = await (await this.fetch("/v1/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(offer.packId ? { pack_id: offer.packId } : { plan_id: offer.planId }), return_url: "https://baste.love/gui/?flow=settings&payment=returned" }) })).json() as { url?: string };
    const url = new URL(result.url ?? "");
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Not Organic returned no secure checkout URL.");
    if (open) openAccountUrl(url.href); else console.log(url.href);
    console.log("After checkout, run baste credits to verify the balance.");
  }
  async logout() {
    try {
      const url = `${this.c.issuer}/v1/public/device/revoke`;
      await checked(await this.fetcher(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(20000), headers: { "content-type": "application/json", dpop: dpopProof(signingKey(this.c), url, "POST") }, body: JSON.stringify({ refresh_token: this.c.token.refresh_token }) }));
    } finally { if (existsSync(credentialPath())) unlinkSync(credentialPath()); }
  }
}

export async function cliLogin(open = true): Promise<void> {
  const issuer = issuerOrigin(); const clientId = "http://localhost:3458"; const redirect = `${clientId}/callback`;
  const verifier = randomBytes(32).toString("base64url"); const state = randomBytes(32).toString("base64url");
  const key = createDpopKey();
  const authorization = new URL(process.env.NOTORGANIC_AUTHORIZATION_URL || "https://id.notorganic.info/authorize");
  if (authorization.protocol !== "https:" || authorization.username || authorization.password) throw new Error("Use an HTTPS authorization endpoint.");
  for (const [name, value] of Object.entries({ client_id: clientId, redirect_uri: redirect, response_type: "code", code_challenge_method: "S256", code_challenge: hash(verifier), scope: SCOPES, state, product: "baste" })) authorization.searchParams.set(name, value);
  await new Promise<void>((resolve, reject) => {
    let consumed = false;
    const server = createServer(async (req, res) => {
      const callback = new URL(req.url ?? "/", clientId);
      if (callback.pathname !== "/callback" || callback.searchParams.get("state") !== state || consumed) { res.writeHead(400); res.end("Invalid sign-in callback."); return; }
      consumed = true;
      try {
        const code = callback.searchParams.get("code");
        if (callback.searchParams.has("error") || !code || code.length > 512) throw new Error("Sign-in was declined or expired.");
        const response = await checked(await fetch(`${issuer}/v1/public/token`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(20000), headers: { "content-type": "application/json" }, body: JSON.stringify({ code, code_verifier: verifier, client_id: clientId, redirect_uri: redirect, dpop_jwk: key.publicJwk, device_session: true, device_name: "Baste CLI" }) }));
        const c: Credentials = { issuer, clientId, did: "", key: key.privateKey.export({ type: "pkcs8", format: "pem" }).toString(), publicJwk: key.publicJwk, token: {} as Token, expires: 0, refreshExpires: 0 };
        token(c, await response.json());
        const account = await (await new CliAccount(c).fetch("/v1/account")).json() as { account?: { did?: string } };
        const claims = JSON.parse(Buffer.from(c.token.access_token.split(".")[1] || "", "base64url").toString());
        if (!account.account?.did || account.account.did !== claims.sub || !/^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/.test(account.account.did)) throw new Error("Account identity could not be verified.");
        c.did = account.account.did; save(c);
        res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store", "referrer-policy": "no-referrer" }); res.end("Signed in to Baste. You can close this tab.");
        console.log("Signed in. Run baste credits to inspect your wallet."); finish(); resolve();
      } catch (error) { res.writeHead(400); res.end("Sign-in failed. Return to the terminal."); finish(); reject(error); }
    });
    const timer = setTimeout(() => { finish(); reject(new Error("Sign-in timed out. Run baste login again.")); }, 300000);
    const finish = () => { clearTimeout(timer); server.close(); };
    server.on("error", error => { finish(); reject(error); });
    server.listen(3458, "127.0.0.1", () => { console.log("Sign in to Not Organic:"); if (open) openAccountUrl(authorization.href); else console.log(authorization.href); });
  });
}
