import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountManager } from "../dist/src/notorganic/server.js";
import { ConsentService, FileReceiptStore, policyContentHash } from "../dist/src/notorganic/consent.js";

function env(t: any, preview = false) {
  for (const [key, value] of Object.entries({ NOTORGANIC_ENABLED: "true", BASTE_PUBLIC_ORIGIN: "http://127.0.0.1:8980", NOTORGANIC_ISSUER: "http://127.0.0.1:8981", NOTORGANIC_AUTHORIZATION_URL: "http://127.0.0.1:8981/authorize", BASTE_CONSENT_PREVIEW: preview ? "true" : "false" })) {
    const before = process.env[key]; process.env[key] = value;
    t.after(() => before === undefined ? delete process.env[key] : process.env[key] = before);
  }
}
const adopted = () => ({ product: "baste", minimumAge: 14, status: "adopted", version: "test-adopted-1", effectiveAt: "2020-01-01T00:00:00Z", contentSha256: policyContentHash, termsUrl: "/terms/", privacyUrl: "/privacy/" });
function fixture(t: any) {
  const root = mkdtempSync(join(tmpdir(), "baste-consent-test-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  let policy = adopted(); let did = "did:plc:consent-alice";
  const store = new FileReceiptStore(root); const service = new ConsentService(store, () => policy, () => false);
  const calls: string[] = [];
  const fetcher = (async (input: any) => {
    const url = String(input); calls.push(url);
    if (url.endsWith("/public/token")) return Response.json({ token_type: "DPoP", expires_in: 3600, access_token: `header.${Buffer.from(JSON.stringify({ sub: did, product: "baste", iss: process.env.NOTORGANIC_ISSUER })).toString("base64url")}.signature` });
    if (url.endsWith("/account")) return Response.json({ account: { did } });
    if (url.endsWith("/models")) return Response.json({ data: [{ id: "image" }] });
    if (url.endsWith("/wallet")) return Response.json({ availableMicros: 0 });
    if (url.endsWith("/device/revoke")) return new Response(null, { status: 204 });
    return Response.json({ success: true });
  }) as typeof fetch;
  return { root, store, service, calls, manager: new AccountManager(fetcher, service), restart: () => new AccountManager(fetcher, new ConsentService(new FileReceiptStore(root), () => policy, () => false)), setPolicy: (next: typeof policy) => { policy = next; }, setDid: (next: string) => { did = next; } };
}
async function request(manager: AccountManager, path: string, options: { body?: unknown; cookie?: string; csrf?: string; origin?: string } = {}) {
  const req = Readable.from(options.body === undefined ? [] : [JSON.stringify(options.body)]) as any;
  req.url = `/api/notorganic/${path}`; req.method = options.body === undefined ? "GET" : "POST";
  req.headers = { origin: options.origin ?? process.env.BASTE_PUBLIC_ORIGIN, cookie: options.cookie, "x-baste-csrf": options.csrf };
  const headers = new Map<string, string>(); let status = 0; let body = "";
  const res = { setHeader: (k: string, v: string) => headers.set(k.toLowerCase(), v), writeHead: (code: number, h: Record<string, string> = {}) => { status = code; Object.entries(h).forEach(([k, v]) => headers.set(k.toLowerCase(), v)); }, end: (b = "") => { body = b; } } as any;
  await manager.handle(req, res);
  return { status, data: body ? JSON.parse(body) : null, cookie: headers.get("set-cookie")?.split(";")[0], location: headers.get("location") };
}
async function login(manager: AccountManager, locale = "fr", deliver = true) {
  const anon = await request(manager, "status");
  const started = await request(manager, "login", { cookie: anon.cookie, csrf: anon.data.csrfToken, body: { locale } });
  assert.equal(started.status, 200);
  const state = new URL(started.data.url).searchParams.get("state");
  const callback = await request(manager, `callback?state=${state}&code=test`, { cookie: anon.cookie });
  assert.ok(callback.cookie);
  const status = await request(manager, "status", { cookie: callback.cookie });
  if (deliver) await request(manager, "consent/policy", { cookie: callback.cookie });
  return { cookie: callback.cookie!, csrf: status.data.csrfToken, status: status.data, location: callback.location };
}
function confirmations(version = "test-adopted-1") {
  return { version, contentSha256: policyContentHash, locale: "fr", contractLanguage: "fr", frenchProvided: true, age14OrOlder: true, termsAccepted: true, necessaryProcessingAccepted: true };
}

test("review policies and non-loopback preview flags fail closed before authorization", async t => {
  env(t, false); const f = fixture(t);
  let calls = 0; const manager = new AccountManager((async () => { calls++; throw new Error(); }) as typeof fetch, new ConsentService(f.store));
  const status = await request(manager, "status"); assert.equal(status.data.consent.canAccept, false);
  assert.equal((await request(manager, "login", { cookie: status.cookie, csrf: status.data.csrfToken, body: {} })).status, 503);
  assert.equal(calls, 0);
  process.env.BASTE_CONSENT_PREVIEW = "true";
  assert.equal(new ConsentService(f.store).current().mode, "preview");
  for (const key of ["BASTE_PUBLIC_ORIGIN", "NOTORGANIC_ISSUER", "NOTORGANIC_AUTHORIZATION_URL"]) {
    const before = process.env[key]; process.env[key] = "https://real-service.example";
    assert.equal(new ConsentService(f.store).current().canAccept, false); process.env[key] = before;
  }
  for (const next of [{ ...adopted(), effectiveAt: "2999-01-01" }, { ...adopted(), contentSha256: "changed" }, { ...adopted(), minimumAge: 13 }, { ...adopted(), product: "twyne" }, { ...adopted(), version: "review-1" }]) {
    assert.equal(new ConsentService(f.store, () => next, () => false).current().canAccept, false);
  }
});

test("authentication alone cannot bypass required fields, CSRF, version or provider gates", async t => {
  env(t); const f = fixture(t); const user = await login(f.manager, "fr", false);
  assert.match(user.location!, /lang=fr&account=onboarding/); assert.equal(user.status.authenticated, true); assert.equal(user.status.accessGranted, false);
  for (const path of ["models", "wallet", "packs"]) assert.equal((await request(f.manager, path, user)).status, 428);
  assert.equal((await request(f.manager, "checkout", { ...user, body: { packId: "anything" } })).status, 428);
  await assert.rejects(() => f.manager.getContext({ headers: { cookie: user.cookie } } as any), /confirmations/);
  assert.equal(f.calls.length, 2); // Only identity token/account requests, no model/wallet/checkout.
  assert.equal((await request(f.manager, "consent", { cookie: user.cookie, body: confirmations() })).status, 403);
  assert.equal((await request(f.manager, "consent", { ...user, origin: "https://elsewhere.example", body: confirmations() })).status, 403);
  assert.equal((await request(f.manager, "consent", { ...user, body: confirmations() })).status, 409);
  await request(f.manager, "consent/policy", user);
  for (const body of [{ ...confirmations(), age14OrOlder: false }, { ...confirmations(), age14OrOlder: "true" }, { ...confirmations(), termsAccepted: false }, { ...confirmations(), necessaryProcessingAccepted: false }, { ...confirmations(), frenchProvided: false }, { ...confirmations(), locale: ["fr"] }, { ...confirmations(), version: "old" }, { ...confirmations(), contentSha256: "altered" }, { ...confirmations(), acceptedAt: "browser-supplied" }, { ...confirmations(), dateOfBirth: "do-not-collect" }]) {
    assert.equal((await request(f.manager, "consent", { ...user, body })).status, 409);
    assert.equal(f.service.allowed("did:plc:consent-alice"), false);
  }
  assert.equal(readdirSync(f.root).length, 0);
  assert.equal((await request(f.manager, "consent", { ...user, body: confirmations() })).status, 200);
  assert.equal((await request(f.manager, "status", user)).data.accessGranted, true);
  assert.equal((await request(f.manager, "models", user)).status, 200);
});

test("current receipts persist across sign-outs and restarts, with account and version isolation", async t => {
  env(t); const f = fixture(t); const first = await login(f.manager);
  const accepted = await request(f.manager, "consent", { ...first, body: confirmations() });
  const stamp = accepted.data.consent.receipt.acceptedAt;
  assert.equal((await request(f.manager, "consent", { ...first, body: confirmations() })).data.consent.receipt.acceptedAt, stamp);
  const folder = readdirSync(f.root)[0]; assert.match(folder, /^[a-f0-9]{64}$/);
  const path = join(f.root, folder, "consent.json"); const saved = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.deepEqual(Object.keys(saved).sort(), ["product", "version", "contentSha256", "mode", "acceptedAt", "locale", "contractLanguage", "age14OrOlder", "termsAccepted", "necessaryProcessingAccepted", "frenchProvided"].sort());
  assert.ok(!readFileSync(path, "utf8").includes("did:plc"));
  await request(f.manager, "logout", { ...first, body: {} });
  const returning = await login(f.restart(), "en"); assert.match(returning.location!, /lang=en&account=connected/); assert.equal(returning.status.consent.required, false);
  f.setDid("did:plc:consent-bob"); const other = await login(f.manager); assert.equal(other.status.consent.required, true);
  f.setDid("did:plc:consent-alice"); const active = await login(f.manager); const context = await f.manager.getContext({ headers: { cookie: active.cookie } } as any);
  f.setPolicy({ ...adopted(), version: "test-adopted-2" });
  assert.equal((await request(f.manager, "status", active)).data.consent.required, true);
  await assert.rejects(() => context!.fetch("/v1/images/generations", { method: "POST" }), /confirmations/);
  assert.ok(!f.calls.some(url => url.endsWith("/images/generations")));
  assert.equal((await request(f.manager, "consent", { ...active, body: confirmations() })).status, 409);
  assert.equal((await request(f.manager, "consent", { ...active, body: confirmations("test-adopted-2") })).status, 409);
  await request(f.manager, "consent/policy", active);
  assert.equal((await request(f.manager, "consent", { ...active, body: confirmations("test-adopted-2") })).status, 200);
});

test("decline/underage ends the session, cancels callbacks and records no negative-age data", async t => {
  env(t); const f = fixture(t); const user = await login(f.manager);
  assert.equal((await request(f.manager, "logout", { ...user, body: {} })).status, 200);
  assert.equal((await request(f.manager, "consent", { ...user, body: confirmations() })).status, 403);
  assert.equal((await request(f.manager, "status", { cookie: user.cookie })).data.authenticated, false);
  assert.equal(readdirSync(f.root).length, 0);
  const anon = await request(f.manager, "status");
  const start = await request(f.manager, "login", { cookie: anon.cookie, csrf: anon.data.csrfToken, body: {} });
  await request(f.manager, "logout", { cookie: anon.cookie, csrf: anon.data.csrfToken, body: {} });
  const callback = await request(f.manager, `callback?state=${new URL(start.data.url).searchParams.get("state")}&code=test`, { cookie: anon.cookie });
  assert.match(callback.location!, /account=error/); assert.equal(f.calls.filter(url => url.endsWith("/public/token")).length, 1);
});

test("preview receipts cannot satisfy adopted policies; corrupt or failed stores grant no access", async t => {
  env(t, true); const f = fixture(t); const preview = new ConsentService(f.store);
  const p = preview.current(); preview.accept("did:plc:consent-alice", { ...confirmations(p.version), contentSha256: p.contentSha256 });
  assert.equal(preview.allowed("did:plc:consent-alice"), true); assert.equal(f.service.allowed("did:plc:consent-alice"), false);
  assert.ok(readdirSync(join(f.root, readdirSync(f.root)[0])).includes("consent-preview.json"));
  const broken = new ConsentService({ read: () => undefined, write: () => { throw new Error("disk failed"); } }, adopted, () => false);
  assert.throws(() => broken.accept("did:plc:consent-alice", confirmations()), /disk failed/); assert.equal(broken.allowed("did:plc:consent-alice"), false);
  const user = await login(f.manager); await request(f.manager, "consent", { ...user, body: confirmations() });
  writeFileSync(join(f.root, readdirSync(f.root)[0], "consent.json"), "corrupt");
  assert.equal((await request(f.manager, "models", user)).status, 502);
  assert.ok(!f.calls.some(url => url.endsWith("/models")));
});


test("logout during token exchange cannot restore a session and revokes the orphan device grant", async t => {
  env(t); const f = fixture(t); let release!: () => void; let reached!: () => void;
  const started = new Promise<void>(resolve => { reached = resolve; });
  const paused = new Promise<void>(resolve => { release = resolve; });
  let accounts = 0; let revocations = 0;
  const manager = new AccountManager((async (input: any) => {
    const url = String(input);
    if (url.endsWith("/public/token")) { reached(); await paused; return Response.json({ token_type: "DPoP", expires_in: 3600, refresh_token: "synthetic-device-grant", access_token: `header.${Buffer.from(JSON.stringify({ sub: "did:plc:consent-alice", product: "baste", iss: process.env.NOTORGANIC_ISSUER })).toString("base64url")}.signature` }); }
    if (url.endsWith("/device/revoke")) { revocations++; return new Response(null, { status: 204 }); }
    accounts++; throw new Error("Cancelled sign-in must not fetch the account");
  }) as typeof fetch, f.service);
  const anon = await request(manager, "status");
  const authorization = await request(manager, "login", { cookie: anon.cookie, csrf: anon.data.csrfToken, body: { locale: "fr" } });
  const callback = request(manager, `callback?state=${new URL(authorization.data.url).searchParams.get("state")}&code=fixture`, { cookie: anon.cookie });
  await started; await request(manager, "logout", { cookie: anon.cookie, csrf: anon.data.csrfToken, body: {} }); release();
  const failed = await callback; assert.match(failed.location!, /lang=fr&account=error/);
  assert.equal(accounts, 0); assert.equal(revocations, 1); assert.equal((await request(manager, "status", { cookie: anon.cookie })).data.authenticated, false);
  assert.equal(readdirSync(f.root).length, 0);
});
