import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { ImageGenerator, VideoGenerator } from "../dist/src/assets/generators.js";
import { defaultConfig, toBasteConfig, resolveEvaluatorProvider } from "../dist/src/config/baste-config.js";
import { evaluateWithTypeSafe, scoreQuestions } from "../dist/src/evaluation/typesafe-judge.js";
import { createScorer, evaluateBatch } from "../dist/src/evaluation/judge.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import { generateAssetSuite } from "../dist/src/baste.js";
import { runQD, defaultAssetFeatures } from "../dist/src/generation/qd.js";
import { handleAPIRequest } from "../dist/src/gui/api.js";

const persona = basePersonas.cyberbotanist;
const image = { kind: "image" as const, purpose: "hero", description: "Ambient hero" };
const video = { kind: "video" as const, purpose: "ambient-loop", description: "Bioluminescent forest" };
const prompt = { prompt: "Cool blue organic ambient forest", systemContext: "Persona art", parameters: {} };
const keyNames = ["OPENAI_API_KEY", "GOOGLE_API_KEY", "ARK_API_KEY", "TYPESAFE_API_KEY", "QUIVER_API_KEY"];

function environment(t: TestContext, values: Record<string, string> = {}) {
  const before = Object.fromEntries(keyNames.map(key => [key, process.env[key]]));
  for (const key of keyNames) delete process.env[key];
  Object.assign(process.env, values);
  t.after(() => {
    for (const key of keyNames) {
      if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    }
  });
}

function output(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "baste-providers-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function mockFetch(t: TestContext, replies: Array<Response | (() => Response)>) {
  const calls: Array<{ url: string; init?: RequestInit; body?: any }> = [];
  const before = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies.shift();
    assert.ok(reply, `Unexpected fetch: ${input}`);
    return typeof reply === "function" ? reply() : reply;
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = before; });
  return calls;
}

function json(value: unknown, status = 200) { return Response.json(value, { status }); }
function imageReply() { return json({ data: [{ b64_json: Buffer.from("mock PNG").toString("base64") }] }); }

// Fixtures follow https://docs.typesafe.ai/api.md: Score is on level indices,
// not 0–1; Noul carries a probability and has no separate confidence.
function judgeReply(noul = 0.1, levels = [4, 3, 2, 1, 4]) {
  const answers: Record<string, any> = {};
  Object.entries(scoreQuestions).forEach(([id, question], i) => {
    const score = levels[i];
    const low = Math.floor(score);
    const high = Math.ceil(score);
    answers[id] = {
      type: "score", score, confidence: 0.8,
      legend: Object.fromEntries(question.criteria.map((description, index) => [String(index), description])),
      probabilities: Object.fromEntries(question.criteria.map((_, index) => [String(index), low === high ? Number(index === low) : index === low ? high - score : index === high ? score - low : 0])),
    };
  });
  answers.violatesPetPeeve = { type: "noul", noul };
  return { model: "jev-1.13.0", answers, usage: { input_tokens: 500, output_tokens: 50 } };
}

test("GPT Image 2.5 is the default, uses GPT Image parameters and writes base64 output", async t => {
  environment(t);
  const dir = output(t);
  const calls = mockFetch(t, [imageReply()]);
  const config = toBasteConfig({ outputDir: dir });
  assert.equal(defaultConfig.generators.image?.model, "gpt-image-2.5");
  assert.equal(config.generation.imageModel, "gpt-image-2.5");
  const result = await new ImageGenerator({ ...config.generation, openaiApiKey: "mock-openai" }).generate(persona, image, prompt);
  assert.equal(calls[0].url, "https://api.openai.com/v1/images/generations");
  assert.deepEqual(calls[0].body, { model: "gpt-image-2.5", prompt: prompt.prompt, size: "1024x1024", quality: "high", n: 1 });
  assert.equal(result.metadata.model, "gpt-image-2.5");
  assert.equal(readFileSync(result.content, "utf8"), "mock PNG");
});

test("GPT Image 2 remains selectable and maps standard quality to medium", async t => {
  environment(t);
  const calls = mockFetch(t, [imageReply()]);
  await new ImageGenerator({ outputDir: output(t), openaiApiKey: "mock", imageModel: "gpt-image-2", imageQuality: "standard" }).generate(persona, image, prompt);
  assert.equal(calls[0].body.model, "gpt-image-2");
  assert.equal(calls[0].body.quality, "medium");
  assert.equal(calls[0].body.style, undefined);
});

test("DALL-E 3 remains selectable and retains its quality/style parameters", async t => {
  environment(t);
  const calls = mockFetch(t, [imageReply()]);
  const config = toBasteConfig({ generators: { image: { provider: "openai", model: "dall-e-3", apiKey: "mock", quality: "standard", style: "natural" } }, outputDir: output(t) });
  await new ImageGenerator(config.generation).generate(persona, image, prompt);
  assert.equal(calls[0].body.model, "dall-e-3");
  assert.equal(calls[0].body.quality, "standard");
  assert.equal(calls[0].body.style, "natural");
});

test("Seedance defaults to BytePlus create → queued/running polls → signed MP4 download", async t => {
  environment(t, { ARK_API_KEY: "mock-ark" });
  const dir = output(t);
  const calls = mockFetch(t, [json({ id: "cgt-mock" }), json({ status: "queued" }), json({ status: "running" }), json({ status: "succeeded", content: { video_url: "https://storage.example.test/mock.mp4" } }), new Response("mock MP4")]);
  const config = toBasteConfig({ outputDir: dir });
  assert.equal(config.generation.videoProvider, "seedance");
  assert.equal(config.generation.videoApiKey, "mock-ark");
  const result = await new VideoGenerator({ ...config.generation, videoPollIntervalMs: 0 }).generate(persona, video, prompt);
  assert.equal(calls.length, 5);
  assert.equal(calls[0].url, "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(calls[0].body, { model: "seedance-1-0-pro-250528", content: [{ type: "text", text: `${prompt.prompt}\nMotion: Slow, smooth movement with gentle continuous pacing. Seamless ambient loop; no text.` }], duration: 5, ratio: "16:9", resolution: "1080p" });
  for (const call of calls.slice(0, 4)) assert.equal((call.init?.headers as any).Authorization, "Bearer mock-ark");
  assert.ok(calls.slice(1, 4).every(call => call.url.endsWith("/cgt-mock")));
  assert.equal(calls[4].init?.headers, undefined);
  assert.equal(result.content, join(dir, "videos", `${result.id}.mp4`));
  assert.equal(readFileSync(result.content, "utf8"), "mock MP4");
  assert.equal(result.metadata.service, "byteplus");
});

test("Seedance respects configured endpoint/model and prompt duration/ratio", async t => {
  environment(t);
  const calls = mockFetch(t, [json({ id: "task/one" }), json({ status: "succeeded", content: { video_url: "https://storage.test/video.mp4" } }), new Response("MP4")]);
  await new VideoGenerator({ outputDir: output(t), videoApiKey: "mock", videoBaseUrl: "https://ark.test/api/v3/", videoModel: "seedance-1-0-pro-250528", videoPollIntervalMs: 0 }).generate({ ...persona, aesthetic: { ...persona.aesthetic, motionStyle: "snappy" } }, video, { ...prompt, parameters: { duration: 10, aspectRatio: "9:16", quality: "720p" } });
  assert.equal(calls[0].body.duration, 10);
  assert.equal(calls[0].body.ratio, "9:16");
  assert.equal(calls[0].body.resolution, "720p");
  assert.match(calls[0].body.content[0].text, /Crisp, brief motion accents/);
  assert.equal(calls[1].url, "https://ark.test/api/v3/contents/generations/tasks/task%2Fone");
});

for (const status of ["failed", "cancelled", "expired"]) {
  test(`Seedance ${status} is terminal and never downloads`, async t => {
    environment(t);
    const dir = output(t);
    const calls = mockFetch(t, [json({ id: "task" }), json({ status, error: { code: "TaskError", message: "provider detail" } })]);
    await assert.rejects(new VideoGenerator({ outputDir: dir, videoApiKey: "mock" }).generate(persona, video, prompt), new RegExp(`Seedance task ${status}`));
    assert.equal(calls.length, 2);
    assert.deepEqual(readdirSync(join(dir, "videos")), []);
  });
}

for (const [label, replies, error] of [
  ["create HTTP error", [json({}, 401)], /create task API error 401/],
  ["missing task ID", [json({})], /no task ID/],
  ["poll HTTP error", [json({ id: "task" }), json({}, 503)], /poll task API error 503/],
  ["unknown status", [json({ id: "task" }), json({ status: "unrecognized" })], /unknown task status/],
  ["missing video URL", [json({ id: "task" }), json({ status: "succeeded" })], /without a video URL/],
  ["download HTTP error", [json({ id: "task" }), json({ status: "succeeded", content: { video_url: "https://storage.test/video.mp4" } }), json({}, 404)], /download failed: 404/],
] as const) {
  test(`Seedance handles ${label}`, async t => {
    environment(t);
    mockFetch(t, [...replies]);
    const dir = output(t);
    await assert.rejects(new VideoGenerator({ outputDir: dir, videoApiKey: "mock" }).generate(persona, video, prompt), error);
    assert.deepEqual(readdirSync(join(dir, "videos")), []);
  });
}

test("Seedance polling has a bounded timeout", async t => {
  environment(t);
  mockFetch(t, [json({ id: "task" }), json({ status: "queued" })]);
  await assert.rejects(new VideoGenerator({ outputDir: output(t), videoApiKey: "mock", videoPollIntervalMs: 50, videoTimeoutMs: 10 }).generate(persona, video, prompt), /timed out/);
});

test("Missing keys fail clearly before fetch, including Seedance GUI-facing suite errors", async t => {
  environment(t);
  const calls = mockFetch(t, []);
  const config = toBasteConfig({ outputDir: output(t) });
  await assert.rejects(new ImageGenerator(config.generation).generate(persona, image, prompt), /OPENAI_API_KEY/);
  await assert.rejects(new VideoGenerator(config.generation).generate(persona, video, prompt), /Seedance needs ARK_API_KEY/);
  await assert.rejects(generateAssetSuite(persona, [video], config), /Seedance needs ARK_API_KEY/);
  await assert.rejects(evaluateWithTypeSafe(persona, { assetType: "image", prompt: "test" }), /TYPESAFE_API_KEY/);
  assert.equal(calls.length, 0);
});

test("Invalid Seedance parameters and unimplemented providers fail before fetch", async t => {
  environment(t);
  const calls = mockFetch(t, []);
  const config = { outputDir: output(t), videoApiKey: "mock" };
  await assert.rejects(new VideoGenerator(config).generate(persona, video, { ...prompt, parameters: { duration: 20 } }), /duration/);
  await assert.rejects(new VideoGenerator(config).generate(persona, video, { ...prompt, parameters: { aspectRatio: "2:7" } }), /ratio/);
  for (const provider of ["local", "runway"] as const) await assert.rejects(new VideoGenerator({ ...config, videoProvider: provider }).generate(persona, video, prompt), /not implemented/);
  assert.equal(calls.length, 0);
});

test("Provider auto-selection follows current env and explicit evaluator choice", t => {
  environment(t);
  const before = JSON.stringify(defaultConfig);
  assert.equal(resolveEvaluatorProvider(), "openai");
  assert.equal(toBasteConfig({}).evaluator.model, "gpt-4o");
  process.env.OPENAI_API_KEY = "mock-openai";
  process.env.GOOGLE_API_KEY = "mock-google";
  process.env.ARK_API_KEY = "mock-ark";
  process.env.TYPESAFE_API_KEY = "mock-typesafe";
  assert.equal(resolveEvaluatorProvider(), "typesafe");
  const config = toBasteConfig({});
  assert.equal(config.evaluator.provider, "typesafe");
  assert.equal(config.evaluator.model, "jev-latest");
  assert.equal(config.evaluator.apiKey, "mock-typesafe");
  assert.equal(config.generation.openaiApiKey, "mock-openai");
  assert.equal(config.generation.videoApiKey, "mock-ark");
  const explicit = toBasteConfig({ evaluator: { provider: "openai", model: "gpt-4o" } });
  assert.equal(explicit.evaluator.provider, "openai");
  assert.equal(explicit.evaluator.apiKey, "mock-openai");
  delete process.env.TYPESAFE_API_KEY;
  assert.equal(toBasteConfig({}).evaluator.provider, "openai");
  assert.equal(toBasteConfig({ evaluator: { provider: "typesafe", model: "jev-latest", apiKey: "custom" } }).evaluator.apiKey, "custom");
  assert.equal(JSON.stringify(defaultConfig), before);
});

test("GUI-style video overrides choose the right model and key without crossing provider credentials", t => {
  environment(t, { ARK_API_KEY: "mock-ark", GOOGLE_API_KEY: "mock-google" });
  const user = { generators: { video: { provider: "seedance" as const, apiKey: "custom-ark", model: "custom-model", baseUrl: "https://custom.test/v3" } } };
  const original = JSON.stringify(user);
  const defaultChoice = toBasteConfig(user).generation;
  assert.equal(defaultChoice.videoApiKey, "custom-ark");
  assert.equal(defaultChoice.videoBaseUrl, "https://custom.test/v3");
  const veo = toBasteConfig(user, { videoProvider: "veo" }).generation;
  assert.equal(veo.videoProvider, "veo");
  assert.equal(veo.videoApiKey, "mock-google");
  assert.equal(veo.videoModel, undefined);
  assert.equal(veo.videoBaseUrl, undefined);
  const seedance = toBasteConfig({ generators: { video: { provider: "veo", apiKey: "custom-google", model: "veo-3" } } }, { videoProvider: "seedance" }).generation;
  assert.equal(seedance.videoApiKey, "mock-ark");
  assert.equal(seedance.videoModel, undefined);
  assert.equal(JSON.stringify(user), original);
  assert.throws(() => toBasteConfig({}, { videoProvider: "made-up" }), /Unsupported video provider/);
});

test("TypeSafe batches five independent Scores and one Noul over named persona/candidate/suite JSON", async t => {
  environment(t, { TYPESAFE_API_KEY: "mock-typesafe" });
  const dir = output(t);
  const source = '<svg viewBox="0 0 24 24"><path d="M0 0L24 24"/></svg>';
  const file = join(dir, "icon.svg");
  writeFileSync(file, source);
  const calls = mockFetch(t, [json(judgeReply())]);
  const suite = [{ type: "image", purpose: "hero", prompt: "Cool organic textures" }];
  const result = await evaluateWithTypeSafe(persona, { assetType: "svg", prompt: "Organic icon", content: file, purpose: "icon", metadata: { model: "quiver-1", size: "24x24" }, suite });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.typesafe.ai/v1/systemone");
  assert.equal((calls[0].init?.headers as any).Authorization, "Bearer mock-typesafe");
  const body = calls[0].body;
  assert.equal(body.model, "jev-latest");
  assert.deepEqual(body.state.persona.influences, persona.influences);
  assert.deepEqual(body.state.persona.aesthetic, persona.aesthetic);
  assert.deepEqual(body.state.persona.behaviors.petPeeves, persona.behaviors.petPeeves);
  assert.equal(body.state.candidate.source, source);
  assert.equal(body.state.candidate.purpose, "icon");
  assert.equal(body.state.candidate.metadata.size, "24x24");
  assert.deepEqual(body.state.suite, suite);
  assert.equal(Object.keys(body.questions).length, 6);
  for (const dimension of Object.keys(scoreQuestions)) {
    assert.equal(body.questions[dimension].type, "score");
    assert.equal(body.questions[dimension].criteria.length, 5);
    assert.ok(body.questions[dimension].criteria.every((level: string) => level.length > 40));
  }
  assert.equal(body.questions.violatesPetPeeve.type, "noul");
  assert.deepEqual(result.criteria, { personaAlignment: 1, visualQuality: 0.75, uniqueness: 0.5, coherence: 0.25, usability: 1 });
  assert.ok(Math.abs(result.overall - 0.7375) < 1e-12);
  assert.equal(result.typesafe?.scores.personaAlignment.score, 4);
  assert.equal(result.typesafe?.scores.visualQuality.confidence, 0.8);
  assert.equal(result.typesafe?.model, "jev-1.13.0");
  assert.equal(result.typesafe?.evidence, "text-only");
  assert.deepEqual(result.typesafe?.petPeeve, { type: "noul", noul: 0.1 });
  assert.equal(result.gate?.accepted, true);
});

test("Fractional TypeSafe scores normalize before custom-weight composition; confidence remains separate", async t => {
  environment(t);
  mockFetch(t, [json(judgeReply(0.1, [3.5, 2, 1, 4, 0]))]);
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "blue minimalist abstract", features: [-1, 0.2, 0.9] }, { apiKey: "mock", weights: { personaAlignment: 1, visualQuality: 0, uniqueness: 0, coherence: 0, usability: 0 } });
  assert.equal(result.overall, 0.875);
  assert.deepEqual(result.features, [-1, 0.2, 0.9]);
  assert.equal(result.typesafe?.scores.personaAlignment.score, 3.5);
  assert.equal(result.typesafe?.scores.personaAlignment.confidence, 0.8);
  assert.equal(result.typesafe?.composite, 0.875);
});

test("Pet-peeve gate rejects at policy threshold despite perfect scores and cannot enter QD at threshold zero", async t => {
  environment(t);
  mockFetch(t, [json(judgeReply(0.5, [4, 4, 4, 4, 4]))]);
  const result = await evaluateWithTypeSafe(persona, { assetType: "video", prompt: "forest loop" }, { apiKey: "mock" });
  assert.equal(result.overall, 0);
  assert.equal(result.typesafe?.composite, 1);
  assert.equal(result.criteria.visualQuality, 1);
  assert.equal(result.gate?.accepted, false);
  assert.equal(createScorer()(result), -Infinity);
  const archive = await runQD({ features: defaultAssetFeatures, iterations: 0, batchSize: 1, mutationRate: 0.4, qualityThreshold: 0 }, async () => ({ genome: "prompt", features: [0, 0, 0], quality: 0, generation: 0 }), async parent => parent, async () => ({ quality: createScorer()(result), features: result.features }));
  assert.equal(archive.cells.size, 0);
});

test("evaluateBatch selects TypeSafe by env and keeps the existing OpenAI callback interface", async t => {
  environment(t, { TYPESAFE_API_KEY: "mock" });
  const calls = mockFetch(t, [json(judgeReply())]);
  let callbackCalls = 0;
  const callback = async () => {
    callbackCalls++;
    return JSON.stringify({ overall: 0.8, criteria: { personaAlignment: 0.8, visualQuality: 0.8, uniqueness: 0.8, coherence: 0.8, usability: 0.8 }, features: [0, 0.5, 0.5] });
  };
  const assets = [{ type: "image" as const, prompt: "cool forest", metadata: { assetPurpose: "hero" } }];
  const [typesafe] = await evaluateBatch(persona, assets, callback);
  assert.ok(typesafe.typesafe);
  assert.equal(callbackCalls, 0);
  const [openai] = await evaluateBatch(persona, assets, callback, { provider: "openai" });
  assert.equal(openai.overall, 0.8);
  assert.equal(callbackCalls, 1);
  delete process.env.TYPESAFE_API_KEY;
  await evaluateBatch(persona, assets, callback);
  assert.equal(callbackCalls, 2);
  assert.equal(calls.length, 1);
});

test("TypeSafe service failures propagate through evaluateBatch without heuristic acceptance", async t => {
  environment(t, { TYPESAFE_API_KEY: "mock" });
  mockFetch(t, [json({ error: "private upstream body" }, 401)]);
  await assert.rejects(evaluateBatch(persona, [{ type: "image", prompt: "forest" }], async () => "unexpected"), /^Error: TypeSafe judge API error 401$/);
});

for (const [label, mutate] of [
  ["missing dimension", (r: any) => delete r.answers.usability],
  ["invalid score", (r: any) => r.answers.personaAlignment.score = 5],
  ["missing confidence", (r: any) => delete r.answers.visualQuality.confidence],
  ["wrong answer type", (r: any) => r.answers.coherence.type = "noul"],
  ["missing Noul", (r: any) => delete r.answers.violatesPetPeeve],
  ["invalid Noul", (r: any) => r.answers.violatesPetPeeve.noul = -1],
  ["invalid distribution", (r: any) => r.answers.uniqueness.probabilities["0"] = 1],
  ["missing model", (r: any) => delete r.model],
] as const) {
  test(`TypeSafe rejects ${label}`, async t => {
    environment(t);
    const reply = judgeReply();
    mutate(reply);
    mockFetch(t, [json(reply)]);
    await assert.rejects(evaluateWithTypeSafe(persona, { assetType: "image", prompt: "forest" }, { apiKey: "mock" }), /TypeSafe returned/);
  });
}

test("Video-only suites generate with Seedance and preserve raw Jev results on accepted final assets", async t => {
  environment(t, { ARK_API_KEY: "mock-ark", TYPESAFE_API_KEY: "mock-typesafe" });
  const calls = mockFetch(t, [json({ id: "task" }), json({ status: "succeeded", content: { video_url: "https://storage.test/video.mp4" } }), new Response("MP4"), json(judgeReply())]);
  const suite = await generateAssetSuite(persona, [video], toBasteConfig({ outputDir: output(t) }));
  assert.equal(suite.assets.videos.length, 1);
  assert.equal(suite.evaluations.length, 1);
  assert.equal(suite.evaluations[0].gate?.accepted, true);
  assert.equal(suite.evaluations[0].typesafe?.scores.usability.score, 4);
  assert.match(calls[0].body.content[0].text, /Bioluminescent forest/);
});

test("Final assets rejected by Jev stay out of the exported suite", async t => {
  environment(t, { ARK_API_KEY: "mock-ark", TYPESAFE_API_KEY: "mock-typesafe" });
  mockFetch(t, [json({ id: "task" }), json({ status: "succeeded", content: { video_url: "https://storage.test/video.mp4" } }), new Response("MP4"), json(judgeReply(0.95, [4, 4, 4, 4, 4]))]);
  const suite = await generateAssetSuite(persona, [video], toBasteConfig({ outputDir: output(t) }));
  assert.equal(suite.assets.videos.length, 0);
  assert.equal(suite.evaluations[0].gate?.accepted, false);
});

test("Configured video duration and ratio reach Seedance through the suite engine", async t => {
  environment(t, { ARK_API_KEY: "mock-ark" });
  const calls = mockFetch(t, [json({ id: "task" }), json({ status: "succeeded", content: { video_url: "https://storage.test/video.mp4" } }), new Response("MP4")]);
  const suite = await generateAssetSuite(persona, [video], toBasteConfig({ outputDir: output(t), generators: { video: { provider: "seedance", duration: 10, ratio: "9:16", quality: "720p" } } }));
  assert.equal(suite.assets.videos.length, 1);
  assert.equal(calls[0].body.duration, 10);
  assert.equal(calls[0].body.ratio, "9:16");
  assert.equal(calls[0].body.resolution, "720p");
});

test("Image QD and final generation use Jev with matching metadata and retain both evaluations", async t => {
  environment(t, { OPENAI_API_KEY: "mock-openai", TYPESAFE_API_KEY: "mock-typesafe" });
  const calls = mockFetch(t, [imageReply(), json(judgeReply()), imageReply(), json(judgeReply())]);
  const config = toBasteConfig({ outputDir: output(t), qd: { iterations: 0, batchSize: 1, qualityThreshold: 0.5 } });
  const suite = await generateAssetSuite(persona, [image], config);
  assert.equal(suite.archive.cells.size, 1);
  assert.equal(suite.assets.images.length, 1);
  assert.equal(suite.evaluations.length, 2);
  assert.equal(calls[1].body.state.candidate.metadata.model, "gpt-image-2.5");
  assert.equal(calls[1].body.state.candidate.purpose, "hero");
  assert.ok(suite.evaluations.every(result => result.typesafe?.model === "jev-1.13.0"));
  assert.ok(calls.every(call => !call.url.includes("chat/completions")));
});

test("GUI generate forwards videoProvider and exposes Seedance's missing-key error on its job", async t => {
  environment(t);
  const beforeCwd = process.cwd();
  const dir = output(t);
  process.chdir(dir);
  t.after(() => process.chdir(beforeCwd));
  mockFetch(t, []);

  async function api(method: string, url: string, body?: unknown) {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as any;
    req.method = method;
    req.url = url;
    let status = 0;
    let data: any;
    const res = { setHeader() {}, writeHead(value: number) { status = value; }, end(value: string) { data = JSON.parse(value); } } as any;
    assert.equal(await handleAPIRequest(req, res), true);
    return { status, data };
  }

  const invalid = await api("POST", "/api/generate/cyberbotanist", { dryRun: true, videoProvider: "made-up" });
  assert.equal(invalid.status, 500);
  assert.match(invalid.data.error, /Unsupported video provider/);
  const started = await api("POST", "/api/generate/cyberbotanist", { videoProvider: "seedance", assetTypes: [video] });
  assert.equal(started.status, 202);
  await new Promise(resolve => setImmediate(resolve));
  const job = await api("GET", `/api/jobs/${started.data.jobId}`);
  assert.equal(job.data.status, "error");
  assert.match(job.data.error, /Seedance needs ARK_API_KEY/);
});
