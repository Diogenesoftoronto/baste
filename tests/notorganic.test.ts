import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, createPublicKey, verify } from "node:crypto";
import { AccountManager, normalizeWallet } from "../dist/src/notorganic/server.js";
import { createDpopKey, dpopProof } from "../dist/src/notorganic/dpop.js";
import { accountScope, accountPath } from "../dist/src/notorganic/scope.js";
import { getPersona, listPersonas, savePersona } from "../dist/src/notorganic/personas.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import { appendFeedback, loadFeedback } from "../dist/src/evaluation/feedback-memory.js";
import { handleAPIRequest } from "../dist/src/gui/api.js";
import { generationPlan, assertJudgementCeiling } from "../dist/src/notorganic/budget.js";
import { safeFetch, assertSafePublicUrl } from "../dist/src/shared/url.js";

function environment(t: any) {
  for (const [key, value] of Object.entries({ NOTORGANIC_ENABLED: "true", BASTE_PUBLIC_ORIGIN: "http://localhost:5173", NOTORGANIC_ISSUER: "https://api.notorganic.info", NOTORGANIC_AUTHORIZATION_URL: "https://id.notorganic.info/authorize" })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => previous === undefined ? delete process.env[key] : process.env[key] = previous);
  }
}
function token(did = "did:plc:alice", product = "baste") {
  return { token_type: "DPoP", expires_in: 300, access_token: `header.${Buffer.from(JSON.stringify({ sub: did, product, iss: "https://api.notorganic.info" })).toString("base64url")}.signature`, refresh_token: "server-held-refresh", refresh_expires_in: 3600 };
}
async function request(manager: AccountManager, route: string, options: { body?: unknown; cookie?: string; csrf?: string; method?: string; origin?: string } = {}) {
  const req = Readable.from(options.body === undefined ? [] : [JSON.stringify(options.body)]) as any;
  req.url = `/api/notorganic/${route}`; req.method = options.method ?? (options.body === undefined ? "GET" : "POST");
  req.headers = { origin: options.origin ?? process.env.BASTE_PUBLIC_ORIGIN ?? "http://localhost:5173", ...(options.cookie ? { cookie: options.cookie } : {}), ...(options.csrf ? { "x-baste-csrf": options.csrf } : {}) };
  const headers = new Map<string, any>(); let status = 0; let body = "";
  const res = { setHeader: (key: string, value: any) => headers.set(key.toLowerCase(), value), writeHead: (value: number, extra: Record<string, any> = {}) => { status = value; Object.entries(extra).forEach(([k, v]) => headers.set(k.toLowerCase(), v)); }, end: (value = "") => { body = value; } } as any;
  assert.equal(await manager.handle(req, res), true);
  return { status, headers, body, data: body && headers.get("content-type")?.includes("application/json") ? JSON.parse(body) : null, cookie: headers.get("set-cookie")?.split(";")[0] };
}
async function transaction(manager: AccountManager) {
  const status = await request(manager, "status");
  const started = await request(manager, "login", { cookie: status.cookie, csrf: status.data.csrfToken, body: { returnTo: "https://evil.test/" } });
  assert.equal(started.status, 200);
  const authorization = new URL(started.data.url);
  return { cookie: status.cookie, csrf: status.data.csrfToken, authorization, state: authorization.searchParams.get("state")! };
}

test("PKCE, browser-bound one-time state, rotation and issuer-authenticated DID keep credentials server-side", async t => {
  environment(t); const calls: Array<{ url: string; init: RequestInit }> = [];
  const manager = new AccountManager((async (input, init) => {
    calls.push({ url: String(input), init: init! });
    if (String(input).endsWith("/public/token")) return Response.json(token());
    if (String(input).endsWith("/account")) return Response.json({ account: { did: "did:plc:alice", handle: "alice.notorganic.info" } });
    if (String(input).endsWith("/models")) return Response.json({ data: [{ id: "image" }, { id: "judgement" }] });
    if (String(input).endsWith("/device/revoke")) return new Response(null, { status: 204 });
    throw new Error("Unexpected upstream request");
  }) as typeof fetch);
  const tx = await transaction(manager);
  assert.equal(tx.authorization.origin, "https://id.notorganic.info");
  assert.equal(tx.authorization.searchParams.get("redirect_uri"), "http://localhost:5173/api/notorganic/callback");
  const callback = await request(manager, `callback?state=${tx.state}&code=one-time-code`, { cookie: tx.cookie });
  assert.equal(callback.headers.get("location"), "/gui/?flow=settings&account=connected");
  assert.notEqual(callback.cookie, tx.cookie);
  assert.match(callback.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  const exchange = JSON.parse(String(calls[0].init.body));
  assert.equal(createHash("sha256").update(exchange.code_verifier).digest("base64url"), tx.authorization.searchParams.get("code_challenge"));
  assert.equal(exchange.dpop_jwk.d, undefined);
  const status = await request(manager, "status", { cookie: callback.cookie });
  assert.equal(status.data.profile.did, "did:plc:alice");
  assert.equal(status.data.authenticated, true);
  assert.ok(!status.body.includes("access_token") && !status.body.includes("server-held-refresh"));
  assert.equal((await request(manager, "models", { cookie: callback.cookie })).data.data[0].kind, "image");
  const replay = await request(manager, `callback?state=${tx.state}&code=one-time-code`, { cookie: tx.cookie });
  assert.match(replay.headers.get("location"), /account=error/);
  assert.equal(calls.filter(c => c.url.endsWith("/public/token")).length, 1);
  const backgroundContext = await manager.getContext({ headers: { cookie: callback.cookie } } as any);
  const logout = await request(manager, "logout", { cookie: callback.cookie, csrf: status.data.csrfToken, body: {} });
  assert.equal(logout.status, 200);
  assert.equal((await request(manager, "models", { cookie: callback.cookie })).status, 401);
  await assert.rejects(() => backgroundContext!.fetch("/v1/images/generations", { method: "POST" }), /session has ended/);
  assert.ok(!calls.some(c => c.url.endsWith("/images/generations")));
});

test("CSRF, cross-origin attempts and callbacks without their original cookie cannot authorize requests", async t => {
  environment(t); let calls = 0;
  const manager = new AccountManager((async () => { calls++; throw new Error("Never call provider"); }) as typeof fetch);
  const status = await request(manager, "status");
  assert.equal((await request(manager, "login", { cookie: status.cookie, body: {} })).status, 403);
  assert.equal((await request(manager, "login", { cookie: status.cookie, csrf: status.data.csrfToken, body: {}, origin: "https://evil.test" })).status, 403);
  const tx = await transaction(manager);
  const unrelated = await request(manager, `callback?state=${tx.state}&code=code`);
  assert.match(unrelated.headers.get("location"), /account=error/);
  assert.equal(calls, 0);
});

test("another product or mismatched account fails closed and provider errors do not expose credentials", async t => {
  environment(t);
  for (const scenario of ["other-product", "wrong-did", "raw-error"]) {
    const manager = new AccountManager((async (input) => {
      if (String(input).endsWith("/public/token")) return scenario === "raw-error" ? Response.json({ error: "secret-provider-key=do-not-leak" }, { status: 500 }) : Response.json(token("did:plc:alice", scenario === "other-product" ? "keating" : "baste"));
      return Response.json({ account: { did: "did:plc:mallory" } });
    }) as typeof fetch);
    const tx = await transaction(manager);
    const callback = await request(manager, `callback?state=${tx.state}&code=code`, { cookie: tx.cookie });
    assert.match(callback.headers.get("location"), /account=error/);
    assert.ok(!callback.headers.get("location").includes("do-not-leak"));
    assert.equal((await request(manager, "status", { cookie: tx.cookie })).data.authenticated, false);
  }
});

test("DPoP proves exact method, URL and capability token using a verifiable P-256 signature", () => {
  const key = createDpopKey(); const url = "https://api.notorganic.info/v1/models";
  const proof = dpopProof(key, url, "GET", "capability"); const parts = proof.split(".");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  assert.equal(header.jwk.d, undefined); assert.equal(claims.htu, url); assert.equal(claims.htm, "GET");
  assert.equal(claims.ath, createHash("sha256").update("capability").digest("base64url"));
  assert.equal(verify("sha256", Buffer.from(parts.slice(0, 2).join(".")), { key: createPublicKey({ key: header.jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(parts[2], "base64url")), true);
});

test("custom personas and learned feedback are isolated per account while built-in templates remain shared", t => {
  const before = process.cwd(); const dir = mkdtempSync(join(tmpdir(), "baste-accounts-")); process.chdir(dir);
  t.after(() => { process.chdir(before); rmSync(dir, { recursive: true, force: true }); });
  accountScope.run("did:plc:alice", () => {
    savePersona({ ...basePersonas.cyberbotanist, id: "mine", name: "Alice" });
    appendFeedback({ personaId: "mine", score: 1, feedback: "Alice private feedback", ts: Date.now() });
    assert.equal(getPersona("mine")?.name, "Alice");
    assert.throws(() => savePersona({ ...basePersonas.cyberbotanist, id: "../../escape" }));
  });
  accountScope.run("did:plc:bob", () => {
    assert.equal(getPersona("mine"), undefined); assert.ok(!listPersonas().includes("mine")); assert.deepEqual(loadFeedback("mine"), []);
    assert.equal(getPersona("cyberbotanist")?.id, "cyberbotanist");
    savePersona({ ...basePersonas.cyberbotanist, id: "mine", name: "Bob" });
  });
  accountScope.run("did:plc:alice", () => { assert.equal(getPersona("mine")?.name, "Alice"); assert.equal(loadFeedback("mine")[0].feedback, "Alice private feedback"); });
});

test("wallet normalization preserves authoritative available credit and ready stable billing ids", () => {
  assert.deepEqual(normalizeWallet({ balanceMicros: 1000, reservedMicros: 800, availableMicros: 700, checkout: { available: false, packIds: ["hidden-pack"] } }), { availableMicros: 700, balanceMicros: 1000, debtMicros: 0, blocked: false, checkout: { available: false, packIds: [], planIds: [] } });
  assert.equal(normalizeWallet({ balanceMicros: 1000, reservedMicros: 800 }).availableMicros, 200);
  assert.throws(() => normalizeWallet({ availableMicros: "unverified" }));
});

test("concurrent requests share one bound refresh and rotated sessions retain their account and product", async t => {
  environment(t); const initial = Date.now(); let now = initial;
  t.mock.method(Date, "now", () => now);
  let refreshes = 0;
  const manager = new AccountManager((async (input, init) => {
    const url = String(input);
    if (url.endsWith("/device/token")) {
      refreshes++;
      assert.equal(JSON.parse(String(init!.body)).refresh_token, "server-held-refresh");
      const claims = JSON.parse(Buffer.from(new Headers(init!.headers).get("dpop")!.split(".")[1], "base64url").toString());
      assert.equal(claims.htu, url); assert.equal(claims.htm, "POST");
      await new Promise(resolve => setImmediate(resolve));
      return Response.json({ ...token(), refresh_token: "rotated-refresh" });
    }
    if (url.endsWith("/public/token")) return Response.json(token());
    if (url.endsWith("/account")) return Response.json({ account: { did: "did:plc:alice" } });
    return Response.json({ data: [{ id: "image" }] });
  }) as typeof fetch);
  const tx = await transaction(manager);
  const callback = await request(manager, `callback?state=${tx.state}&code=code`, { cookie: tx.cookie });
  now += 295000;
  const responses = await Promise.all([request(manager, "models", { cookie: callback.cookie }), request(manager, "models", { cookie: callback.cookie })]);
  assert.ok(responses.every(response => response.status === 200)); assert.equal(refreshes, 1);
});

test("checkout accepts only advertised stable ids and a server-fixed HTTPS return address", async t => {
  environment(t); process.env.BASTE_PUBLIC_ORIGIN = "https://baste.example";
  let checkouts = 0;
  const manager = new AccountManager((async (input, init) => {
    const url = String(input);
    if (url.endsWith("/public/token")) return Response.json(token());
    if (url.endsWith("/account")) return Response.json({ account: { did: "did:plc:alice" } });
    if (url.endsWith("/wallet")) return Response.json({ availableMicros: 5000, checkout: { available: true, packIds: ["credit-small"], planIds: [] } });
    if (url.endsWith("/checkout")) {
      checkouts++; const body = JSON.parse(String(init!.body));
      assert.equal(body.return_url, "https://baste.example/gui/?flow=settings&payment=returned");
      assert.equal(body.pack_id, "credit-small"); assert.ok(new Headers(init!.headers).has("idempotency-key"));
      return Response.json({ url: "https://checkout.paddle.com/test-checkout" });
    }
    throw new Error("Unexpected checkout request");
  }) as typeof fetch);
  const tx = await transaction(manager); const callback = await request(manager, `callback?state=${tx.state}&code=code`, { cookie: tx.cookie });
  assert.match(callback.headers.get("set-cookie"), /Secure/);
  const status = await request(manager, "status", { cookie: callback.cookie });
  const options = { cookie: callback.cookie, csrf: status.data.csrfToken };
  assert.equal((await request(manager, "checkout", { ...options, body: { packId: "forbidden" } })).status, 400);
  assert.equal((await request(manager, "checkout", { ...options, body: { packId: "credit-small", return_url: "https://evil.test" } })).data.url, "https://checkout.paddle.com/test-checkout");
  assert.equal(checkouts, 1);
});

test("Studio routes isolate personas, moodboards, jobs and feedback and reject unauthenticated writes", async t => {
  environment(t);
  const before = process.cwd(); const dir = mkdtempSync(join(tmpdir(), "baste-account-api-")); process.chdir(dir);
  t.after(() => { process.chdir(before); rmSync(dir, { recursive: true, force: true }); });
  let currentDid = "did:plc:api-alice";
  let walletCredit = 1000; let imageCalls = 0; let judgementCalls = 0;
  t.mock.method(globalThis, "fetch", async (input: any, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/public/token")) return Response.json(token(currentDid));
    if (url.endsWith("/account")) return Response.json({ account: { did: currentDid } });
    if (url.endsWith("/models")) return Response.json({ data: [{ id: "image" }, { id: "judgement" }] });
    if (url.endsWith("/wallet")) return Response.json({ availableMicros: walletCredit });
    if (url.endsWith("/images/generations")) {
      imageCalls++; assert.equal(new Headers(init?.headers).get("x-notorganic-max-cost-microusd"), "500000");
      return Response.json({ data: [{ b64_json: Buffer.from("test image pixels").toString("base64") }] });
    }
    if (url.endsWith("/judgement")) {
      judgementCalls++; assert.equal(new Headers(init?.headers).get("x-notorganic-max-cost-microusd"), "100000");
      const body = JSON.parse(String(init?.body));
      assert.ok(Object.values(body.state).every(value => typeof value === "string"));
      const answers = Object.fromEntries(Object.keys(body.questions).map(key => [key, key === "violatesPetPeeve" ? { type: "noul", noul: 0.1 } : { type: "score", score: 3, confidence: 0.8, probabilities: { "0": 0, "1": 0, "2": 0, "3": 1, "4": 0 }, legend: { "0": "bad", "1": "weak", "2": "okay", "3": "good", "4": "best" } }]));
      return Response.json({ model: "jev-latest", answers });
    }
    throw new Error("No paid requests in this test");
  });
  const api = { handle: handleAPIRequest } as unknown as AccountManager;
  assert.equal((await request(api, "../personas")).status, 401);
  const aliceTx = await transaction(api);
  const aliceCallback = await request(api, `callback?state=${aliceTx.state}&code=code`, { cookie: aliceTx.cookie });
  const aliceStatus = await request(api, "status", { cookie: aliceCallback.cookie });
  const alice = { cookie: aliceCallback.cookie, csrf: aliceStatus.data.csrfToken };
  assert.equal((await request(api, "../personas", { cookie: alice.cookie, body: { ...basePersonas.cyberbotanist, id: "private-persona" } })).status, 403);
  assert.equal((await request(api, "../personas", { ...alice, body: { ...basePersonas.cyberbotanist, id: "private-persona" } })).status, 200);
  assert.equal((await request(api, "../moodboard/private-persona", { ...alice, method: "PUT", body: { notes: "Alice's private board" } })).status, 200);
  assert.equal((await request(api, "../rank", { ...alice, body: { assetId: "asset-one", personaId: "private-persona", score: 1, feedback: "private" } })).status, 200);
  const generation = await request(api, "../generate/private-persona", { ...alice, body: { imageProvider: "notorganic", dryRun: true, assetTypes: [{ kind: "image", purpose: "hero", description: "Hero" }] } });
  assert.equal(generation.status, 202);
  assert.equal((await request(api, "../generate/private-persona", { ...alice, body: { imageProvider: "openai", dryRun: true } })).status, 400);
  const planned = await request(api, "../generate/private-persona/plan", { ...alice, body: { qd: { iterations: 0, batchSize: 1 }, outputCount: 1, assetTypes: [{ kind: "image" }], maxCostMicrousd: 1200000 } });
  assert.equal(planned.data.minimumBudgetMicrousd, 1200000);
  assert.equal(planned.data.withinRequestedBudget, true);
  const blocked = await request(api, "../generate/private-persona", { ...alice, body: { qd: { iterations: 0, batchSize: 1 }, outputCount: 1, assetTypes: [{ kind: "image", purpose: "hero", description: "Hero" }], maxCostMicrousd: 1000000 } });
  assert.equal(blocked.status, 400); assert.match(blocked.data.error, /ceiling of \$1.20/);
  const lowWallet = await request(api, "../generate/private-persona", { ...alice, body: { qd: { iterations: 0, batchSize: 1 }, outputCount: 1, assetTypes: [{ kind: "image", purpose: "hero", description: "Hero" }], maxCostMicrousd: 1200000 } });
  assert.equal(lowWallet.status, 402); assert.match(lowWallet.data.error, /available Not Organic credit/);
  assert.equal(imageCalls, 0); assert.equal(judgementCalls, 0);
  walletCredit = 2000000;
  const paid = await request(api, "../generate/private-persona", { ...alice, body: { qd: { iterations: 0, batchSize: 1 }, outputCount: 1, assetTypes: [{ kind: "image", purpose: "hero", description: "Hero" }], maxCostMicrousd: 1200000 } });
  assert.equal(paid.status, 202);
  let finished: any;
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setImmediate(resolve));
    finished = await request(api, `../jobs/${paid.data.jobId}`, alice);
    if (finished.data.status !== "running") break;
  }
  assert.equal(finished.data.status, "completed"); assert.equal(imageCalls, 2); assert.equal(judgementCalls, 2);
  assert.equal(finished.data.result.images.length, 1);
  const generated = finished.data.result.images[0];
  assert.match(generated.url, /^\/api\/assets\/images\//); assert.ok(!generated.path.includes("/"));
  const generatedDownload = await request(api, `..${generated.url.slice(4)}`, alice);
  assert.equal(generatedDownload.status, 200); assert.equal(String(generatedDownload.body), "test image pixels");
  const image = Buffer.from("private image pixels");
  accountScope.run("did:plc:api-alice", () => {
    const dir = accountPath("assets/output/images", "assets/output/images");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "private.png"), image);
    symlinkSync(join(dir, "private.png"), join(dir, "owned-link.png"));
    symlinkSync(join(process.cwd(), "outside.png"), join(dir, "escape.png"));
  });
  writeFileSync(join(dir, "outside.png"), "not an account file");
  const downloaded = await request(api, "../assets/images/private.png", alice);
  assert.equal(downloaded.status, 200); assert.deepEqual(downloaded.body, image);
  assert.equal(downloaded.headers.get("cache-control"), "private, no-store");
  assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await request(api, "../assets/images/escape.png", alice)).status, 404);
  assert.equal((await request(api, "../assets/images/%2e%2e%2foutside.png", alice)).status, 404);
  assert.equal((await request(api, "../assets/svg/private.svg", alice)).status, 404);
  currentDid = "did:plc:api-bob";
  const bobTx = await transaction(api);
  const bobCallback = await request(api, `callback?state=${bobTx.state}&code=code`, { cookie: bobTx.cookie });
  const bob = { cookie: bobCallback.cookie };
  assert.equal((await request(api, "../personas/private-persona", bob)).status, 404);
  assert.equal((await request(api, "../moodboard/private-persona", bob)).data.notes, "");
  assert.equal((await request(api, "../rank/private-persona", bob)).data.total, 0);
  assert.equal((await request(api, "../feedback/private-persona", bob)).data.document, "");
  assert.equal((await request(api, `../jobs/${generation.data.jobId}`, bob)).status, 404);
  assert.deepEqual((await request(api, "../jobs", bob)).data, []);
  assert.equal((await request(api, "../assets/images/private.png", bob)).status, 404);
});

test("remote image fetch validates each redirect and rejects credentials and mapped private IPv6", async t => {
  const visited: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: any, init: RequestInit) => {
    visited.push(String(input)); assert.equal(init.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
  });
  await assert.rejects(() => safeFetch("https://8.8.8.8/image"), /private|loopback/);
  assert.deepEqual(visited, ["https://8.8.8.8/image"]);
  await assert.rejects(() => assertSafePublicUrl("https://user:secret@8.8.8.8/image"), /credentials/);
  await assert.rejects(() => assertSafePublicUrl("http://[::ffff:7f00:1]/"), /private|loopback/);
  await assert.rejects(() => assertSafePublicUrl("http://localhost./"), /local hostname/);
});

test("generation preflight reserves both image and review ceilings for every possible dispatch", () => {
  const plan = generationPlan({ qd: { iterations: 5, batchSize: 3 }, outputCount: 3 }, 2);
  assert.equal(plan.imageCalls, 24); assert.equal(plan.judgementCalls, 24);
  assert.equal(plan.minimumBudgetMicrousd, 14400000); assert.equal(plan.withinRequestedBudget, false);
  assert.throws(() => generationPlan({ qd: { iterations: -1, batchSize: 3 }, outputCount: 3 }, 2));
  assertJudgementCeiling(JSON.stringify({ state: { persona: "small" }, questions: [] }));
  assert.throws(() => assertJudgementCeiling("x".repeat(5000000)));
});
