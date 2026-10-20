import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { falRun, falBytesInput, falImageInput } from "../dist/src/assets/fal.js";
import { generationPlan, budgetedTransport, SEGMENT_REQUEST_MAX } from "../dist/src/notorganic/budget.js";
import { CliAccount, credentialPath, cliLogin } from "../dist/src/notorganic/cli.js";
import { createDpopKey } from "../dist/src/notorganic/dpop.js";
const jobId = `fal_${"a".repeat(43)}`;

test("hosted fal submits and polls through account transport without a fal key", async t => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("direct provider escape"); };
  t.after(() => { globalThis.fetch = original; });
  const calls: string[] = [];
  const result = await falRun("unused/custom/model", { prompt: "moss" }, {
    hostedModel: "image-edit", pollIntervalMs: 0,
    notOrganicFetch: async (path, init) => {
      calls.push(path);
      if (init?.method === "POST") { assert.deepEqual(JSON.parse(String(init.body)), { model: "image-edit", input: { prompt: "moss" } }); return Response.json({ job_id: jobId, status: "queued" }); }
      return Response.json({ status: "succeeded", result: { images: [{ url: "https://cdn.fal.media/result.png" }] } });
    },
  });
  assert.deepEqual(calls, ["/v1/fal/jobs", `/v1/fal/jobs/${jobId}`]);
  assert.equal(result.images[0].url, "https://cdn.fal.media/result.png");
  await assert.rejects(falRun("unused/model", {}, { hostedModel: "image-edit", notOrganicFetch: async () => new Response(null, { status: 402 }) }), /402/);
});

test("large hosted files stay inline and never use operator storage credentials", async t => {
  const dir = mkdtempSync(join(tmpdir(), "baste-inline-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const data = Buffer.alloc(1100000, 42); const path = join(dir, "image.png"); writeFileSync(path, data);
  const options = { notOrganicFetch: async () => { throw new Error("unexpected upload"); } };
  assert.match(await falImageInput(path, { ...options, upload: true }), /^data:image\/png;base64,/);
  assert.match(await falBytesInput(data, "image/png", options), /^data:image\/png;base64,/);
  await assert.rejects(falBytesInput(Buffer.alloc(9 * 1024 * 1024), "image/png", options), /8 MiB/);
});

test("media plans count worst-case cuts and edits; polls do not spend another reservation", async () => {
  const plan = generationPlan({ qd: { iterations: 2, batchSize: 3 }, outputCount: 2, edit: true, animate: "both" }, 2, 50000000);
  assert.equal(plan.videoCalls, 4); assert.equal(plan.editCalls, 12); assert.equal(plan.segmentCalls, 36);
  const caps: string[] = [];
  const fetcher = budgetedTransport(async (_path, init) => { caps.push(new Headers(init?.headers).get("x-notorganic-max-cost-microusd") ?? "poll"); return Response.json({}); }, SEGMENT_REQUEST_MAX);
  const submit = () => fetcher("/v1/fal/jobs", { method: "POST", body: JSON.stringify({ model: "image-segment" }) });
  await submit(); await fetcher(`/v1/fal/jobs/${jobId}`); await fetcher(`/v1/fal/jobs/${jobId}`);
  await assert.rejects(submit(), /spending limit/); assert.deepEqual(caps, [String(SEGMENT_REQUEST_MAX), "poll", "poll"]);
});

function credentials() {
  const key = createDpopKey();
  return { issuer: "https://api.notorganic.info", clientId: "http://localhost:3458", did: "did:plc:fictional", key: key.privateKey.export({ type: "pkcs8", format: "pem" }).toString(), publicJwk: key.publicJwk, token: { access_token: "fixture", token_type: "DPoP", expires_in: 300, refresh_token: "refresh" }, expires: Date.now() + 300000, refreshExpires: Date.now() + 86400000 };
}
test("CLI only checks out advertised offers and never treats return as payment proof", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const account = new CliAccount(credentials(), async (url, init) => {
    calls.push({ path: String(url), init });
    if (String(url).endsWith("/wallet")) return Response.json({ availableMicros: 5000000, checkout: { available: true, packIds: ["starter"], planIds: [] } });
    return Response.json({ url: "https://checkout.example/session" });
  });
  await assert.rejects(account.credits({ packId: "unknown" }, false), /advertised/);
  assert.equal(calls.length, 1);
  await account.credits({ packId: "starter" }, false);
  assert.equal(calls.length, 3);
  assert.ok(new Headers(calls[2].init?.headers).get("dpop"));
  assert.ok(new Headers(calls[2].init?.headers).get("idempotency-key"));
  assert.equal(JSON.parse(String(calls[2].init?.body)).pack_id, "starter");
});

test("CLI shares refresh, binds rotations to Baste and saves credentials privately", async t => {
  const dir = mkdtempSync(join(tmpdir(), "baste-cli-session-"));
  const prior = process.env.XDG_CONFIG_HOME; process.env.XDG_CONFIG_HOME = dir;
  t.after(() => { if (prior === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = prior; rmSync(dir, { recursive: true, force: true }); });
  const c = credentials(); c.expires = 0; let refreshes = 0;
  const access = `e30.${Buffer.from(JSON.stringify({ iss: c.issuer, sub: c.did, product: "baste" })).toString("base64url")}.signature`;
  const account = new CliAccount(c, async (url, init) => {
    if (String(url).endsWith("/device/token")) { refreshes++; assert.equal(JSON.parse(String(init?.body)).grant_type, "refresh_token"); return Response.json({ access_token: access, token_type: "DPoP", expires_in: 300, refresh_token: "rotated", refresh_expires_in: 3600 }); }
    return Response.json({});
  });
  await Promise.all([account.fetch("/v1/wallet"), account.fetch("/v1/models")]);
  assert.equal(refreshes, 1); assert.equal(statSync(credentialPath()).mode & 0o777, 0o600);
  assert.equal(JSON.parse(readFileSync(credentialPath(), "utf8")).token.refresh_token, "rotated");
  const bad = credentials(); bad.expires = 0;
  await assert.rejects(new CliAccount(bad, async () => Response.json({ access_token: `e30.${Buffer.from(JSON.stringify({ iss: bad.issuer, sub: bad.did, product: "other" })).toString("base64url")}.sig`, token_type: "DPoP", expires_in: 300 })).fetch("/v1/wallet"), /approved for Baste/);
});


test("CLI login verifies callback state and issuer account before persisting device authority", async t => {
  const dir = mkdtempSync(join(tmpdir(), "baste-cli-login-"));
  const previousConfig = process.env.XDG_CONFIG_HOME; process.env.XDG_CONFIG_HOME = dir;
  const originalFetch = globalThis.fetch; const originalLog = console.log;
  t.after(() => { globalThis.fetch = originalFetch; console.log = originalLog; if (previousConfig === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previousConfig; rmSync(dir, { recursive: true, force: true }); });
  let ready: (url: string) => void = () => {};
  const authorization = new Promise<string>(resolve => { ready = resolve; });
  console.log = (value: unknown) => { if (typeof value === "string" && value.startsWith("https://id.notorganic.info/authorize")) ready(value); };
  const access = `e30.${Buffer.from(JSON.stringify({ iss: "https://api.notorganic.info", sub: "did:plc:fictional", product: "baste" })).toString("base64url")}.signature`;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/public/token")) { const body = JSON.parse(String(init?.body)); assert.equal(body.client_id, "http://localhost:3458"); assert.equal(body.device_session, true); assert.ok(body.dpop_jwk); return Response.json({ access_token: access, token_type: "DPoP", expires_in: 300, refresh_token: "refresh", refresh_expires_in: 3600 }); }
    assert.equal(String(url), "https://api.notorganic.info/v1/account");
    return Response.json({ account: { did: "did:plc:fictional" } });
  };
  const login = cliLogin(false);
  const url = new URL(await authorization);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("scope")?.includes("videos:generate"));
  const wrong = await originalFetch("http://127.0.0.1:3458/callback?code=code&state=wrong"); assert.equal(wrong.status, 400);
  const callback = await originalFetch(`http://127.0.0.1:3458/callback?code=code&state=${url.searchParams.get("state")}`); assert.equal(callback.status, 200);
  await login;
  assert.equal(JSON.parse(readFileSync(credentialPath(), "utf8")).did, "did:plc:fictional");
  assert.equal(statSync(credentialPath()).mode & 0o777, 0o600);
});
