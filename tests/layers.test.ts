import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { Resvg } from "@resvg/resvg-js";
import { FAL_INLINE_MAX, falImageInput } from "../dist/src/assets/fal.js";
import { EDIT_COLOR, MAX_INSTANCES, buildLayers, cutout, editMask, normalizeMask, rankSubjects, segmentSubject } from "../dist/src/assets/layers.js";
import { buildParallax, buildVideoLoop, parallaxMotion } from "../dist/src/assets/animate.js";
import { animationFor } from "../dist/src/assets/motion.js";
import { toBasteConfig } from "../dist/src/config/baste-config.js";
import { generateAssetSuite } from "../dist/src/baste.js";
import { evaluateWithTypeSafe } from "../dist/src/evaluation/typesafe-judge.js";
import { generatePrompts } from "../dist/src/generation/prompts.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import { buildPersona, extendPersona } from "../dist/src/persona/builder.js";
import { personaSchema } from "../dist/src/projects/schemas.js";
import { parseImageDimensions } from "../dist/src/shared/img-dims.js";
import { handleAPIRequest } from "../dist/src/gui/api.js";

const persona = basePersonas.cyberbotanist;
const hasFfmpeg = [spawnSync("ffmpeg", ["-version"]), spawnSync("ffprobe", ["-version"])].every(r => r.status === 0);
const QUEUE = "https://queue.fal.run/";
const SAM = "fal-ai/sam-3/image";
const EDIT = "fal-ai/ideogram/v3/edit";
const VIDEO = "fal-ai/bytedance/seedance/v1/pro/image-to-video";

function tmp(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "baste-layers-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function environment(t: TestContext, values: Record<string, string> = {}) {
  const keys = ["FAL_KEY", "OPENAI_API_KEY", "TYPESAFE_API_KEY", "NOTORGANIC_ENABLED"];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, values);
  t.after(() => { for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; });
}

const draw = (w: number, h: number, body: string) => new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`).render().asPng();
/** A blue scene with a magenta disc in the middle: the subject. */
const scene = (w: number, h: number, field = "#2b6fd9") => draw(w, h, `<rect width="100%" height="100%" fill="${field}"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 4}" fill="#ff00ff"/>`);
/** A segmenter's mask for that disc: white on black, or inverted. */
const disc = (w: number, h: number, inverted = false) => draw(w, h, `<rect width="100%" height="100%" fill="${inverted ? "#fff" : "#000"}"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 4}" fill="${inverted ? "#000" : "#fff"}"/>`);
const solid = (w: number, h: number, fill: string) => draw(w, h, `<rect width="100%" height="100%" fill="${fill}"/>`);
const dims = (png: Uint8Array) => parseImageDimensions(png);
/** The colours of a region the edit model repaints, and of one it keeps. */
const REPAINT = EDIT_COLOR === "white" ? [255, 255, 255] : [0, 0, 0];
const KEEP = EDIT_COLOR === "white" ? [0, 0, 0] : [255, 255, 255];
const fromDataUrl = (url: string) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");

/** RGBA at (x, y) of a PNG. */
function pixel(png: Buffer, x: number, y: number): number[] {
  const { width, height } = dims(png)!;
  const image = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image width="${width}" height="${height}" href="data:image/png;base64,${png.toString("base64")}"/></svg>`).render();
  const i = (y * width + x) * 4;
  return Array.from(image.pixels.subarray(i, i + 4));
}

interface Call { url: string; method: string; auth: string | null; body?: any }

/** A fake fal: queue endpoints answer at once; storage uploads land on fal.media; media URLs serve `media`. */
function fakeFal(t: TestContext, handlers: Record<string, (body: any) => unknown>, media = new Map<string, Buffer>(), jev?: () => Record<string, unknown>) {
  const calls: Call[] = [];
  const results = new Map<string, unknown>();
  let n = 0;
  const before = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const auth = new Headers(init?.headers).get("authorization");
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body instanceof Blob ? Buffer.from(await init.body.arrayBuffer()) : undefined;
    calls.push({ url, method, auth, body });
    if (url.startsWith(QUEUE) && method === "POST") {
      const handler = handlers[url.slice(QUEUE.length)];
      assert.ok(handler, `Unexpected fal endpoint: ${url}`);
      const id = `req-${++n}`;
      results.set(id, await handler(body));
      return Response.json({ status_url: `${QUEUE}x/requests/${id}/status`, response_url: `${QUEUE}x/requests/${id}` });
    }
    if (/\/requests\/[^/]+\/status$/.test(url)) return Response.json({ status: "COMPLETED" });
    const done = /\/requests\/([^/]+)$/.exec(url);
    if (done) return Response.json(results.get(done[1]));
    if (url.startsWith("https://rest.fal.ai/storage/upload/initiate")) {
      const id = ++n;
      return Response.json({ upload_url: `https://upload.example.test/put/${id}`, file_url: `https://v3b.fal.media/files/upload-${id}.png` });
    }
    if (url.startsWith("https://upload.example.test/put/")) {
      media.set(`https://v3b.fal.media/files/upload-${url.split("/").pop()}.png`, body);
      return new Response(null, { status: 200 });
    }
    if (url === "https://api.typesafe.ai/v1/systemone" && jev) return Response.json({ model: "jev-1.13.0", answers: jev() });
    const file = media.get(url);
    if (file) return new Response(file);
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = before; });
  return calls;
}

const layerConfig = (dir: string) => ({ outputDir: dir, falKey: "fal-test", segmentModel: SAM, editModel: EDIT });
const imageAsset = (path: string, id = "cyberbotanist-hero-1") => ({
  id, type: "image" as const, content: path, prompt: "A greenhouse",
  metadata: { service: "test", model: "test", personaId: persona.id, assetPurpose: "hero", generationTime: 0 },
});

test("fal image inputs: fal URLs pass through, small files go inline, large ones upload once and never carry the key off fal", async t => {
  const dir = tmp(t);
  const small = join(dir, "small.png");
  writeFileSync(small, scene(320, 200));
  const large = join(dir, "large.png");
  writeFileSync(large, Buffer.alloc(FAL_INLINE_MAX + 10, 7));
  const calls = fakeFal(t, {});
  assert.equal(await falImageInput(small, { key: "k", sourceUrl: "https://v3b.fal.media/files/a.png" }), "https://v3b.fal.media/files/a.png");
  assert.match(await falImageInput(small, { key: "k", sourceUrl: "https://elsewhere.example/a.png" }), /^data:image\/png;base64,/);
  const [first, second] = await Promise.all([falImageInput(large, { key: "secret" }), falImageInput(large, { key: "secret" })]);
  assert.equal(first, second);
  assert.match(first, /^https:\/\/v3b\.fal\.media\//);
  const initiated = calls.filter(c => c.url.startsWith("https://rest.fal.ai/"));
  const put = calls.filter(c => c.method === "PUT");
  assert.equal(initiated.length, 1);
  assert.equal(initiated[0].auth, "Key secret");
  assert.equal(put.length, 1);
  assert.equal(put[0].auth, null);
  assert.equal(put[0].body.length, FAL_INLINE_MAX + 10);
  await assert.rejects(falImageInput(join(dir, "art.gif"), { key: "k" }), /PNG, JPEG or WebP/);
});

test("segmentation: small instances of one subject merge into a layer", async t => {
  const dir = tmp(t);
  const path = join(dir, "lanterns.png");
  writeFileSync(path, scene(640, 400));
  // Three lanterns, each about 1.5% of the frame: too small alone, enough together.
  const lantern = (cx: number) => draw(640, 400, `<rect width="100%" height="100%" fill="#000"/><circle cx="${cx}" cy="120" r="35" fill="#fff"/>`);
  const media = new Map([100, 320, 540].map((cx, i) => [`https://v3b.fal.media/m/lantern-${i}.png`, lantern(cx)]));
  let asked: any;
  fakeFal(t, { [SAM]: body => { asked = body; return { masks: [0, 1, 2].map(i => ({ url: `https://v3b.fal.media/m/lantern-${i}.png` })), metadata: [0, 1, 2].map(i => ({ index: i, score: 0.8 })) }; } }, media);
  const mask = await segmentSubject({ path }, ["lantern"], layerConfig(dir));
  assert.equal(asked.max_masks, MAX_INSTANCES);
  assert.equal(mask?.subject, "lantern");
  assert.ok(Math.abs(mask!.coverage - 3 * Math.PI * 35 ** 2 / (640 * 400)) < 0.005, `coverage ${mask!.coverage}`);
  for (const x of [100, 320, 540]) assert.deepEqual(pixel(mask!.png, x, 120).slice(0, 3), [255, 255, 255]);
  assert.deepEqual(pixel(mask!.png, 210, 120).slice(0, 3), [0, 0, 0]);
});

test("segmentation: masks are fitted to the source, gated by score and coverage, inverted when needed, and shared", async t => {
  const dir = tmp(t);
  const path = join(dir, "scene.png");
  writeFileSync(path, scene(640, 400));
  const media = new Map([
    ["https://v3b.fal.media/m/everything.png", solid(320, 200, "#fff")],
    ["https://v3b.fal.media/m/weak.png", disc(320, 200)],
    ["https://v3b.fal.media/m/inverted.png", disc(320, 200, true)],
  ]);
  const asked: any[] = [];
  fakeFal(t, {
    [SAM]: body => {
      asked.push(body);
      if (body.prompt === "mushroom") return { masks: [] };
      if (body.prompt === "fern") return { masks: [{ url: "https://v3b.fal.media/m/everything.png" }, { url: "https://v3b.fal.media/m/weak.png" }], metadata: [{ index: 0, score: 0.9 }, { index: 1, score: 0.2 }] };
      return { masks: [{ url: "https://v3b.fal.media/m/inverted.png" }], metadata: [{ index: 0, score: 0.8 }] };
    },
  }, media);
  const subjects = ["mushroom", "fern", "terrarium", "moss"];
  const [first, second] = await Promise.all([segmentSubject({ path }, subjects, layerConfig(dir)), segmentSubject({ path }, subjects, layerConfig(dir))]);
  assert.equal(first, second, "one segmentation per image and subject list");
  assert.equal(first?.subject, "terrarium");
  assert.deepEqual([first!.width, first!.height], [640, 400]);
  assert.ok(Math.abs(first!.coverage - Math.PI * 100 ** 2 / (640 * 400)) < 0.01, `coverage ${first!.coverage}`);
  assert.deepEqual(pixel(first!.png, 320, 200).slice(0, 3), [255, 255, 255], "subject is white");
  assert.deepEqual(pixel(first!.png, 5, 5).slice(0, 3), [0, 0, 0], "background is black");
  assert.deepEqual(asked.map(b => b.prompt), ["mushroom", "fern", "terrarium"], "at most three names are tried");
  assert.equal(asked[0].apply_mask, false);
  assert.equal(asked[0].output_format, "png");
  assert.equal(asked[0].include_scores, true);
  assert.match(asked[0].image_url, /^data:image\/png;base64,/);
  await segmentSubject({ path }, subjects, layerConfig(dir));
  assert.equal(asked.length, 3);
});

test("segmentation failures are not remembered", async t => {
  const dir = tmp(t);
  const path = join(dir, "flaky.png");
  writeFileSync(path, scene(640, 400));
  let n = 0;
  fakeFal(t, {
    [SAM]: () => {
      if (n++ === 0) throw new Error("upstream hiccup");
      return { masks: [{ url: "https://v3b.fal.media/m/disc.png" }], metadata: [{ index: 0, score: 0.9 }] };
    },
  }, new Map([["https://v3b.fal.media/m/disc.png", disc(640, 400)]]));
  await assert.rejects(segmentSubject({ path }, ["moss"], layerConfig(dir)));
  assert.equal((await segmentSubject({ path }, ["moss"], layerConfig(dir)))?.subject, "moss");
});

test("edit masks mark the repainted region around a grown subject; cut-outs keep only the subject", () => {
  // Checked live: fal's Ideogram edit repaints white.
  assert.equal(EDIT_COLOR, "white");
  const mask = { ...normalizeMask(disc(320, 200), 640, 400)!, subject: "moss" };
  const keepSubject = editMask(mask, "background");
  const paintSubject = editMask(mask, "subject");
  assert.deepEqual(dims(keepSubject), { width: 640, height: 400, format: "png" });
  // The disc has a radius of 100 px; the subject grows by 2% of 400 px.
  for (const [x, y, inside] of [[320, 200, true], [424, 200, true], [600, 30, false]] as const) {
    assert.deepEqual(pixel(keepSubject, x, y).slice(0, 3), inside ? KEEP : REPAINT, `background repaint at ${x},${y}`);
    assert.deepEqual(pixel(paintSubject, x, y).slice(0, 3), inside ? REPAINT : KEEP, `subject repaint at ${x},${y}`);
  }
  const cut = cutout({ png: scene(640, 400), width: 640, height: 400 }, mask);
  assert.deepEqual(pixel(cut, 320, 200), [255, 0, 255, 255]);
  assert.equal(pixel(cut, 20, 20)[3], 0);
});

test("Jev's reading of the image ranks the subjects to try, and can rule them all out", () => {
  const choice = (probabilities: Record<string, number>) => ({ type: "choice" as const, choice: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0], confidence: 0.8, probabilities });
  assert.deepEqual(rankSubjects(["fern", "moss"]), ["fern", "moss"]);
  assert.deepEqual(rankSubjects([]), ["main subject"]);
  assert.deepEqual(rankSubjects(["fern", "moss", "terrarium"], choice({ fern: 0.1, moss: 0.6, terrarium: 0.02, none: 0.28 })), ["moss", "fern"]);
  assert.deepEqual(rankSubjects(["fern", "moss"], choice({ fern: 0.1, moss: 0.2, none: 0.7 })), []);
});

test("layers: the subject is painted out of the plate, which comes back at the source size; a cut Jev rejects is dropped", async t => {
  const dir = tmp(t);
  const path = join(dir, "hero.png");
  writeFileSync(path, scene(640, 400));
  const media = new Map([["https://v3b.fal.media/m/disc.png", disc(640, 400)], ["https://v3b.fal.media/e/plate.png", solid(512, 320, "#2b6fd9")]]);
  let whole = 0.9;
  const calls = fakeFal(t, {
    [SAM]: () => ({ masks: [{ url: "https://v3b.fal.media/m/disc.png" }], metadata: [{ index: 0, score: 0.95 }] }),
    [EDIT]: () => ({ images: [{ url: "https://v3b.fal.media/e/plate.png" }], seed: 7 }),
  }, media, () => ({ whole: { type: "noul", noul: whole }, clean: { type: "noul", noul: 0.9 } }));
  const { layers, reason } = await buildLayers(imageAsset(path), persona, ["moss"], layerConfig(dir));
  assert.ok(layers, reason);
  assert.equal(layers.subject, "moss");
  const edit = calls.find(c => c.url === `${QUEUE}${EDIT}`)!;
  const image = fromDataUrl(edit.body.image_url);
  const mask = fromDataUrl(edit.body.mask_url);
  assert.deepEqual(dims(mask), dims(image), "the mask matches the image size exactly");
  assert.deepEqual(pixel(mask, 320, 200).slice(0, 3), REPAINT, "the subject is repainted");
  assert.deepEqual(pixel(mask, 10, 10).slice(0, 3), KEEP, "the scene is kept");
  assert.equal(edit.body.expand_prompt, false);
  assert.doesNotMatch(edit.body.prompt, /moss/);
  assert.deepEqual(dims(readFileSync(layers.background)), { width: 640, height: 400, format: "png" });
  assert.equal(pixel(readFileSync(layers.foreground), 10, 10)[3], 0);
  assert.equal(pixel(readFileSync(layers.foreground), 320, 200)[3], 255);
  assert.equal(layers.check, undefined, "no judge, no cut check");

  whole = 0.2;
  const checked = await buildLayers(imageAsset(path, "cyberbotanist-hero-2"), persona, ["moss"], { ...layerConfig(dir), judge: { apiKey: "typesafe-test" } });
  assert.equal(checked.layers, undefined);
  assert.match(checked.reason!, /incomplete/);
  assert.ok(!readdirSync(join(dir, "layers")).some(file => file.startsWith("cyberbotanist-hero-2")));
});

test("QD edit children repaint a parent's image within budget, record their lineage, and the final image ships as judged", async t => {
  environment(t, { FAL_KEY: "fal-test" });
  const dir = tmp(t);
  const random = Math.random;
  Math.random = () => 0.1;
  t.after(() => { Math.random = random; });
  const media = new Map<string, Buffer>([["https://v3b.fal.media/m/disc.png", disc(1024, 1024)]]);
  let drawn = 0;
  let edited = 0;
  let judged = 0;
  const calls = fakeFal(t, {
    "fal-ai/bytedance/seedream/v4/text-to-image": () => {
      const url = `https://v3b.fal.media/d/${++drawn}.png`;
      media.set(url, scene(1024, 1024));
      return { images: [{ url, content_type: "image/png" }] };
    },
    [SAM]: () => ({ masks: [{ url: "https://v3b.fal.media/m/disc.png" }], metadata: [{ index: 0, score: 0.9 }] }),
    [EDIT]: () => {
      const url = `https://v3b.fal.media/e/${++edited}.png`;
      media.set(url, scene(1024, 1024, "#e07a2b"));
      return { images: [{ url }], seed: edited };
    },
    "fal-ai/any-llm/vision": () => ({ output: JSON.stringify({
      overall: 0.8, criteria: { personaAlignment: 0.8, visualQuality: 0.8, uniqueness: 0.8, coherence: 0.8, usability: 0.8 },
      features: [++judged % 2 ? -0.8 : 0.8, 0.5, 0.5], feedback: "Moss at night.", improvements: [], tags: [],
    }) }),
  }, media);
  const config = toBasteConfig({ outputDir: dir, qd: { iterations: 2, batchSize: 2, qualityThreshold: 0 } }, { imageProvider: "fal", evaluatorProvider: "fal", edit: true });
  config.outputCount = 1;
  const suite = await generateAssetSuite(persona, [{ kind: "image", purpose: "hero", description: "A greenhouse hero" }], config, { log: () => {} });

  const edits = suite.candidates.filter(c => c.edit);
  assert.equal(edits.length, 2, "edits are capped at iterations × half a batch");
  for (const child of edits) {
    assert.equal(child.edit!.layer, "background", "the persona's focus picks the region");
    assert.match(child.edit!.instruction, /^Repainted the background in .+, keeping the mushroom\.$/);
    assert.ok(suite.candidates.some(c => c.path === child.edit!.from), "lineage points at a candidate");
    assert.ok(existsSync(child.path));
  }
  assert.equal(calls.filter(c => c.url === `${QUEUE}${SAM}`).length, 1, "the parent is segmented once");
  const editRequests = calls.filter(c => c.url === `${QUEUE}${EDIT}`);
  assert.equal(edits.length + 1, editRequests.length, "two edits, then one plate for the final image's layers");
  assert.match(editRequests[0].body.prompt, /^The background of A greenhouse hero, behind the mushroom: /);
  assert.equal(drawn, 4, "two seeds and two drawn children; the final image is not drawn again");
  const [final] = suite.assets.images;
  assert.ok(suite.candidates.some(c => c.path === final.content));
  assert.ok(final.derived?.layers && existsSync(final.derived.layers.foreground));
  assert.ok(suite.candidates.some(c => c.cell), "cells are matched by image");
});

test("an edit child whose parent has no subject to cut out is drawn anew", async t => {
  environment(t, { FAL_KEY: "fal-test" });
  const dir = tmp(t);
  const random = Math.random;
  Math.random = () => 0.1;
  t.after(() => { Math.random = random; });
  const media = new Map<string, Buffer>();
  let drawn = 0;
  const logs: string[] = [];
  const calls = fakeFal(t, {
    "fal-ai/bytedance/seedream/v4/text-to-image": () => {
      const url = `https://v3b.fal.media/d/${++drawn}.png`;
      media.set(url, scene(512, 512));
      return { images: [{ url, content_type: "image/png" }] };
    },
    [SAM]: () => ({ masks: [] }),
    "fal-ai/any-llm/vision": () => ({ output: JSON.stringify({
      overall: 0.8, criteria: { personaAlignment: 0.8, visualQuality: 0.8, uniqueness: 0.8, coherence: 0.8, usability: 0.8 },
      features: [0.2, 0.5, 0.5], feedback: "", improvements: [], tags: [],
    }) }),
  }, media);
  const config = toBasteConfig({ outputDir: dir, qd: { iterations: 1, batchSize: 2, qualityThreshold: 0 } }, { imageProvider: "fal", evaluatorProvider: "fal", edit: true });
  config.outputCount = 1;
  const suite = await generateAssetSuite(persona, [{ kind: "image", purpose: "hero", description: "Hero" }], config, { log: line => logs.push(line) });
  assert.equal(suite.candidates.filter(c => c.edit).length, 0);
  assert.equal(drawn, 4);
  assert.ok(!calls.some(c => c.url === `${QUEUE}${EDIT}`));
  assert.ok(logs.some(line => /No subject to repaint/.test(line)));
  assert.ok(logs.some(line => /no subject stood apart/.test(line)));
});

test("parallax motion follows the persona's camera, depth and focus", () => {
  const drift = parallaxMotion(basePersonas.cyberbotanist);
  assert.ok(drift.background.travel > 0 && drift.background.scale === 0);
  assert.ok(Math.abs(drift.subject.travel - drift.background.travel * 3) < 0.01, "deep: the front layer moves three times as far");
  const push = parallaxMotion(basePersonas.liminalweeb);
  assert.ok(push.background.travel === 0 && push.subject.scale > push.background.scale);
  const locked = parallaxMotion(basePersonas.nightmarketcoder);
  assert.deepEqual(locked.background, { travel: 0, scale: 0.015 }, "locked: the background breathes");
  assert.ok(locked.subject.travel > 0 && locked.subject.scale === 0, "and the subject sways, so the layers move differently");
  assert.ok(drift.bleed > drift.subject.travel, "layers extend past every move");
});

test("parallax: a script-free page with inline layers, a JSON spec, and an MP4 whose last frame meets its first", async t => {
  const dir = tmp(t);
  const background = join(dir, "bg.png");
  const foreground = join(dir, "fg.png");
  writeFileSync(background, draw(640, 400, `<rect width="100%" height="100%" fill="#2b6fd9"/><rect x="40" y="40" width="120" height="320" fill="#f0c534"/><rect x="480" y="60" width="100" height="280" fill="#2e7d5b"/>`));
  writeFileSync(foreground, cutout({ png: scene(640, 400), width: 640, height: 400 }, normalizeMask(disc(640, 400), 640, 400)!));
  const files = await buildParallax(imageAsset(join(dir, "hero.png")), { subject: "moss", foreground, background, mask: background, width: 640, height: 400 }, persona, dir);
  const html = readFileSync(files.html, "utf8");
  assert.doesNotMatch(html, /<script/i);
  assert.equal(html.match(/data:image\/png;base64,/g)?.length, 2);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{ \.layer \{ animation: none; \} \}/);
  assert.match(html, /animation: move-subject 3s .+ infinite alternate;/);
  assert.match(html, /<title>The Cyberbotanist: hero in parallax<\/title>/);
  const spec = JSON.parse(readFileSync(files.spec, "utf8"));
  assert.deepEqual([spec.camera, spec.depth, spec.loopSeconds, spec.layers.map((l: any) => l.name)], ["drift", "deep", 6, ["background", "subject"]]);
  if (!hasFfmpeg) return;
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", files.video!]);
  assert.ok(Math.abs(Number(String(probe.stdout)) - 6) < 0.1);
  const frame = (seconds: number) => spawnSync("ffmpeg", ["-v", "error", "-ss", String(seconds), "-i", files.video!, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], { maxBuffer: 1 << 24 }).stdout as Buffer;
  const difference = (a: Buffer, b: Buffer) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
  const first = frame(0);
  assert.ok(difference(first, frame(5.966)) < difference(first, frame(1.5)) / 3, "the loop closes on itself");
});

test("video loop: an end frame repaints the subject, Seedance runs from start to end, and the clip plays there and back", { skip: !hasFfmpeg && "needs ffmpeg" }, async t => {
  const dir = tmp(t);
  const path = join(dir, "hero.png");
  writeFileSync(path, scene(640, 400));
  const clip = join(dir, "clip.mp4");
  assert.equal(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=duration=2:size=320x200:rate=12", "-pix_fmt", "yuv420p", clip]).status, 0);
  const media = new Map([
    ["https://v3b.fal.media/m/disc.png", disc(640, 400)],
    ["https://v3b.fal.media/e/end.png", scene(640, 400, "#14532d")],
    ["https://v3b.fal.media/v/clip.mp4", readFileSync(clip)],
  ]);
  const calls = fakeFal(t, {
    [SAM]: () => ({ masks: [{ url: "https://v3b.fal.media/m/disc.png" }], metadata: [{ index: 0, score: 0.9 }] }),
    [EDIT]: () => ({ images: [{ url: "https://v3b.fal.media/e/end.png" }], seed: 1 }),
    [VIDEO]: () => ({ video: { url: "https://v3b.fal.media/v/clip.mp4" }, seed: 1 }),
  }, media);
  // The night market's focus is both: the end frame repaints the lantern, a small region, and keeps the scene.
  const loop = await buildVideoLoop(imageAsset(path), basePersonas.nightmarketcoder, ["lantern"], { ...layerConfig(dir), animateModel: VIDEO, resolution: "720p" });
  const edit = calls.find(c => c.url === `${QUEUE}${EDIT}`)!;
  const mask = fromDataUrl(edit.body.mask_url);
  assert.deepEqual(pixel(mask, 320, 200).slice(0, 3), REPAINT, "the subject is repainted");
  assert.deepEqual(pixel(mask, 10, 10).slice(0, 3), KEEP, "the scene is kept");
  assert.equal(edit.body.prompt, "The lantern, the same size and in the same spot, a moment later: paper lanterns swaying. Chungking Express, night markets, neon signage. No text, no lettering.");
  const video = calls.find(c => c.url === `${QUEUE}${VIDEO}`)!.body;
  assert.match(video.image_url, /^https:\/\/v3b\.fal\.media\/files\/upload-/);
  assert.equal(video.end_image_url, "https://v3b.fal.media/e/end.png");
  assert.equal(video.duration, "2");
  assert.equal(video.camera_fixed, true, "a locked camera");
  assert.match(video.prompt, /Avoid slow fades/);
  assert.ok(existsSync(loop.end!) && existsSync(loop.transition));
  const seconds = Number(String(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", loop.video!]).stdout));
  assert.ok(Math.abs(seconds - 46 / 12) < 0.1, `two clips less the repeated turn frames, got ${seconds}`);
});

test("video loop: a background that is most of the frame is not repainted; the motifs move the scene instead", { skip: !hasFfmpeg && "needs ffmpeg" }, async t => {
  const dir = tmp(t);
  const path = join(dir, "hero.png");
  writeFileSync(path, scene(640, 400));
  const clip = join(dir, "clip.mp4");
  assert.equal(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=duration=1:size=320x200:rate=12", "-pix_fmt", "yuv420p", clip]).status, 0);
  const calls = fakeFal(t, {
    [SAM]: () => ({ masks: [{ url: "https://v3b.fal.media/m/disc.png" }], metadata: [{ index: 0, score: 0.9 }] }),
    [VIDEO]: () => ({ video: { url: "https://v3b.fal.media/v/clip.mp4" }, seed: 1 }),
  }, new Map([["https://v3b.fal.media/m/disc.png", disc(640, 400)], ["https://v3b.fal.media/v/clip.mp4", readFileSync(clip)]]));
  // The greenhouse's focus is the background: here 88% of the frame.
  const loop = await buildVideoLoop(imageAsset(path, "cyberbotanist-hero-9"), persona, ["moss"], { ...layerConfig(dir), animateModel: VIDEO });
  assert.ok(!calls.some(c => c.url === `${QUEUE}${EDIT}`));
  const video = calls.find(c => c.url === `${QUEUE}${VIDEO}`)!.body;
  assert.equal(video.end_image_url, undefined);
  assert.match(video.prompt, /^spores drifting through low light; /);
  assert.equal(video.duration, "3");
  assert.equal(loop.end, undefined);
  assert.ok(loop.video && existsSync(loop.video));
});

test("persona animation: validated by the schema, kept when extended, and filled from the aesthetic", () => {
  assert.ok(personaSchema.safeParse(basePersonas.liminalweeb).success);
  const animation = basePersonas.liminalweeb.animation!;
  assert.ok(!personaSchema.safeParse({ ...basePersonas.liminalweeb, animation: { ...animation, depth: "sideways" } }).success);
  assert.ok(!personaSchema.safeParse({ ...basePersonas.liminalweeb, animation: { ...animation, extra: true } }).success);
  const remix = extendPersona(basePersonas.cyberbotanist, { id: "remix", name: "Remix", animation: { avoid: ["jump cuts"], camera: "orbit" } });
  assert.deepEqual(remix.animation!.avoid, [...basePersonas.cyberbotanist.animation!.avoid, "jump cuts"]);
  assert.equal(remix.animation!.camera, "orbit");
  assert.equal(remix.animation!.depth, "deep");
  const plain = buildPersona({ id: "plain", name: "Plain", aesthetic: { motionStyle: "snappy", density: "maximalist" } });
  assert.equal(plain.animation, undefined);
  assert.deepEqual(animationFor(plain), { motifs: [], subjects: [], depth: "flat", camera: "locked", focus: "background", loopSeconds: 4, avoid: [] });
  assert.equal(animationFor({ ...plain, animation: { ...animationFor(plain), loopSeconds: 40 } }).loopSeconds, 12);
  const { video } = generatePrompts(basePersonas.nightmarketcoder, { kind: "video", purpose: "loop", description: "Market" });
  assert.match(video.prompt, /What moves: neon signs flickering on/);
  assert.match(video.prompt, /Camera move: locked-off camera/);
  assert.match(video.prompt, /Avoid: slow fades, long empty pauses, dreamy floating drift\./);
  assert.equal(video.negativePrompt, "slow fades, long empty pauses, dreamy floating drift");
});

test("Jev names the subject it sees, from the persona's list, when layers are wanted", async t => {
  const dir = tmp(t);
  const path = join(dir, "hero.png");
  writeFileSync(path, scene(640, 400));
  let questions: any;
  const before = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const form = await new Response(init!.body as Blob, { headers: { "Content-Type": (init!.headers as Record<string, string>)["Content-Type"] } }).formData();
    const request = JSON.parse(String(form.get("request")));
    questions = request.questions;
    const answers: Record<string, unknown> = {};
    for (const [id, q] of Object.entries<any>(questions)) {
      if (q.type === "score") answers[id] = { type: "score", score: 1, confidence: 0.9, probabilities: Object.fromEntries(q.criteria.map((_: unknown, i: number) => [String(i), i === 1 ? 1 : 0])), legend: Object.fromEntries(q.criteria.map((c: string, i: number) => [String(i), c])) };
      if (q.type === "noul") answers[id] = { type: "noul", noul: 0.1 };
      if (q.type === "choice") answers[id] = { type: "choice", choice: "fern", confidence: 0.7, probabilities: Object.fromEntries(Object.keys(q.criteria).map(o => [o, o === "fern" ? 0.7 : o === "moss" ? 0.2 : 0.1 / (Object.keys(q.criteria).length - 2)])) };
    }
    return Response.json({ model: "jev-1.13.0", answers });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = before; });
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: path, subjects: ["fern", "moss", "none", "fern"] }, { apiKey: "k" });
  assert.deepEqual(Object.keys(questions.mainSubject.criteria), ["fern", "moss", "none"]);
  assert.equal(result.typesafe?.visual?.subject?.choice, "fern");
  assert.deepEqual(rankSubjects(["fern", "moss"], result.typesafe?.visual?.subject), ["fern", "moss"]);
});

async function api(method: string, url: string, body?: unknown) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as any;
  req.method = method;
  req.url = url;
  req.headers = {};
  let status = 0;
  let headers: Record<string, string> = {};
  let raw: Buffer | string = "";
  const res = {
    setHeader(key: string, value: string) { headers[key] = value; },
    writeHead(code: number, values?: Record<string, string>) { status = code; headers = { ...headers, ...values }; },
    end(value: Buffer | string) { raw = value ?? ""; },
  } as any;
  assert.equal(await handleAPIRequest(req, res), true);
  let data: any;
  try { data = JSON.parse(String(raw)); } catch { data = undefined; }
  return { status, headers, raw, data };
}

test("the API serves layers and loops from their own folders, pages sandboxed without scripts", async t => {
  environment(t);
  const dir = tmp(t);
  const before = process.cwd();
  process.chdir(dir);
  t.after(() => process.chdir(before));
  mkdirSync(join(dir, "assets/output/animation"), { recursive: true });
  mkdirSync(join(dir, "assets/output/layers"), { recursive: true });
  writeFileSync(join(dir, "assets/output/animation/hero-parallax.html"), "<!doctype html><title>x</title>");
  writeFileSync(join(dir, "assets/output/animation/hero-parallax.json"), "{}");
  writeFileSync(join(dir, "assets/output/layers/hero-fg.png"), scene(320, 200));
  writeFileSync(join(dir, "assets/output/layers/page.html"), "<p>not here</p>");

  const page = await api("GET", "/api/assets/animation/hero-parallax.html");
  assert.equal(page.status, 200);
  assert.equal(page.headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(page.headers["Content-Security-Policy"], "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'");
  assert.equal(page.headers["X-Content-Type-Options"], "nosniff");
  assert.equal((await api("GET", "/api/assets/animation/hero-parallax.json")).headers["Content-Type"], "application/json");
  assert.equal((await api("GET", "/api/assets/layers/hero-fg.png")).status, 200);
  assert.equal((await api("GET", "/api/assets/layers/page.html")).status, 404, "pages only from the animation folder");
  assert.equal((await api("GET", "/api/assets/animation/..%2Flayers%2Fhero-fg.png")).status, 404);
  const invalid = await api("POST", "/api/generate/cyberbotanist", { dryRun: true, animate: "sideways" });
  assert.equal(invalid.status, 400);
  assert.match(invalid.data.error, /parallax, video or both/);
});


test("hosted cuts and video loops use account jobs, inline inputs and credential-free downloads", { skip: !hasFfmpeg && "needs ffmpeg" }, async t => {
  environment(t);
  const dir = tmp(t); const path = join(dir, "hosted.png"); writeFileSync(path, scene(320, 200));
  const clip = join(dir, "hosted-fixture.mp4");
  assert.equal(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=duration=1:size=320x200:rate=12", "-pix_fmt", "yuv420p", clip]).status, 0);
  const media = new Map<string, Buffer>([["https://v3b.fal.media/mask.png", disc(320, 200)], ["https://v3b.fal.media/plate.png", scene(320, 200, "#225533")], ["https://v3b.fal.media/loop.mp4", readFileSync(clip)]]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    const bytes = media.get(String(url)); assert.ok(bytes, `Unexpected direct request: ${url}`); return new Response(bytes);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const roles: string[] = []; const outputs = new Map<string, unknown>(); let counter = 0;
  const cfg = { ...layerConfig(dir), pollIntervalMs: 0, notOrganicFetch: async (path: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const { model, input } = JSON.parse(String(init.body)); roles.push(model);
      assert.match(input.image_url, /^data:image\/png;base64,/);
      if (model === "image-edit") assert.match(input.mask_url, /^data:image\/png;base64,/);
      const id = `fal_${String(++counter).padStart(43, "a")}`;
      outputs.set(id, model === "image-segment" ? { masks: [{ url: "https://v3b.fal.media/mask.png" }], scores: [0.9] } : model === "image-edit" ? { images: [{ url: "https://v3b.fal.media/plate.png" }] } : { video: { url: "https://v3b.fal.media/loop.mp4" } });
      return Response.json({ job_id: id, status: "queued" });
    }
    return Response.json({ status: "succeeded", result: outputs.get(path.split("/").at(-1)!) });
  } };
  const asset = imageAsset(path, "hosted-image");
  const cut = await buildLayers(asset, persona, ["mushroom"], cfg); assert.ok(cut.layers);
  const loop = await buildVideoLoop(asset, { ...persona, animation: { ...animationFor(persona), motifs: [] } }, ["mushroom"], { ...cfg, animateModel: VIDEO });
  assert.ok(existsSync(loop.transition)); assert.deepEqual(roles, ["image-segment", "image-edit", "image-animate"]);
});
