import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { clairic, readAnswer, ClairicError, presentText } from "../dist/src/samples/clairic.js";
import { deflateSync } from "node:zlib";
import { pixelBox, mergeRegions, iou, crop, imageRef, regionCutout, readMaskRegion } from "../dist/src/samples/regions.js";
import { traitsOf, reasons, judge, readPage, pool } from "../dist/src/samples/read.js";
import { cleanLookFor, original, sampleSite, readRun, listRuns, keepSample } from "../dist/src/samples/index.js";
import { toHex, firstFamily } from "../dist/src/samples/capture.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";

const png = (w: number, h: number, body = "") => Buffer.from(new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f4efe6"/>${body}</svg>`).render().asPng());

function env(t: any, values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    const before = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
}

test("Clairic answers are kept only when they match the field that was asked", () => {
  assert.deepEqual(readAnswer({ type: "estimate", min: 0, max: 10 }, { median: 4, p10: 2, p90: 7 }), { type: "estimate", median: 4, p10: 2, p90: 7 });
  assert.equal(readAnswer({ type: "estimate", min: 0, max: 10 }, { median: 4, p10: 6, p90: 7 }), undefined, "unordered interval");
  assert.equal(readAnswer({ type: "estimate", min: 0, max: 10 }, { median: 14, p10: 2, p90: 17 }), undefined, "out of range");
  assert.equal(readAnswer({ type: "list", items: "text" }, { value: ["a", 3] }), undefined);
  assert.equal(presentText(readAnswer({ type: "text" }, { value: "Get started", p_null: 0.01 })), "Get started");
  assert.equal(presentText(readAnswer({ type: "text" }, { value: "f", p_null: 0.51 })), null, "a likely-absent value is not shown");
});

test("Clairic sends images inline, needs local credentials and never echoes upstream text", async t => {
  env(t, { CLOUDFLARE_AI_API_TOKEN: undefined, CLOUDFLARE_ACCOUNT_ID: undefined });
  await assert.rejects(clairic({ state: "x", fields: { a: { type: "text" } } }), (e: unknown) => e instanceof ClairicError && e.category === "unavailable");
  env(t, { CLOUDFLARE_AI_API_TOKEN: "token", CLOUDFLARE_ACCOUNT_ID: "acct" });
  let sent: any;
  const ok = async (url: unknown, init: RequestInit) => {
    sent = { url: String(url), body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") };
    return Response.json({ result: { model: "@cf/cloudflare/clairic", answers: { a: { type: "text", value: "Hi", p_null: 0 }, b: { median: 99, p10: 1, p90: 2 } }, truncated: false, usage: { input_tokens: 42, output_tokens: 0 } } });
  };
  const result = await clairic({ state: "s", images: [{ data: png(20, 20), contentType: "image/png" }], fields: { a: { type: "text" }, b: { type: "estimate", min: 0, max: 10 } } }, { fetcher: ok as typeof fetch });
  assert.match(sent.url, /accounts\/acct\/ai\/run\/@cf\/cloudflare\/clairic$/);
  assert.equal(sent.auth, "Bearer token");
  assert.match(sent.body.images[0], /^data:image\/png;base64,/);
  assert.equal(result.answers.a?.type, "text");
  assert.equal(result.answers.b, undefined, "an invalid estimate is dropped");
  assert.equal(result.inputTokens, 42);
  const failing = async () => Response.json({ errors: [{ message: "your secret draft" }] }, { status: 500 });
  await assert.rejects(clairic({ state: "s", fields: { a: { type: "text" } } }, { fetcher: failing as typeof fetch }), (e: unknown) => e instanceof ClairicError && !e.message.includes("secret"));
  const limited = async () => new Response("", { status: 429 });
  await assert.rejects(clairic({ state: "s", fields: { a: { type: "text" } } }, { fetcher: limited as typeof fetch }), (e: any) => e.category === "rate-limited");
  await assert.rejects(clairic({ state: "s", fields: { a: { type: "text" } }, images: Array.from({ length: 5 }, () => ({ data: png(4, 4), contentType: "image/png" as const })) }, { fetcher: ok as typeof fetch }), (e: any) => e.category === "rejected");
});

test("SAM boxes become pixel boxes, and overlapping finds of one thing merge", () => {
  assert.deepEqual(pixelBox([0.5, 0.5, 0.2, 0.1], 1000, 800), { x: 400, y: 360, w: 200, h: 80 });
  assert.equal(pixelBox([0.5, 0.5, 0.001, 0.001], 1000, 800), null, "specks are dropped");
  assert.equal(pixelBox([0.5, 0.5, "w", 1], 1000, 800), null);
  assert.deepEqual(pixelBox([0.02, 0.98, 0.1, 0.1], 1000, 800), { x: 0, y: 744, w: 70, h: 56 }, "clamped to the image");
  const merged = mergeRegions([
    { box: { x: 0, y: 0, w: 100, h: 50 }, score: 0.7, prompt: "button" },
    { box: { x: 2, y: 1, w: 100, h: 50 }, score: 0.9, prompt: "logo" },
    { box: { x: 500, y: 0, w: 40, h: 40 }, score: 0.6, prompt: "icon" },
  ]);
  assert.deepEqual(merged.map((r) => [r.prompts, r.score]), [[["logo", "button"], 0.9], [["icon"], 0.6]]);
  assert.ok(iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 }) === 1);
  const c = crop(imageRef(png(200, 100), 200, 100), { x: 190, y: 90, w: 30, h: 30 });
  assert.ok(c.box.x + c.box.w <= 200 && c.box.y + c.box.h <= 100, "crops stay inside the image");
  // A 2× capture: layout boxes, denser pixels kept.
  const dense = imageRef(png(400, 200), 200, 100);
  const sharp = crop(dense, { x: 10, y: 10, w: 100, h: 50 }, { pad: 0, minSide: 0 });
  assert.deepEqual([sharp.width, sharp.height], [200, 100]);
  assert.equal(crop(dense, { x: 0, y: 0, w: 200, h: 100 }, { pad: 0, minSide: 0, maxSide: 120 }).width, 120, "capped for a model");
  assert.equal(crop(dense, { x: 0, y: 0, w: 10, h: 10 }, { pad: 0, minSide: 96 }).width, 40, "small things are enlarged in whole steps, at most 4× layout size");
  assert.equal(crop(imageRef(png(200, 100), 200, 100), { x: 0, y: 0, w: 10, h: 10 }, { pad: 0, minSide: 96 }).width, 40);
  // SAM's masks: 8-bit grayscale PNGs at the source's pixel size. Every PNG filter type is exercised.
  const grayPng = (w: number, h: number, inside: (x: number, y: number) => boolean) => {
    const rows = Buffer.alloc((w + 1) * h);
    let prev = new Uint8Array(w);
    for (let y = 0; y < h; y++) {
      const filter = y % 5, line = new Uint8Array(w).map((_, x) => inside(x, y) ? 255 : 0);
      rows[y * (w + 1)] = filter;
      for (let x = 0; x < w; x++) {
        const a = x ? line[x - 1] : 0, b = prev[x], c = x ? prev[x - 1] : 0, p = a + b - c;
        const pred = [0, a, b, (a + b) >> 1, Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c][filter];
        rows[y * (w + 1) + 1 + x] = (line[x] - pred) & 0xff;
      }
      prev = line;
    }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
    const chunk = (type: string, data: Buffer) => { const head = Buffer.alloc(8); head.writeUInt32BE(data.length); head.write(type, 4); return Buffer.concat([head, data, Buffer.alloc(4)]); };
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
  };
  const square = (x: number, y: number) => x >= 20 && x < 60 && y >= 20 && y < 60;
  const region = readMaskRegion(grayPng(400, 200, square), { x: 10, y: 10, width: 60, height: 60 })!;
  assert.deepEqual([region.width, region.height, region.region.width], [400, 200, 60]);
  for (const [x, y] of [[0, 0], [15, 15], [10, 10], [49, 49], [55, 30]]) assert.equal(region.region.gray[y * 60 + x], square(x + 10, y + 10) ? 255 : 0, `pixel ${x},${y}`);
  assert.equal(readMaskRegion(png(10, 10), { x: 0, y: 0, width: 5, height: 5 }), null, "RGBA PNGs take the full decode");
  const cut = regionCutout(dense, grayPng(400, 200, square), { x: 10, y: 10, w: 20, h: 20 }, 0)!;
  const pixels = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><image width="48" height="48" href="data:image/png;base64,${cut.toString("base64")}"/></svg>`).render().pixels;
  const alphaAt = (x: number, y: number) => pixels[(y * 48 + x) * 4 + 3];
  assert.deepEqual([alphaAt(2, 2), alphaAt(30, 30)], [0, 255], "outside the mask is transparent, inside is opaque");
  const rgbaMask = png(400, 200, `<rect width="100%" height="100%" fill="#000"/><rect x="20" y="20" width="40" height="40" fill="#fff"/>`);
  assert.ok(regionCutout(dense, rgbaMask, { x: 10, y: 10, w: 20, h: 20 }, 0), "other mask formats still work");
  assert.equal(regionCutout(dense, grayPng(10, 10, () => true), { x: 0, y: 0, w: 10, h: 10 }), undefined, "a mask of the wrong size is refused");
  assert.equal(regionCutout(dense, Buffer.from("not an image"), { x: 0, y: 0, w: 10, h: 10 }), undefined);
  assert.throws(() => imageRef(Buffer.from("not an image"), 10, 10));
});

test("what to look for is bounded and defaults to design elements", () => {
  assert.deepEqual(cleanLookFor(undefined), ["logo", "icon", "illustration or photo", "button"]);
  assert.deepEqual(cleanLookFor("lantern illustration,  neon   sign\n,lantern illustration"), ["lantern illustration", "neon sign"]);
  assert.equal(cleanLookFor(Array.from({ length: 10 }, (_, i) => `thing ${i}`)).length, 6);
  assert.equal(cleanLookFor(["x".repeat(200)])[0].length, 60);
  assert.equal(toHex("rgba(10, 20, 255, 0.5)"), "#0a14ff");
  assert.equal(firstFamily(`"Söhne", sans-serif`), "Söhne");
});

test("traits come from the persona, and reasons are the traits that clearly show", () => {
  const traits = traitsOf(basePersonas.nightmarketcoder);
  assert.ok(traits.some((t) => t.kind === "value" && t.label === "information density"));
  assert.ok(traits.some((t) => t.kind === "peeve" && t.label === "corporate sterile feel"));
  assert.ok(traits.length <= 10);
  const r = reasons([
    { id: "a", label: "speed", kind: "value", median: 8, p10: 6, p90: 9 },
    { id: "b", label: "density", kind: "value", median: 6, p10: 2, p90: 9 },
    { id: "c", label: "sterile", kind: "peeve", median: 7, p10: 5, p90: 9 },
  ]);
  assert.deepEqual(r.fits.map((t) => t.label), ["speed"], "an uncertain trait is not a reason");
  assert.deepEqual(r.clashes.map((t) => t.label), ["sterile"]);
});

test("judging asks one estimate per trait against the persona, and reading uses a neutral state", async () => {
  const persona = basePersonas.nightmarketcoder;
  const traits = traitsOf(persona);
  const calls: any[] = [];
  const fake = { tokens: 0, run: async (request: any) => {
    calls.push(request);
    const answers: Record<string, any> = {};
    for (const [name, field] of Object.entries<any>(request.fields)) answers[name] = field.type === "estimate" ? { type: "estimate", median: 5, p10: 4, p90: 6 } : field.type === "list" ? { type: "list", value: ["Products"], confidence: 0.99 } : { type: "text", value: "Order now", guess: "Order now", pNull: 0.01 };
    return { answers, inputTokens: 100, truncated: false };
  } };
  const j = await judge(fake, png(40, 40), persona, traits, "element");
  assert.equal(j!.traits.length, traits.length);
  assert.ok(calls[0].state.includes(persona.name));
  assert.ok(Object.keys(calls[0].fields).every((k) => k === "relevance" || /^t\d+$/.test(k)));
  const page = await readPage(fake, png(40, 40));
  assert.equal(page.primaryAction, "Order now");
  assert.equal(calls[1].state, "", "words are read without a state to quote from");
  assert.deepEqual(await pool([3, 1, 2], 2, async (n) => n * 2), [6, 2, 4]);
});

test("a run finds regions, links page originals, judges the most confident, and keeps the best file", async t => {
  const dir = mkdtempSync(join(tmpdir(), "baste-samples-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const screenshot = png(400, 300, `<circle cx="50" cy="40" r="20" fill="#e44635"/><rect x="200" y="200" width="120" height="40" fill="#111"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="20" fill="#e44635"/></svg>`;
  const capture = async (url: string) => ({
    url, finalUrl: "https://example.com/", title: "Example", screenshot, width: 400, height: 300, scale: 1,
    styles: { background: "#f4efe6", text: "#111111", headingFont: "Inter", headingSize: 48, headingColor: "#111111", bodyFont: "Inter" },
    elements: [
      { kind: "svg" as const, box: { x: 30, y: 20, w: 40, h: 40 }, svg, brand: true },
      { kind: "image" as const, box: { x: 300, y: 20, w: 60, h: 60 }, src: "https://example.com/photo.png", alt: "Stall" },
      { kind: "svg" as const, box: { x: 10, y: 250, w: 20, h: 20 }, svg: "<svg not valid" },
    ],
  });
  const regions = async (_image: any, prompts: string[]) => {
    assert.deepEqual(prompts, ["logo", "button"]);
    return { regions: [
      { box: { x: 31, y: 21, w: 39, h: 39 }, score: 0.9, prompts: ["logo"], cutout: png(39, 39) },
      { box: { x: 200, y: 200, w: 120, h: 40 }, score: 0.8, prompts: ["button"] },
    ], failed: ["button"] };
  };
  let n = 0;
  const fake = { tokens: 0, run: async (request: any) => {
    n++;
    const answers: Record<string, any> = {};
    for (const [name, field] of Object.entries<any>(request.fields)) answers[name] = field.type === "estimate" ? { type: "estimate", median: name === "relevance" ? n % 10 : 6, p10: 5, p90: 8 } : field.type === "list" ? { type: "list", value: [], confidence: 0 } : { type: "text", value: null, guess: null, pNull: 0.9 };
    return { answers, inputTokens: 10, truncated: false };
  } };
  const run = await sampleSite({ url: "https://example.com", persona: basePersonas.nightmarketcoder, lookFor: ["logo", "button"], dir, read: true, capture, regions: regions as any, reader: fake });
  assert.equal(run.samples.length, 4, "two SAM regions, the page photo, and the invalid inline SVG's box");
  const logo = run.samples.find((s) => s.foundBy.includes("logo"))!;
  assert.equal(logo.original?.kind, "svg");
  assert.ok(existsSync(join(dir, run.id, logo.original!.file!)));
  assert.ok(logo.cutout && existsSync(join(dir, run.id, logo.cutout)));
  const photo = run.samples.find((s) => s.foundBy.includes("page") && s.original?.src)!;
  assert.equal(photo.original!.src, "https://example.com/photo.png");
  assert.ok(run.samples.every((s) => s.judgement), "every sample was judged");
  assert.ok(run.screen && run.page, "the screen was read and judged");
  assert.deepEqual(run.notes, ["Segmentation failed for “button”."]);
  assert.ok(run.samples.every((s, i, all) => i === 0 || (all[i - 1].judgement!.relevance.median >= s.judgement!.relevance.median)), "most relevant first");
  assert.deepEqual(readRun(dir, run.id), run);
  assert.equal(readRun(dir, "../etc"), null);
  assert.equal(listRuns(dir, "nightmarketcoder")[0].count, 4);
  assert.deepEqual(listRuns(dir, "cyberbotanist"), []);
  assert.deepEqual(await keepSample(dir, run, logo), { file: logo.original!.file, kind: "original" });
  const button = run.samples.find((s) => s.foundBy.includes("button"))!;
  assert.deepEqual(await keepSample(dir, run, button), { file: button.crop, kind: "crop" });

  const unread = await sampleSite({ url: "https://example.com", persona: basePersonas.nightmarketcoder, lookFor: ["logo", "button"], dir, read: false, capture, regions: regions as any, reader: fake });
  assert.ok(unread.samples.every((s) => !s.judgement));
  assert.match(unread.notes.at(-1)!, /Clairic isn't configured/);
  assert.equal(original({ x: 0, y: 0, w: 10, h: 10 }, []), undefined);
  assert.ok(readFileSync(join(dir, run.id, run.screenshot)).length > 0);
});
