import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ImageGenerator, SVGGenerator, VideoGenerator, clipPrompt } from "../dist/src/assets/generators.js";
import { falMediaUrl, sizeForRatio } from "../dist/src/assets/fal.js";
import { toBasteConfig } from "../dist/src/config/baste-config.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import { generateAssetSuite } from "../dist/src/baste.js";

const persona = basePersonas.cyberbotanist;
const prompt = { prompt: "Bioluminescent greenhouse at dusk", systemContext: "Persona art", parameters: {} };
const keyNames = ["OPENAI_API_KEY", "GOOGLE_API_KEY", "ARK_API_KEY", "TYPESAFE_API_KEY", "QUIVER_API_KEY", "FAL_KEY"];
const QUEUE = "https://queue.fal.run";

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
  const dir = mkdtempSync(join(tmpdir(), "baste-fal-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

interface Call { url: string; method: string; auth: string | null; body?: any }

/** A fake fal: each submission completes on the first poll with the given result. */
function fakeFal(t: TestContext, results: Record<string, (body: any) => unknown>, files: Record<string, string> = {}) {
  const calls: Call[] = [];
  const pending = new Map<string, unknown>();
  let n = 0;
  const before = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get("authorization");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init?.method ?? "GET", auth, body });
    if (url.startsWith(`${QUEUE}/`) && init?.method === "POST") {
      const endpoint = url.slice(QUEUE.length + 1);
      const make = results[endpoint];
      assert.ok(make, `Unexpected fal endpoint: ${endpoint}`);
      const id = `req-${++n}`;
      pending.set(id, make(body));
      return Response.json({ status: "IN_QUEUE", status_url: `${QUEUE}/x/requests/${id}/status`, response_url: `${QUEUE}/x/requests/${id}` });
    }
    const status = /\/requests\/([^/]+)\/status$/.exec(url);
    if (status) return Response.json({ status: "COMPLETED" });
    const done = /\/requests\/([^/]+)$/.exec(url);
    if (done) return Response.json(pending.get(done[1]));
    if (files[url] !== undefined) return new Response(files[url]);
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = before; });
  return calls;
}

const verdict = (overall: number, features = [0.6, 0.7, 0.2]) => JSON.stringify({
  overall,
  criteria: { personaAlignment: overall, visualQuality: overall, uniqueness: overall, coherence: overall, usability: overall },
  features, feedback: "Reads as a greenhouse at night.", improvements: ["More glow"], tags: ["warm"],
});

test("fal images use the queue, size by aspect ratio and never send the key to the media host", async t => {
  environment(t);
  const dir = output(t);
  const media = "https://v3b.fal.media/files/hero.png";
  const calls = fakeFal(t, { "fal-ai/bytedance/seedream/v4/text-to-image": () => ({ images: [{ url: media, content_type: "image/png" }] }) }, { [media]: "PNG" });
  const generator = new ImageGenerator(toBasteConfig({ outputDir: dir, generators: { image: { provider: "fal", apiKey: "fal-secret" } } }).generation);
  const asset = await generator.generate(persona, { kind: "image", purpose: "hero", description: "Hero", constraints: { aspectRatio: "21:9" } }, prompt);

  assert.equal(asset.metadata.service, "fal");
  assert.equal(asset.metadata.sourceUrl, media);
  assert.equal(readFileSync(asset.content, "utf8"), "PNG");
  assert.deepEqual(calls[0].body.image_size, sizeForRatio("21:9"));
  assert.ok(calls.filter(c => c.url.startsWith(QUEUE)).every(c => c.auth === "Key fal-secret"));
  assert.equal(calls.find(c => c.url === media)?.auth, null);
});

test("fal SVG comes from Recraft vector, dressed in the persona's palette", async t => {
  environment(t, { FAL_KEY: "env-fal" });
  const dir = output(t);
  const media = "https://v3b.fal.media/files/icon.svg";
  const calls = fakeFal(t, { "fal-ai/recraft/v3/text-to-image": () => ({ images: [{ url: media, content_type: "image/svg+xml" }] }) }, { [media]: "<svg/>" });
  const generator = new SVGGenerator(toBasteConfig({ outputDir: dir }, { svgProvider: "fal" }).generation);
  const asset = await generator.generate(persona, { kind: "svg", purpose: "icon", description: "App icon" }, { ...prompt, prompt: "Icon brief\nOutput as clean SVG code with proper viewBox." });

  assert.equal(readFileSync(asset.content, "utf8"), "<svg/>");
  assert.match(calls[0].body.style, /^vector_illustration/);
  assert.ok(calls[0].body.colors.length >= 3);
  assert.doesNotMatch(calls[0].body.prompt, /Output as clean SVG/);
  assert.equal(calls[0].auth, "Key env-fal");
});

test("fal refuses results hosted anywhere but its media CDN", async t => {
  environment(t, { FAL_KEY: "env-fal" });
  fakeFal(t, { "fal-ai/bytedance/seedream/v4/text-to-image": () => ({ images: [{ url: "https://evil.example/x.png" }] }) });
  const generator = new ImageGenerator(toBasteConfig({ outputDir: output(t) }, { imageProvider: "fal" }).generation);
  await assert.rejects(generator.generate(persona, { kind: "image", purpose: "hero", description: "Hero" }, prompt), /unexpected host/);
  assert.throws(() => falMediaUrl("https://fal.media.evil.example/x.png"), /unexpected host/);
  assert.equal(falMediaUrl("https://v3b.fal.media/files/x.png").hostname, "v3b.fal.media");
});

test("fal video loops run Seedance with whole-second durations", async t => {
  environment(t, { FAL_KEY: "env-fal" });
  const media = "https://v3.fal.media/files/loop.mp4";
  const calls = fakeFal(t, { "fal-ai/bytedance/seedance/v1/pro/text-to-video": () => ({ video: { url: media } }) }, { [media]: "MP4" });
  const generator = new VideoGenerator(toBasteConfig({ outputDir: output(t), generators: { video: { provider: "fal", duration: 6, quality: "720p" } } }).generation);
  const asset = await generator.generate(persona, { kind: "video", purpose: "ambient-loop", description: "Spores drifting" }, prompt);
  assert.equal(readFileSync(asset.content, "utf8"), "MP4");
  assert.equal(calls[0].body.duration, "6");
  assert.equal(calls[0].body.resolution, "720p");
  assert.match(calls[0].body.prompt, /Seamless ambient loop/);
});

test("missing FAL_KEY fails before any request", async t => {
  environment(t);
  const calls = fakeFal(t, {});
  const config = toBasteConfig({ outputDir: output(t), qd: { iterations: 0, batchSize: 1 } }, { imageProvider: "fal", evaluatorProvider: "fal" });
  await assert.rejects(generateAssetSuite(persona, [{ kind: "image", purpose: "hero", description: "Hero" }], config), /fal needs FAL_KEY/);
  assert.equal(calls.length, 0);
});

test("the fal judge sees the generated image and places it in the archive by what it shows", async t => {
  environment(t, { FAL_KEY: "env-fal" });
  const dir = output(t);
  const media = (n: number) => `https://v3b.fal.media/files/candidate-${n}.png`;
  let image = 0;
  const files = Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [media(n), `PNG ${n}`]));
  const judged: Call[] = [];
  const calls = fakeFal(t, {
    "fal-ai/bytedance/seedream/v4/text-to-image": () => ({ images: [{ url: media(++image), content_type: "image/png" }] }),
    "fal-ai/any-llm/vision": body => { judged.push(body); return { output: verdict(0.8, [judged.length % 2 ? -0.8 : 0.8, 0.5, 0.5]) }; },
  }, files);
  const config = toBasteConfig({ outputDir: dir, qd: { iterations: 1, batchSize: 2, qualityThreshold: 0.5 } }, { imageProvider: "fal", evaluatorProvider: "fal" });
  config.outputCount = 2;
  const suite = await generateAssetSuite(persona, [{ kind: "image", purpose: "hero", description: "Hero" }], config);

  const qdJudgements = calls.filter(c => c.url.endsWith("/fal-ai/any-llm/vision"));
  assert.ok(qdJudgements.length >= 4);
  assert.ok(qdJudgements.every(c => Array.isArray(c.body.image_urls) && c.body.image_urls[0].startsWith("https://v3b.fal.media/")));
  assert.equal(config.evaluator.model, "google/gemini-2.5-flash");
  assert.equal(suite.candidates.length, 4);
  assert.ok(suite.candidates.some(c => c.cell), "an archive cell records which candidate holds it");
  assert.equal(suite.archive.cells.size, 2, "warm and cool candidates hold separate cells");
  assert.equal(suite.assets.images.length, 2);
  assert.equal(Object.keys(suite.finalScores).length, 2);
  assert.equal(readdirSync(join(dir, "images")).length, 6);
});

test("only the evolved image takes the evolved prompt; other images keep their own brief", async t => {
  environment(t, { FAL_KEY: "env-fal" });
  const media = (n: number) => `https://v3b.fal.media/files/i-${n}.png`;
  let n = 0;
  const calls = fakeFal(t, {
    "fal-ai/bytedance/seedream/v4/text-to-image": () => ({ images: [{ url: media(++n) }] }),
    "fal-ai/any-llm/vision": () => ({ output: verdict(0.9) }),
  }, Object.fromEntries([1, 2, 3, 4].map(i => [media(i), "PNG"])));
  const config = toBasteConfig({ outputDir: output(t), qd: { iterations: 0, batchSize: 1, qualityThreshold: 0.5 } }, { imageProvider: "fal", evaluatorProvider: "fal" });
  config.outputCount = 1;
  await generateAssetSuite(persona, [
    { kind: "image", purpose: "hero", description: "A greenhouse hero" },
    { kind: "image", purpose: "background", description: "A quiet moss texture" },
  ], config);
  const prompts = calls.filter(c => c.url.endsWith("/seedream/v4/text-to-image")).map(c => c.body.prompt as string);
  assert.equal(prompts.length, 3);
  assert.match(prompts[2], /quiet moss texture/);
  assert.doesNotMatch(prompts[2], /greenhouse hero/);
});

test("an evaluator override never inherits the saved provider's key or model", () => {
  const config = toBasteConfig({ evaluator: { provider: "openai", model: "gpt-4o", apiKey: "openai-secret" } }, { evaluatorProvider: "fal" });
  assert.notEqual(config.evaluator.apiKey, "openai-secret");
  assert.equal(config.evaluator.model, "google/gemini-2.5-flash");
  assert.throws(() => toBasteConfig({}, { svgProvider: "made-up" }), /Unsupported SVG provider/);
});

test("prompts are clipped at a line boundary within a model's limit", () => {
  const long = Array.from({ length: 40 }, (_, i) => `line ${i} ${"x".repeat(30)}`).join("\n");
  const clipped = clipPrompt(long, 1000);
  assert.ok(clipped.length <= 1000);
  assert.ok(long.startsWith(clipped));
  assert.ok(long.slice(clipped.length).startsWith("\n"));
});

test("QD mutation always moves a candidate along one of the archive's axes, keeping the persona", async () => {
  const { generatePrompts, mutatePrompt } = await import("../dist/src/generation/prompts.js");
  const base = generatePrompts(persona, { kind: "image", purpose: "hero", description: "Hero" }).image.prompt;
  const axes = (p: string) => [/^- (.+) color temperature$/m, /^- (.+) visual density$/m, /^- (.+) rendering$/m].map(r => r.exec(p)?.[1]);
  assert.deepEqual(axes(base), ["warm amber and terracotta", "rich, layered", "cinematic, lightly stylised"]);
  assert.doesNotMatch(base, /Style: warm earth tones/, "the style line no longer fixes the palette");
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const child = mutatePrompt(base, persona, 0.4);
    const moved = axes(child);
    assert.ok(moved.every(Boolean), "every axis line survives mutation");
    assert.notDeepEqual(moved, axes(base));
    assert.match(child, /Mushishi|Ernst Haeckel|bioluminescent|mycelial|solarpunk/);
    seen.add(moved.join("|"));
  }
  assert.ok(seen.size > 10, `mutation explores many cells, saw ${seen.size}`);
});

test("the fal judge sees SVG icons rendered as images, not their path data", async t => {
  environment(t, { FAL_KEY: "env-fal" });
  const icon = "https://v3b.fal.media/files/icon.svg";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#a15d3f"/></svg>`;
  const calls = fakeFal(t, {
    "fal-ai/recraft/v3/text-to-image": () => ({ images: [{ url: icon, content_type: "image/svg+xml" }] }),
    "fal-ai/any-llm/vision": () => ({ output: verdict(0.85) }),
  }, { [icon]: svg });
  const config = toBasteConfig({ outputDir: output(t) }, { svgProvider: "fal", evaluatorProvider: "fal" });
  config.outputCount = 1;
  const suite = await generateAssetSuite(persona, [{ kind: "svg", purpose: "icon", description: "App icon" }], config);
  const judged = calls.find(c => c.url.endsWith("/fal-ai/any-llm/vision"));
  assert.ok(judged, "SVG goes to the vision judge");
  assert.match(judged!.body.image_urls[0], /^data:image\/png;base64,/);
  assert.doesNotMatch(judged!.body.prompt, /<circle/);
  assert.equal(Object.values(suite.finalScores)[0].overall, 0.85);
});
