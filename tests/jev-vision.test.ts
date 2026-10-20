import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Resvg } from "@resvg/resvg-js";
import { evaluateWithTypeSafe, IMAGES_HEADER, TASTE_WEIGHT, featureQuestions } from "../dist/src/evaluation/typesafe-judge.js";
import { createScorer, evaluateBatch } from "../dist/src/evaluation/judge.js";
import { loadExamples, loadReferences } from "../dist/src/evaluation/visual-context.js";
import { appendFeedback } from "../dist/src/evaluation/feedback-memory.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import { fitStill, stillFromBuffer, svgBoard, videoFrames, STILL_MAX_SIDE, STILL_MIN_SIDE } from "../dist/src/shared/stills.js";
import { parseImageDimensions } from "../dist/src/shared/img-dims.js";

const persona = basePersonas.cyberbotanist;
const hasFfmpeg = [spawnSync("ffmpeg", ["-version"]), spawnSync("ffprobe", ["-version"])].every(r => r.status === 0);

function dir(t: TestContext) {
  const path = mkdtempSync(join(tmpdir(), "baste-vision-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

/** A real PNG of the given size: a warm field with a cool disc. */
function png(width: number, height: number, fill = "#d9772b"): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="#2b6fd9"/></svg>`;
  return new Resvg(svg).render().asPng();
}

interface Sent { url: string; headers: Record<string, string>; json: any; images: Map<string, Uint8Array>; contentType?: string }

/** Read a request the judge sent: JSON, or multipart with its image parts. */
async function read(url: string, init: RequestInit): Promise<Sent> {
  const headers = { ...(init.headers as Record<string, string>) };
  if (typeof init.body === "string") return { url, headers, json: JSON.parse(init.body), images: new Map() };
  const contentType = headers["Content-Type"];
  const form = await new Response(init.body as Blob, { headers: { "Content-Type": contentType } }).formData();
  const images = new Map<string, Uint8Array>();
  let json: any;
  for (const [name, value] of form.entries()) {
    if (name === "request") json = JSON.parse(typeof value === "string" ? value : await value.text());
    else images.set(name, new Uint8Array(await (value as Blob).arrayBuffer()));
  }
  return { url, headers, json, images, contentType };
}

/** Valid answers for whatever questions were asked; `pick` overrides by question id. */
function answer(questions: Record<string, any>, pick: Record<string, number | string> = {}) {
  const answers: Record<string, unknown> = {};
  for (const [id, q] of Object.entries(questions)) {
    if (q.type === "score") {
      const top = q.criteria.length - 1;
      const level = Math.min(top, typeof pick[id] === "number" ? pick[id] as number : top);
      answers[id] = {
        type: "score", score: level, confidence: 0.9,
        probabilities: Object.fromEntries(q.criteria.map((_: unknown, i: number) => [String(i), i === level ? 1 : 0])),
        legend: Object.fromEntries(q.criteria.map((c: unknown, i: number) => [String(i), c])),
      };
    } else if (q.type === "noul") {
      answers[id] = { type: "noul", noul: typeof pick[id] === "number" ? pick[id] : 0.1 };
    } else if (q.type === "choice") {
      const options = Object.keys(q.criteria);
      const choice = typeof pick[id] === "string" ? pick[id] as string : options[0];
      answers[id] = { type: "choice", choice, confidence: 0.8, probabilities: Object.fromEntries(options.map(o => [o, o === choice ? 1 : 0])) };
    }
  }
  return answers;
}

/** A fake TypeSafe that records each request and answers every question asked. */
function jev(t: TestContext, reply: (sent: Sent) => Response | Promise<Response> = sent => Response.json({ model: "jev-1.13.0", answers: answer(sent.json.questions) })) {
  const sent: Sent[] = [];
  const before = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = await read(String(input), init ?? {});
    sent.push(request);
    return reply(request);
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = before; });
  return sent;
}

/** Every asset referenced in the JSON, every part used once, every image inside TypeSafe's limits. */
function assertValidImageRequest(sent: Sent) {
  assert.equal(sent.headers[IMAGES_HEADER], "true");
  assert.match(sent.contentType ?? "", /^multipart\/form-data; boundary=/);
  const { assets, ...rest } = sent.json;
  const text = JSON.stringify(rest);
  const parts = new Set<string>();
  for (const [reference, asset] of Object.entries(assets as Record<string, { type: string; part: string }>)) {
    assert.ok(text.includes(reference), `asset ${reference} is referenced`);
    assert.equal(asset.type, "image");
    assert.ok(!parts.has(asset.part), "each part belongs to one asset");
    parts.add(asset.part);
    const bytes = sent.images.get(asset.part);
    assert.ok(bytes, `part ${asset.part} was uploaded`);
    const size = parseImageDimensions(bytes!);
    assert.equal(size?.format, "png", "lossless PNG");
    assert.ok(size!.width >= 280 && size!.width <= 1568 && size!.height >= 280 && size!.height <= 1568, `${size!.width}x${size!.height} within 280–1568`);
    assert.ok(size!.width * size!.height <= 2_458_624);
  }
  assert.equal(parts.size, sent.images.size, "no unused parts");
}

test("Image candidates are sent as pixels, with the looking rubric and QD axes read from the image", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(2400, 1028));
  const sent = jev(t, s => Response.json({ model: "jev-1.13.0", answers: answer(s.json.questions, { temperature: 3, density: 1, abstraction: 2 }) }));
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "Warm forest", content: path, purpose: "hero" }, { apiKey: "mock" });
  assert.equal(sent.length, 1);
  assertValidImageRequest(sent[0]);
  const { state, questions, model } = sent[0].json;
  assert.equal(model, "jev-latest");
  assert.match(state.candidate.view, /^<image candidate [0-9a-f-]{36}>$/);
  assert.match(state.evidence, /rendered asset/);
  assert.match(questions.visualQuality.instructions, /candidate\.view/);
  assert.doesNotMatch(questions.visualQuality.instructions, /Do not claim to see/);
  for (const id of ["temperature", "density", "abstraction", "showsText", "violatesPetPeeve"]) assert.ok(questions[id], id);
  assert.equal(result.typesafe?.evidence, "image");
  assert.deepEqual(result.typesafe?.visual?.shown, { candidate: 1, references: 0, suite: 0, liked: 0, disliked: 0 });
  // Level indices map linearly onto the archive's ranges.
  assert.deepEqual(result.features, [0.5, 0.25, 0.5]);
  assert.equal(result.typesafe?.visual?.features?.temperature.score, 3);
  assert.equal(result.gate?.accepted, true);
  assert.ok(result.tags.includes("image"));
  assert.match(result.feedback, /looked at the rendered asset/);
});

test("SVG candidates are rendered on light and dark grounds at icon sizes, and lettering is not policed", async t => {
  const path = join(dir(t), "icon.svg");
  writeFileSync(path, '<svg viewBox="0 0 24 24"><path d="M2 2L22 22" stroke="#2b6fd9" stroke-width="3"/></svg>');
  const sent = jev(t);
  const result = await evaluateWithTypeSafe(persona, { assetType: "svg", prompt: "Root icon", content: path, purpose: "icon" }, { apiKey: "mock" });
  assertValidImageRequest(sent[0]);
  const { state, questions } = sent[0].json;
  assert.match(state.candidate.viewNote, /light ground .* dark ground/);
  assert.match(state.candidate.source, /^<svg/);
  const board = sent[0].images.get(sent[0].json.assets[state.candidate.view].part)!;
  assert.deepEqual(parseImageDimensions(board), { width: 1024, height: 512, format: "png" });
  assert.equal(questions.showsText, undefined);
  assert.equal(result.typesafe?.visual?.text, undefined);
});

test("Persona references, the rendered suite and rated examples go in as images; taste nudges alignment", async t => {
  const root = dir(t);
  const hero = join(root, "hero.png");
  writeFileSync(hero, png(1024, 576, "#3b7d4f"));
  const candidate = join(root, "background.png");
  writeFileSync(candidate, png(1024, 576));
  const still = (await stillFromBuffer(png(600, 400)))!;
  const context = {
    references: [{ still, origin: "moodboard pin", note: "greenhouse at dusk" }, { still, origin: "culture reference" }],
    examples: {
      image: { liked: [{ still, origin: "upvoted asset", note: "the moss glow" }], disliked: [{ still, origin: "downvoted asset" }, { still, origin: "downvoted asset" }] },
      svg: { liked: [], disliked: [] },
    },
  };
  const suite = [{ type: "image", purpose: "hero", prompt: "Greenhouse hero", path: hero }, { type: "video", purpose: "loop", prompt: "Spores", path: join(root, "missing.mp4") }];
  const sent = jev(t, s => Response.json({ model: "jev-1.13.0", answers: answer(s.json.questions, { personaAlignment: 2, matchesTaste: 1 }) }));
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "Moss", content: candidate, purpose: "background", suite, judgeContext: context }, { apiKey: "mock" });
  assertValidImageRequest(sent[0]);
  const { state, questions } = sent[0].json;
  assert.equal(state.persona.references.length, 2);
  assert.equal(state.persona.references[0].from, "moodboard pin");
  assert.equal(state.persona.references[0].note, "greenhouse at dusk");
  assert.match(state.persona.references[0].image, /^<image moodboard-pin /);
  assert.match(state.suite[0].image, /^<image suite /);
  assert.equal(state.suite[0].path, undefined, "local paths are not sent");
  assert.equal(state.suite[1].image, undefined, "videos in the suite stay as text");
  assert.equal(questions.matchesTaste.type, "noul");
  assert.equal(questions.matchesTaste.criteria.true.examples.length, 1);
  assert.equal(questions.matchesTaste.criteria.false.examples.length, 2);
  assert.equal(sent[0].images.size, 1 + 2 + 1 + 3);
  assert.deepEqual(result.typesafe?.visual?.shown, { candidate: 1, references: 2, suite: 1, liked: 1, disliked: 2 });
  assert.equal(result.typesafe?.visual?.taste, 1);
  assert.equal(result.typesafe?.scores.personaAlignment.score, 2);
  assert.equal(result.criteria.personaAlignment, 0.5 + TASTE_WEIGHT);
  assert.match(result.feedback, /beside 2 reference images/);
});

test("Taste is only asked when there are both upvoted and downvoted examples of the same kind", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(800, 600));
  const still = (await stillFromBuffer(png(400, 400)))!;
  const sent = jev(t);
  const context = { references: [], examples: { image: { liked: [{ still, origin: "upvoted asset" }], disliked: [] }, svg: { liked: [{ still, origin: "upvoted asset" }], disliked: [{ still, origin: "downvoted asset" }] } } };
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: path, judgeContext: context }, { apiKey: "mock" });
  assert.equal(sent[0].json.questions.matchesTaste, undefined);
  assert.equal(result.typesafe?.visual?.taste, undefined);
});

test("Overlaid text rejects an image at the policy threshold, even with perfect scores", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(800, 600));
  jev(t, s => Response.json({ model: "jev-1.13.0", answers: answer(s.json.questions, { showsText: 0.85 }) }));
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: path }, { apiKey: "mock" });
  assert.equal(result.gate?.accepted, false);
  assert.match(result.gate?.reason ?? "", /text/);
  assert.equal(result.overall, 0);
  assert.equal(createScorer()(result), Number.NEGATIVE_INFINITY);
  assert.ok(result.tags.includes("text-rejected"));
});

test("A refused image request is judged again as text and says so", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(800, 600));
  let n = 0;
  const sent = jev(t, s => n++ === 0 ? Response.json({ error: "images are not enabled" }, { status: 400 }) : Response.json({ model: "jev-1.13.0", answers: answer(s.json.questions) }));
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "Warm forest", content: path }, { apiKey: "mock" });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].headers[IMAGES_HEADER], "true");
  assert.equal(sent[1].headers[IMAGES_HEADER], undefined);
  assert.equal(sent[1].json.state.candidate.view, undefined);
  assert.match(sent[1].json.questions.visualQuality.instructions, /Do not claim to see/);
  assert.equal(result.typesafe?.evidence, "text-only");
  assert.ok(result.tags.includes("vision-refused"));
  assert.match(result.feedback, /refused the images \(400\)/);
});

test("A refused full request is retried with the candidate alone before falling back to text", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(800, 600));
  const still = (await stillFromBuffer(png(400, 300)))!;
  const context = { references: [{ still, origin: "moodboard pin" }, { still, origin: "culture reference" }], examples: { image: { liked: [{ still, origin: "upvoted asset" }], disliked: [{ still, origin: "downvoted asset" }] }, svg: { liked: [], disliked: [] } } };
  let n = 0;
  const sent = jev(t, s => n++ === 0 ? Response.json({ error: "max_tokens_exceeded" }, { status: 400 }) : Response.json({ model: "jev-1.13.0", answers: answer(s.json.questions) }));
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: path, judgeContext: context }, { apiKey: "mock" });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].images.size, 5);
  assertValidImageRequest(sent[1]);
  assert.equal(sent[1].images.size, 1);
  assert.equal(sent[1].json.state.persona.references, undefined);
  assert.equal(sent[1].json.questions.matchesTaste, undefined);
  assert.equal(result.typesafe?.evidence, "image");
  assert.deepEqual(result.typesafe?.visual?.shown, { candidate: 1, references: 0, suite: 0, liked: 0, disliked: 0 });
  assert.ok(result.tags.includes("vision-reduced"));
  assert.match(result.feedback, /refused the full request \(400\), so it saw the candidate alone/);
});

test("Other image failures still fail the judgment", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(800, 600));
  jev(t, () => Response.json({ error: "private" }, { status: 401 }));
  await assert.rejects(evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: path }, { apiKey: "mock" }), /^Error: TypeSafe judge API error 401$/);
});

test("vision: false and unreadable files keep the text-only contract", async t => {
  const root = dir(t);
  const path = join(root, "hero.png");
  writeFileSync(path, png(800, 600));
  const garbage = join(root, "mock.png");
  writeFileSync(garbage, "mock PNG");
  const sent = jev(t);
  const off = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: path }, { apiKey: "mock", vision: false });
  const unreadable = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: garbage }, { apiKey: "mock" });
  for (const request of sent) {
    assert.equal(request.images.size, 0);
    assert.equal(request.headers[IMAGES_HEADER], undefined);
    assert.equal(Object.keys(request.json.questions).length, 6);
  }
  assert.equal(off.typesafe?.evidence, "text-only");
  assert.equal(unreadable.typesafe?.evidence, "text-only");
  assert.equal(off.typesafe?.visual, undefined);
});

test("Hosted judgement never uploads images", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(800, 600));
  let body: unknown;
  const result = await evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: path }, {
    provider: "notorganic", model: "judgement",
    notOrganicFetch: async (_path, init) => {
      body = init?.body;
      const request = JSON.parse(String(init?.body));
      return Response.json({ model: "jev-resolved", answers: answer(request.questions) });
    },
  });
  assert.equal(typeof body, "string");
  assert.equal(result.typesafe?.evidence, "text-only");
});

test("Malformed visual answers are rejected", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(800, 600));
  jev(t, s => {
    const answers = answer(s.json.questions) as any;
    answers.temperature.score = 9;
    return Response.json({ model: "jev-1.13.0", answers });
  });
  await assert.rejects(evaluateWithTypeSafe(persona, { assetType: "image", prompt: "x", content: path }, { apiKey: "mock" }), /TypeSafe returned invalid temperature score/);
});

test("Videos are judged on sampled frames with motion-style, seam and calm questions", { skip: !hasFfmpeg && "needs ffmpeg" }, async t => {
  const path = join(dir(t), "loop.mp4");
  const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=duration=2:size=480x270:rate=12", "-pix_fmt", "yuv420p", path]);
  assert.equal(made.status, 0);
  const sent = jev(t, s => Response.json({ model: "jev-1.13.0", answers: answer(s.json.questions, { motionStyle: "snappy", seamless: 0.2, calm: 1, showsText: 0.3 }) }));
  const result = await evaluateWithTypeSafe(persona, { assetType: "video", prompt: "Spores drifting", content: path, purpose: "ambient-loop" }, { apiKey: "mock" });
  assertValidImageRequest(sent[0]);
  const { state, questions } = sent[0].json;
  assert.equal(state.candidate.frames.length, 6);
  assert.deepEqual(state.candidate.frames.map((f: any) => f.seconds), [...state.candidate.frames.map((f: any) => f.seconds)].sort((a: number, b: number) => a - b));
  assert.ok(state.candidate.frames.at(-1).seconds < 2);
  assert.deepEqual(Object.keys(questions.motionStyle.criteria), ["smooth", "snappy", "liquid", "mechanical"]);
  assert.match(questions.visualQuality.instructions, /candidate\.frames/);
  assert.equal(questions.temperature, undefined, "QD axes are read from stills only");
  assert.equal(result.typesafe?.evidence, "frames");
  const motion = result.typesafe?.visual?.motion;
  assert.equal(motion?.style.choice, "snappy");
  assert.equal(motion?.style.expected, "smooth");
  assert.equal(motion?.seamless, 0.2);
  assert.ok(result.improvements.some(line => /Move as smooth motion/.test(line)));
  assert.ok(result.improvements.some(line => /last frame to its first/.test(line)));
  assert.ok(result.improvements.some(line => /Slow the motion/.test(line)));
  assert.equal(result.gate?.accepted, true, "motion advice does not reject");
});

test("Frames and WebP stills survive odd sizes and low frame rates, and only local files reach ffmpeg", { skip: !hasFfmpeg && "needs ffmpeg" }, async t => {
  const root = dir(t);
  // 960×542 fits to 512×289, an odd height; at 8 fps the final frame starts 0.125 s before the end.
  const video = join(root, "odd.mp4");
  assert.equal(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=duration=1:size=960x542:rate=8", "-pix_fmt", "yuv420p", video]).status, 0);
  const frames = await videoFrames(video);
  assert.equal(frames.length, 6);
  for (const frame of frames) assert.deepEqual(parseImageDimensions(frame.still.data), { width: 512, height: 289, format: "png" });
  assert.ok(frames[5].seconds > frames[4].seconds && frames[5].seconds <= 0.875, "the last sample lands in the final frame");
  const webp = join(root, "odd.webp");
  assert.equal(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1025x577", "-frames:v", "1", webp]).status, 0);
  const still = (await stillFromBuffer(readFileSync(webp)))!;
  assert.deepEqual([still.format, still.width, still.height], ["png", 1024, 576]);
  for (const input of ["https://example.com/loop.mp4", "concat:a.mp4|b.mp4", root]) assert.deepEqual(await videoFrames(input), []);
});

test("SVG stills never draw files outside the SVG", async t => {
  const local = join(dir(t), "private.png");
  writeFileSync(local, png(400, 300, "#ff00ff"));
  const frame = (image: string) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:a="http://www.w3.org/1999/xlink" width="400" height="300"><rect width="400" height="300" fill="#ffffff"/>${image}</svg>`;
  const clean = (await stillFromBuffer(Buffer.from(frame(""))))!;
  for (const image of [
    `<image width="400" height="300" href="${local}"/>`,
    `<image width="400" height="300" a:href='${local}'/>`,
    `<image width="400" height="300" href="&#47;${local.slice(1)}"/>`,
    `<filter id="f"><feImage href="${local}"/></filter><rect width="400" height="300" filter="url(#f)"/>`,
  ]) {
    const still = (await stillFromBuffer(Buffer.from(frame(image))))!;
    assert.deepEqual(still.data, clean.data, image);
  }
  assert.ok(svgBoard(frame(`<image width="400" height="300" href="${local}"/>`)));
  // Inline images and fragment references still draw.
  const inline = (await stillFromBuffer(Buffer.from(frame(`<image width="400" height="300" href="data:image/png;base64,${png(400, 300, "#ff00ff").toString("base64")}"/>`))))!;
  assert.notDeepEqual(inline.data, clean.data);
});

test("Stills always land inside TypeSafe's size limits", () => {
  for (const [w, h] of [[24, 24], [100, 4000], [4000, 100], [8000, 8000], [1568, 1568], [281, 9000], [1024, 1024], [2560, 1097]]) {
    const fit = fitStill(w, h, 1024);
    for (const side of [fit.canvasWidth, fit.canvasHeight]) assert.ok(side >= STILL_MIN_SIDE && side <= STILL_MAX_SIDE, `${w}x${h} → ${fit.canvasWidth}x${fit.canvasHeight}`);
    assert.ok(fit.width <= fit.canvasWidth && fit.height <= fit.canvasHeight);
    // The aspect ratio survives the fit.
    if (Math.max(w, h) / Math.min(w, h) < 5) assert.ok(Math.abs(fit.width / fit.height - w / h) < 0.02 * (w / h));
  }
});

test("Stills read PNG, JPEG and namespace-less SVG; other bytes are refused", async () => {
  const tiny = (await stillFromBuffer(png(40, 30)))!;
  assert.ok(tiny.width >= 280 && tiny.height >= 280);
  const svg = (await stillFromBuffer(Buffer.from('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>')))!;
  assert.deepEqual([svg.width, svg.height], [1024, 1024]);
  assert.equal(await stillFromBuffer(Buffer.from("mock PNG")), undefined);
  assert.equal(svgBoard("not svg"), undefined);
  assert.deepEqual(await videoFrames("/nonexistent/loop.mp4"), []);
});

test("Rated examples come from the latest rating of assets still on disk, grouped by kind", async t => {
  const root = dir(t);
  const before = process.cwd();
  process.chdir(root);
  t.after(() => process.chdir(before));
  const out = join(root, "out");
  mkdirSync(join(out, "images"), { recursive: true });
  mkdirSync(join(out, "svg"), { recursive: true });
  writeFileSync(join(out, "images", "a.png"), png(640, 360));
  writeFileSync(join(out, "images", "b.png"), png(640, 360));
  writeFileSync(join(out, "images", "c.png"), png(640, 360));
  writeFileSync(join(out, "svg", "icon.svg"), '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>');
  const rate = (assetId: string, score: number, feedback = "") => appendFeedback({ personaId: "cyberbotanist", assetId, score, feedback, ts: Date.now() });
  rate("a", 1, "first liked");
  rate("a", -1, "changed my mind");
  rate("b", 1, "glow");
  rate("c", 0);
  rate("icon", -1);
  rate("gone", 1);
  rate("../escape", 1);
  const examples = await loadExamples("cyberbotanist", out);
  assert.deepEqual(examples.image.liked.map(e => e.note), ["glow"]);
  assert.deepEqual(examples.image.disliked.map(e => e.note), ["changed my mind"]);
  assert.equal(examples.svg.disliked.length, 1);
  assert.equal(examples.svg.liked.length, 0);
});

test("References put pins first, skip tiny and failing sources, and stop at the limit", async t => {
  const root = dir(t);
  const before = process.cwd();
  process.chdir(root);
  t.after(() => process.chdir(before));
  mkdirSync(join(root, ".baste"), { recursive: true });
  // Public IP literals: no DNS, and the safe fetcher's private-network checks still apply.
  const board = { personaId: "cyberbotanist", notes: "", vibe: [], references: [
    { id: "1", src: "http://93.184.216.34/old-unpinned.png", tags: [], pinned: false, addedAt: 1 },
    { id: "2", src: "http://93.184.216.34/pin.png", tags: ["moss", "https://source.example"], pinned: true, addedAt: 2 },
    { id: "3", src: "http://93.184.216.34/favicon.png", tags: [], pinned: true, addedAt: 3 },
    { id: "4", src: "http://93.184.216.34/broken.png", tags: [], pinned: true, addedAt: 4 },
    { id: "5", src: "http://127.0.0.1/private.png", tags: [], pinned: true, addedAt: 5 },
    { id: "6", src: "data:image/png;base64,AAAA", tags: [], pinned: true, addedAt: 6 },
  ] };
  writeFileSync(join(root, ".baste", "moodboards.json"), JSON.stringify([["cyberbotanist", board]]));
  const fetched: string[] = [];
  const beforeFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    fetched.push(url);
    if (url.endsWith("/favicon.png")) return new Response(png(32, 32));
    if (url.endsWith("/broken.png")) return new Response("nope", { status: 404 });
    return new Response(png(640, 480));
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = beforeFetch; });
  const references = await loadReferences(persona, 2);
  assert.deepEqual(references.map(r => r.origin), ["moodboard pin", "moodboard reference"]);
  assert.equal(references[0].note, "moss");
  assert.ok(!fetched.some(url => url.includes("127.0.0.1")));
});

test("evaluateBatch passes the run's visual context through to Jev", async t => {
  const path = join(dir(t), "hero.png");
  writeFileSync(path, png(800, 600));
  const still = (await stillFromBuffer(png(400, 300)))!;
  const sent = jev(t);
  await evaluateBatch(persona, [{ type: "image", prompt: "x", content: path, judgeContext: { references: [{ still, origin: "moodboard pin" }], examples: { image: { liked: [], disliked: [] }, svg: { liked: [], disliked: [] } } } }],
    async () => { throw new Error("OpenAI must not run"); }, { provider: "typesafe", apiKey: "mock" });
  assert.equal(sent[0].json.state.persona.references.length, 1);
});

test("Feature levels describe the same ordered steps the prompt mutates along", () => {
  assert.equal(featureQuestions.temperature.criteria.length, 5);
  assert.equal(featureQuestions.density.criteria.length, 5);
  assert.equal(featureQuestions.abstraction.criteria.length, 5);
  assert.match(featureQuestions.abstraction.criteria[0], /^Photographic/);
  assert.match(featureQuestions.abstraction.criteria[4], /^Abstract/);
});
