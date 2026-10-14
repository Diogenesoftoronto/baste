import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleAPIRequest } from "../dist/src/gui/api.js";
import type { ProjectDetail, ProjectSummary } from "../src/projects/contracts.ts";

const ORIGIN = "http://localhost:5173";
const ISSUER = "http://127.0.0.1:9998";
const ALICE = "did:plc:projects-alice";
const BOB = "did:plc:projects-bob";

interface Session {
  cookie: string;
  csrf: string;
}

interface RequestOptions {
  body?: unknown;
  cookie?: string;
  csrf?: string;
  method?: string;
  origin?: string;
}

async function request(path: string, options: RequestOptions = {}) {
  const req = Readable.from(options.body === undefined ? [] : [JSON.stringify(options.body)]) as any;
  req.url = path;
  req.method = options.method ?? (options.body === undefined ? "GET" : "POST");
  req.headers = {
    origin: options.origin ?? ORIGIN,
    ...(options.cookie ? { cookie: options.cookie } : {}),
    ...(options.csrf ? { "x-baste-csrf": options.csrf } : {}),
  };
  const headers = new Map<string, any>();
  let status = 0;
  let body = "";
  const res = {
    setHeader(key: string, value: unknown) { headers.set(key.toLowerCase(), value); },
    writeHead(value: number, extra: Record<string, unknown> = {}) {
      status = value;
      for (const [key, header] of Object.entries(extra)) headers.set(key.toLowerCase(), header);
    },
    end(value = "") { body = value; },
  } as any;
  assert.equal(await handleAPIRequest(req, res), true, `${req.method} ${path} must be handled by the API`);
  return {
    status,
    headers,
    data: body && headers.get("content-type")?.includes("application/json") ? JSON.parse(body) : null,
    cookie: headers.get("set-cookie")?.split(";")[0] as string | undefined,
  };
}

function setup(t: TestContext) {
  for (const [key, value] of Object.entries({
    NOTORGANIC_ENABLED: "true",
    BASTE_PUBLIC_ORIGIN: ORIGIN,
    NOTORGANIC_ISSUER: ISSUER,
    NOTORGANIC_AUTHORIZATION_URL: "http://127.0.0.1:9998/authorize",
    BASTE_CONSENT_PREVIEW: "true",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const before = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "baste-project-api-"));
  process.chdir(directory);
  t.after(() => { process.chdir(before); rmSync(directory, { recursive: true, force: true }); });

  let currentDid = ALICE;
  const upstreamCalls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: any) => {
    const url = String(input);
    upstreamCalls.push(url);
    if (url === `${ISSUER}/v1/public/token`) {
      return Response.json({
        token_type: "DPoP",
        expires_in: 300,
        access_token: `header.${Buffer.from(JSON.stringify({ sub: currentDid, product: "baste", iss: ISSUER })).toString("base64url")}.signature`,
        refresh_token: "test-server-held-refresh",
        refresh_expires_in: 3600,
      });
    }
    if (url === `${ISSUER}/v1/account`) return Response.json({ account: { did: currentDid } });
    throw new Error(`Project commands must not call a provider: ${url}`);
  });
  t.after(() => {
    assert.ok(upstreamCalls.every(url => ["/v1/public/token", "/v1/account"].some(path => url === `${ISSUER}${path}`)), "Project storage must not dispatch paid or other provider requests");
  });

  return async function login(did = ALICE): Promise<Session> {
    currentDid = did;
    const initial = await request("/api/notorganic/status");
    assert.equal(initial.status, 200);
    assert.ok(initial.cookie);
    const started = await request("/api/notorganic/login", {
      cookie: initial.cookie,
      csrf: initial.data.csrfToken,
      body: {},
    });
    assert.equal(started.status, 200);
    const state = new URL(started.data.url).searchParams.get("state");
    assert.ok(state);
    const callback = await request(`/api/notorganic/callback?state=${encodeURIComponent(state)}&code=fixture-code`, { cookie: initial.cookie });
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/gui/?flow=settings&lang=en&account=onboarding");
    assert.ok(callback.cookie);
    const connected = await request("/api/notorganic/status", { cookie: callback.cookie });
    assert.equal(connected.data.profile.did, did);
    await request("/api/notorganic/consent/policy", { cookie: callback.cookie });
    const policy = connected.data.consent;
    const accepted = await request("/api/notorganic/consent", { cookie: callback.cookie, csrf: connected.data.csrfToken, body: {
      version: policy.version, contentSha256: policy.contentSha256, locale: "en", contractLanguage: "fr", frenchProvided: true,
      age14OrOlder: true, termsAccepted: true, necessaryProcessingAccepted: true,
    } });
    assert.equal(accepted.status, 200);
    return { cookie: callback.cookie, csrf: connected.data.csrfToken };
  };
}

async function create(session: Session, commandId = "create-project") {
  const response = await request("/api/projects", {
    ...session,
    body: { commandId, name: "Field Notes", brief: "A calm place to plan local walks." },
  });
  assert.equal(response.status, 201);
  assert.ok(response.data.project.id);
  return response.data as ProjectDetail;
}

test("project HTTP routes require a session and same-origin CSRF for writes", async t => {
  const login = setup(t);
  assert.equal((await request("/api/projects")).status, 401);
  assert.equal((await request("/api/projects/missing")).status, 401);
  assert.equal((await request("/api/projects", { body: { commandId: "anonymous", name: "Private", brief: "" } })).status, 401);
  assert.equal((await request("/api/projects/missing/commands", { body: { commandId: "anonymous-edit", baseRevision: 1, kind: "update_details", name: "Private", brief: "" } })).status, 401);

  const alice = await login();
  assert.equal((await request("/api/projects", { cookie: alice.cookie, body: { commandId: "no-csrf", name: "Private", brief: "" } })).status, 403);
  assert.equal((await request("/api/projects", { ...alice, origin: "https://foreign.example", body: { commandId: "foreign", name: "Private", brief: "" } })).status, 403);
  assert.deepEqual((await request("/api/projects", alice)).data, []);

  const detail = await create(alice);
  const path = `/api/projects/${detail.project.id}`;
  assert.equal((await request(`${path}/commands`, { cookie: alice.cookie, body: { commandId: "no-csrf-edit", baseRevision: detail.project.revision, kind: "update_details", name: "Unauthorized", brief: "" } })).status, 403);
  const unchanged = await request(path, alice);
  assert.equal(unchanged.status, 200);
  assert.deepEqual(unchanged.data, detail);
});

test("project ownership follows the authenticated DID and rejects client identity fields", async t => {
  const login = setup(t);
  const alice = await login(ALICE);
  const bob = await login(BOB);
  const aliceDetail = await create(alice, "alice-create");
  const bobDetail = await create(bob, "bob-create");

  const aliceList = await request(`/api/projects?did=${encodeURIComponent(BOB)}&ownerDid=${encodeURIComponent(BOB)}`, alice);
  assert.equal(aliceList.status, 200);
  assert.deepEqual((aliceList.data as ProjectSummary[]).map(project => project.id), [aliceDetail.project.id]);
  const bobList = await request(`/api/projects?did=${encodeURIComponent(ALICE)}`, bob);
  assert.equal(bobList.status, 200);
  assert.deepEqual((bobList.data as ProjectSummary[]).map(project => project.id), [bobDetail.project.id]);
  assert.equal((await request(`/api/projects/${aliceDetail.project.id}?did=${encodeURIComponent(ALICE)}`, bob)).status, 404);
  assert.equal((await request(`/api/projects/${bobDetail.project.id}`, alice)).status, 404);

  const foreignWrite = await request(`/api/projects/${aliceDetail.project.id}/commands`, {
    ...bob,
    body: { commandId: "foreign-edit", baseRevision: aliceDetail.project.revision, kind: "update_details", name: "Stolen", brief: "" },
  });
  assert.equal(foreignWrite.status, 404);
  const spoofedWrite = await request(`/api/projects/${aliceDetail.project.id}/commands`, {
    ...bob,
    body: { commandId: "spoof-owner", baseRevision: aliceDetail.project.revision, kind: "update_details", name: "Stolen", brief: "", did: ALICE, ownerDid: ALICE },
  });
  assert.equal(spoofedWrite.status, 400);
  assert.equal((await request("/api/projects", {
    ...bob,
    body: { commandId: "spoof-create", name: "Impersonated", brief: "", did: ALICE, ownerDid: ALICE },
  })).status, 400);
  assert.deepEqual((await request("/api/projects", bob)).data.map((project: ProjectSummary) => project.id), [bobDetail.project.id]);
  assert.deepEqual((await request(`/api/projects/${aliceDetail.project.id}`, alice)).data, aliceDetail);
});

test("project HTTP creation replays safely and commands expose stale revisions and restore", async t => {
  const login = setup(t);
  const alice = await login();
  const original = await create(alice, "retryable-create");
  const replay = await create(alice, "retryable-create");
  assert.deepEqual(replay, original);
  assert.equal((await request("/api/projects", alice)).data.length, 1);
  const path = `/api/projects/${original.project.id}`;
  const updated = await request(`${path}/commands`, {
    ...alice,
    body: { commandId: "edit-details", baseRevision: original.project.revision, kind: "update_details", name: "Evening Walks", brief: "Discover routes after work." },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.project.name, "Evening Walks");
  assert.ok(updated.data.project.revision > original.project.revision);

  const stale = await request(`${path}/commands`, {
    ...alice,
    body: { commandId: "stale-edit", baseRevision: original.project.revision, kind: "update_details", name: "Outdated tab", brief: "" },
  });
  assert.equal(stale.status, 409);
  assert.deepEqual((await request(path, alice)).data, updated.data);

  const selected = await request(`${path}/commands`, {
    ...alice,
    body: { commandId: "select-audience", baseRevision: updated.data.project.revision, kind: "select_audience", personaId: "cyberbotanist" },
  });
  assert.equal(selected.status, 200);
  assert.equal(selected.data.project.audience.id, "cyberbotanist");

  const restored = await request(`${path}/commands`, {
    ...alice,
    body: { commandId: "restore-original", baseRevision: selected.data.project.revision, kind: "restore_revision", targetRevision: original.project.revision },
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.project.name, original.project.name);
  assert.equal(restored.data.project.brief, original.project.brief);
  assert.equal(restored.data.project.audience, null);
  assert.ok(restored.data.project.revision > selected.data.project.revision);
  assert.ok(restored.data.revisions.some((revision: { kind: string; restoredFrom?: number }) => revision.kind === "revision_restored" && revision.restoredFrom === original.project.revision));
  assert.deepEqual((await request(path, alice)).data, restored.data);
});

test("project HTTP routes reject invalid envelopes without mutating saved projects", async t => {
  const login = setup(t);
  const alice = await login();
  for (const body of [
    {},
    { commandId: "empty-name", name: " ", brief: "" },
    { commandId: "long-name", name: "x".repeat(121), brief: "" },
    { commandId: "wrong-brief", name: "Field Notes", brief: 42 },
    { commandId: "long-brief", name: "Field Notes", brief: "x".repeat(12001) },
  ]) {
    assert.equal((await request("/api/projects", { ...alice, body })).status, 400);
  }
  assert.deepEqual((await request("/api/projects", alice)).data, []);
  const original = await create(alice);
  const path = `/api/projects/${original.project.id}`;
  for (const body of [
    {},
    { commandId: "unknown-command", baseRevision: original.project.revision, kind: "publish" },
    { commandId: "wrong-revision", baseRevision: "1", kind: "update_details", name: "Changed", brief: "" },
    { commandId: "wrong-audience", baseRevision: original.project.revision, kind: "select_audience", personaId: 5 },
    { commandId: "wrong-target", baseRevision: original.project.revision, kind: "restore_revision", targetRevision: -1 },
  ]) {
    assert.equal((await request(`${path}/commands`, { ...alice, body })).status, 400);
  }
  assert.deepEqual((await request(path, alice)).data, original);
});
