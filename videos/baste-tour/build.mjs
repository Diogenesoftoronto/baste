#!/usr/bin/env node
/**
 * Builds the Baste tour: index.html (the HyperFrames composition), captions.vtt
 * and captions.fr.vtt (French lines from narration/captions.fr.json),
 * and the levelled voice lines in assets/voice/.
 *
 * Inputs
 *   narration/timing.json, narration/words.json  scripts/narrate-tour.mjs
 *   music/bed.mp3                                 scripts/score-tour.mjs
 *   footage/cfr/*.mp4                             scripts/record-tour.mjs, then 30 fps copies
 *
 * The edit is written as source ranges into the recordings, so a re-recorded
 * take only needs its offsets checked against footage/clips.json. Kinetic
 * type keys off word timings, so a re-voiced line moves its own beats.
 *
 *   node build.mjs && npx --yes hyperframes@0.8.145 check
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const json = (p) => JSON.parse(readFileSync(join(here, p), "utf8"));
const timing = json("narration/timing.json");
const words = json("narration/words.json");

const W = 1440; // recording size: the stage shows it 1:1
const H = 900;
const END = 74; // narration is 69.333 s; the end card holds the rest
const r3 = (n) => Math.round(n * 1000) / 1000;

/* ── word timings ─────────────────────────────────────────────────────── */

const byScene = Object.fromEntries(words.scenes.map((s) => [s.id, s.words]));
const bare = (t) => t.toLowerCase().replace(/[^a-z0-9’'-]/g, "");
function at(scene, text, nth = 0) {
  const hit = byScene[scene].filter((w) => bare(w.text) === text)[nth];
  if (!hit) throw new Error(`No word “${text}” (#${nth}) in ${scene}`);
  return r3(hit.start);
}
const T = {
  aged: at("why", "aged"), nobody: at("why", "nobody"), bracket: at("why", "bracket"),
  taste: at("why", "taste"), a: at("why", "a"), person: at("why", "person"), does: at("why", "does"),
  starts: at("measure", "starts"), films: at("measure", "films"), music: at("measure", "music"),
  rooms: at("measure", "rooms"), things: at("measure", "things"),
  layout: at("fitting", "layout"), type: at("fitting", "type"), colour: at("fitting", "colour"), motion: at("fitting", "motion"),
  tries: at("baste", "tries"), warm: at("baste", "warm"), sparse: at("baste", "sparse"), judge: at("baste", "judge"),
  keeps: at("fit", "keeps"), range: at("fit", "range"),
  images: at("cut", "images"), vector: at("cut", "vector"), ambient: at("cut", "ambient"), design: at("cut", "design"),
  ask: at("talk", "ask"), what: at("talk", "what"),
  bring: at("yours", "bring"), studio: at("yours", "studio"),
};

/* ── the edit ─────────────────────────────────────────────────────────── */

// Each take is shown from `from` (source seconds) at `rate`. A segment with
// `from` omitted continues the previous one, so speed changes are seamless.
// Event notes are source times read off the 30 fps copies (footage/clips.json).
const SEGMENTS = [
  // Moss → Ren at 6.47 → Ada at 10.23; Moss returns at 14.07, so stop before it.
  { id: "fitting", src: "fitting", start: 18.85, end: 27.32, from: 3.62, rate: 1.23 },
  // Dry run unticked 7.6–8.6, Cut pressed at 9.9 (lands on “tries”).
  { id: "archA", src: "archive", start: 26.85, end: 29.5, from: 9.9 - (T.tries + 0.05 - 26.85) * 1.5, rate: 1.5 },
  // Log streams, map fills: cells land 12.67 … 25.9.
  { id: "archB", src: "archive", start: 29.5, end: 34.18, rate: (26.3 - 10.35) / (34.18 - 29.5) },
  // Last judged lines, then “Finished” at 28.4.
  { id: "archC", src: "archive", start: 34.18, end: 37.45, rate: 1 },
  // Loupe 12.43, kept circles 12.5–13.8, settled from 14.3.
  { id: "method", src: "method", start: 36.7, end: 41.75, from: 11.25, rate: 1 },
  // The cut, after the replay toast has gone (it leaves at 31.5).
  { id: "archCut", src: "archive", start: 44.95, end: 47.75, from: 31.6, rate: 1 },
  // CSS until 4.40, Tailwind until 7.20, then Panda: slow, fast, real time.
  { id: "tok1", src: "tokens", start: 50.45, end: 52.45, from: 3.6, rate: 0.4 },
  { id: "tok2", src: "tokens", start: 52.45, end: 53.18, rate: (7.15 - 4.4) / (53.18 - 52.45) },
  { id: "tok3", src: "tokens", start: 53.18, end: 55.4, rate: 1 },
  // “What are you into?” sent 8.95; “Why these colours?” 13.5; palette 14.95.
  { id: "talk", src: "talk", start: 54.88, end: 64.0, from: 7.5 - (54.933 - 54.88), rate: 1 },
  // Name typed 5.1–7.5, summary 10.0–13.9.
  { id: "yours", src: "yours", start: 63.5, end: 70.2, from: 5.0 - (63.9 - 63.5) * 1.6, rate: 1.6 },
];
const CONTINUES = new Set(SEGMENTS.filter((s) => s.from === undefined).map((s) => s.id));
const LENGTH = { fitting: 16.93, method: 17.23, archive: 35.93, tokens: 12.83, talk: 17.03, yours: 16.53 };
for (const [i, s] of SEGMENTS.entries()) {
  if (s.from === undefined) {
    const p = SEGMENTS[i - 1];
    s.from = p.from + (s.start - p.start) * p.rate;
  }
  s.from = r3(s.from);
  s.rate = r3(s.rate);
  s.until = r3(s.from + (s.end - s.start) * s.rate);
  if (s.from < 3.6) throw new Error(`${s.id} starts at ${s.from}s, inside the dev overlay`);
  if (s.until + 0.1 * s.rate > LENGTH[s.src]) throw new Error(`${s.id} runs past its take (${s.until}s)`);
}
const seg = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));

// Wipes between chapters: the next take lays over the last like a new panel.
const WIPE = 0.45;
const WIPES = [
  ["#w-archA", 26.85], ["#w-method", 36.7], ["#spread", 41.25], ["#w-archCut", 44.95],
  ["#look", 47.2], ["#w-tok1", 50.45], ["#w-talk", 54.88], ["#w-yours", 63.5],
];

/* ── kept drafts (Moss's archive, 24 judged) ──────────────────────────── */

// Labelled the way the method page labels a cell (method-run.tsx `direction`).
const direction = ([t, d]) =>
  `${t <= -0.33 ? "cool" : t >= 0.33 ? "warm" : "neutral"} and ${d >= 0.75 ? "dense" : d <= 0.35 ? "sparse" : "balanced"}`;
const KEPT = [
  ["c23", 0.883, [-0.7, 0.7]], ["c21", 0.922, [-0.5, 0.8]], ["c16", 0.924, [-0.2, 0.8]], ["c17", 0.89, [0.1, 0.8]],
  ["c15", 0.925, [0.5, 0.8]], ["c14", 0.883, [0.8, 0.7]], ["c03", 0.916, [0.8, 0.9]], ["c02", 0.924, [0.9, 0.8]],
];

/* ── voice lines, levelled to −16 LUFS ────────────────────────────────── */

function levelVoice() {
  mkdirSync(join(here, "assets/voice"), { recursive: true });
  for (const s of timing.scenes) {
    const out = join(here, `assets/voice/${s.id}.mp3`);
    const src = join(here, `narration/${s.id}.mp3`);
    // Re-level whenever the narration is newer, so a new voice can never be skipped.
    if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) continue;
    const target = "I=-16:TP=-1.5:LRA=11";
    const probe = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", src, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
    const m = JSON.parse(probe.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
    const pass = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    const done = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", src, "-af", pass, "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "192k", out]);
    if (done.status !== 0) throw new Error(`ffmpeg failed on ${s.id}: ${done.stderr}`);
  }
}

/* ── captions.vtt ─────────────────────────────────────────────────────── */

function vtt() {
  const stamp = (t) => {
    const ms = Math.round(t * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
    const m = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
    const s = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
    return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
  };
  // A run of more than nine words breaks before an opening quote, then a conjunction,
  // then a relative word, whichever leaves the two halves closest in length.
  const BREAKS = [/^[“"]/, /^(and|or|but|so|before|after|because|while)$/i, /^(what|which|that|when|where|who)$/i];
  const chars = (g) => g.reduce((n, w) => n + w.text.length + 1, -1);
  const split = (g) => {
    if (g.length <= 9) return [g];
    let at = Math.ceil(g.length / 2);
    for (const rule of BREAKS) {
      const options = g.map((w, i) => i).filter((i) => i >= 2 && i <= g.length - 2 && rule.test(g[i].text));
      if (options.length) { at = options.reduce((a, b) => (Math.abs(chars(g.slice(0, b)) - chars(g.slice(b))) < Math.abs(chars(g.slice(0, a)) - chars(g.slice(a))) ? b : a)); break; }
    }
    return [...split(g.slice(0, at)), ...split(g.slice(at))];
  };
  const cues = [];
  for (const scene of words.scenes) {
    let group = [];
    const flush = () => { if (group.length) cues.push(...split(group)); group = []; };
    for (const w of scene.words) {
      group.push(w);
      const full = /[.!?][”"]?$/.test(w.text);
      const pause = /[,:;—][”"]?$/.test(w.text);
      if (full || (pause && group.length >= 4)) flush();
    }
    flush();
  }
  const lines = ["WEBVTT", ""];
  cues.forEach((g, i) => {
    const next = cues[i + 1]?.[0].start ?? Infinity;
    const end = Math.min(g.at(-1).end + 0.35, next - 0.02);
    // Centred under the stage (x 432–1872 of 1920) rather than the whole frame, so cues never cross the rail.
    lines.push(String(i + 1), `${stamp(g[0].start)} --> ${stamp(end)} position:60% align:center size:70%`, g.map((w) => w.text).join(" "), "");
  });
  return lines.join("\n");
}

/* ── markup ───────────────────────────────────────────────────────────── */

const MARK = (id, size) => `
  <svg class="mark" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs><mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
      <path id="${id}-mp" d="M24.4 7.6 C 29 12, 25 18, 18 19 S 7 22, 5 29" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    </mask></defs>
    <path id="${id}-needle" d="M6 26 L25.5 6.5" stroke="#1C1B19" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse id="${id}-eye" cx="24" cy="8" rx="1.1" ry="2.6" transform="rotate(45 24 8)" fill="#F1ECE2" stroke="#1C1B19" stroke-width="1.2"/>
    <path d="M24.4 7.6 C 29 12, 25 18, 18 19 S 7 22, 5 29" stroke="#D2402A" stroke-width="2" stroke-linecap="round" stroke-dasharray="3.4 2.6" mask="url(#${id}-m)"/>
  </svg>`;

// A take followed by its own continuation runs a few frames long under it, so
// the cut can never land on an empty frame.
const tail = (s) => (CONTINUES.has(SEGMENTS[SEGMENTS.indexOf(s) + 1]?.id) ? 0.1 : 0);
const video = (s, extra = "") =>
  `<video id="v-${s.id}" src="footage/cfr/${s.src}.mp4" muted playsinline data-start="${s.start}" data-duration="${r3(s.end - s.start + tail(s))}" data-media-start="${s.from}" data-playback-rate="${s.rate}" data-track-index="2"${extra}></video>`;

// `overlays` ride the camera; `fixed` sits on the stage glass above it.
const take = (id, overlays = "", fixed = "") => `
      <div class="seg" id="w-${id}"><div class="cam" id="c-${id}">
        ${video(seg[id])}${overlays}
      </div>${fixed}</div>`;

const box = (id, n, [x, y, w, h]) =>
  `<div class="co" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><span>${n}</span></div>`;

const PEOPLE = [
  ["moss", "Moss", "Fraunces", "Fraunces · 300 ms", ["#a15d3f", "#5a8e3f", "#35f3b5"]],
  ["ren", "Ren", "Dela Gothic One", "Dela Gothic One · 200 ms", ["#e44635", "#ebb230", "#fe12a9"]],
  ["ada", "Ada", "VT323", "VT323 · 400 ms", ["#3db2b2", "#dad59e", "#d658cc"]],
];
const WEIGHTS = [["Persona alignment", 30], ["Visual quality", 20], ["Uniqueness", 20], ["Coherence", 15], ["Usability", 15]];
const CHAPTERS = [
  ["01", "Measure"], ["02", "Fitting room"], ["03", "Baste"], ["04", "Fit"], ["05", "Cut"], ["06", "Talk"], ["07", "Yours"],
];
// Rail chapters: [index into CHAPTERS, start, end].
const RAIL = { fitting: [1, 18.85, 27.1], baste: [2, 26.9, 36.9], fit: [3, 36.75, 44.95], cut: [4, 44.95, 54.9], talk: [5, 54.85, 63.5], yours: [6, 63.45, 69.55] };
const chap = (key, title, lede, body) => {
  const [n, start, end] = RAIL[key];
  return `
    <section class="chap clip" id="ch-${key}" data-start="${start}" data-duration="${r3(end - start)}" data-track-index="5">
      <p class="kicker mono">Chapter ${CHAPTERS[n][0]}</p>
      <h2 class="display">${title}</h2>
      <p class="lede">${lede}</p>
      <div class="facts">${body}</div>
    </section>`;
};

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Baste — a tour</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Bodoni Moda"; src: url("assets/fonts/BodoniModa-normal-400-900.woff2") format("woff2"); font-weight: 400 900; font-style: normal; }
      @font-face { font-family: "Bodoni Moda"; src: url("assets/fonts/BodoniModa-italic-400-900.woff2") format("woff2"); font-weight: 400 900; font-style: italic; }
      @font-face { font-family: "Instrument Sans"; src: url("assets/fonts/InstrumentSans-normal-400-700.woff2") format("woff2"); font-weight: 400 700; font-style: normal; }
      @font-face { font-family: "Instrument Sans"; src: url("assets/fonts/InstrumentSans-italic-400-700.woff2") format("woff2"); font-weight: 400 700; font-style: italic; }
      @font-face { font-family: "IBM Plex Mono"; src: url("assets/fonts/IBMPlexMono-normal-400.woff2") format("woff2"); font-weight: 400; }
      @font-face { font-family: "IBM Plex Mono"; src: url("assets/fonts/IBMPlexMono-normal-500.woff2") format("woff2"); font-weight: 500; }
      @font-face { font-family: "Fraunces"; src: url("assets/fonts/Fraunces-400-700.woff2") format("woff2"); font-weight: 400 700; }
      @font-face { font-family: "Dela Gothic One"; src: url("assets/fonts/DelaGothicOne-400.woff2") format("woff2"); font-weight: 400; }
      @font-face { font-family: "VT323"; src: url("assets/fonts/VT323-400.woff2") format("woff2"); font-weight: 400; }

      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #f1ece2; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #f1ece2; color: #1c1b19; font-family: "Instrument Sans", sans-serif; }
      .clip { position: absolute; inset: 0; }
      .display { font-family: "Bodoni Moda", serif; font-weight: 500; letter-spacing: -0.02em; line-height: 0.98; }
      .display em, .em { font-style: italic; color: #a9311e; }
      .mono { font-family: "IBM Plex Mono", monospace; font-weight: 500; font-size: 13px; letter-spacing: 0.16em; text-transform: uppercase; }

      #grid { position: absolute; inset: 0; z-index: 0; background-image: linear-gradient(rgba(28, 27, 25, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(28, 27, 25, 0.045) 1px, transparent 1px); background-size: 48px 48px; background-position: 24px 18px; }
      #logo { position: absolute; left: 72px; top: 84px; z-index: 9; display: flex; align-items: center; gap: 10px; }
      #logo b { font-family: "Bodoni Moda", serif; font-style: italic; font-weight: 600; font-size: 29px; letter-spacing: -0.01em; line-height: 1; }

      /* 0 · why */
      #s-why { z-index: 6; }
      #why-in { position: absolute; inset: 0; }
      #why-card { position: absolute; left: 660px; top: 300px; width: 600px; background: #f7f7f7; border: 1px solid #d6d6d6; border-radius: 10px; box-shadow: 0 24px 50px -28px rgba(0, 0, 0, 0.35); transform-origin: 50% 0; }
      .pc-head { display: flex; justify-content: space-between; padding: 14px 22px; background: #e6e6e6; border-radius: 10px 10px 0 0; color: #555; font-size: 15px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
      .pc-who { display: flex; align-items: center; gap: 18px; padding: 22px 22px 12px; }
      .pc-who svg { flex: 0 0 64px; }
      .pc-who b { display: block; font-size: 26px; font-weight: 600; color: #333; }
      .pc-who span { font-size: 18px; color: #6b6b6b; }
      .pc-rows { padding: 6px 22px 18px; }
      .pc-row { position: relative; display: flex; justify-content: space-between; padding: 11px 6px; border-top: 1px solid #e2e2e2; font-size: 20px; }
      .pc-row span { position: relative; color: #555555; }
      .pc-row b { position: relative; font-weight: 600; color: #333; }
      .pc-row .hl { position: absolute; left: -10px; right: -10px; top: 5px; bottom: 5px; background: rgba(240, 197, 52, 0.8); border-radius: 4px; transform-origin: 0 50%; }
      .why-x { position: absolute; left: 0; top: 0; overflow: visible; }
      #why-head { position: absolute; left: 0; right: 0; top: 596px; text-align: center; font-size: 132px; }
      #why-head .w { display: inline-block; }
      #why-under { position: absolute; left: 0; right: 0; top: 760px; height: 6px; display: flex; justify-content: center; }
      #why-under i { display: block; width: 330px; height: 4px; margin-left: 14px; background: repeating-linear-gradient(90deg, #d2402a 0 18px, transparent 18px 30px); transform-origin: 0 50%; }

      /* 1 · measure */
      #s-measure { z-index: 7; }
      #m-portrait { position: absolute; left: 280px; top: 196px; width: 500px; height: 580px; overflow: hidden; border-radius: 8px; background: #ddd5c6; }
      #m-portrait img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; }
      #m-tape { position: absolute; left: 470px; top: 176px; width: 124px; height: 38px; background: rgba(240, 197, 52, 0.72); }
      #m-caption { position: absolute; left: 280px; top: 800px; width: 500px; }
      #m-caption .mono { color: #a9311e; }
      #m-caption h3 { margin-top: 10px; font-size: 52px; }
      #m-caption p { margin-top: 6px; font-size: 21px; color: #45423c; }
      #m-sheet { position: absolute; left: 900px; top: 176px; width: 860px; }
      #m-ruler { position: relative; height: 30px; transform-origin: 0 50%; background: repeating-linear-gradient(90deg, #1c1b19 0 1.5px, transparent 1.5px 86px) 0 0 / 100% 15px no-repeat, repeating-linear-gradient(90deg, rgba(28, 27, 25, 0.55) 0 1px, transparent 1px 8.6px) 0 0 / 100% 7px no-repeat, #f0c534; }
      #m-ruler span { position: absolute; top: 13px; font-family: "IBM Plex Mono", monospace; font-size: 11px; color: #1c1b19; }
      #m-kicker { margin-top: 34px; color: #a9311e; }
      #m-title { margin-top: 14px; font-size: 86px; }
      .m-row { position: relative; padding: 20px 0 18px; }
      .m-row .rule { position: absolute; left: 0; right: 0; top: 0; height: 1px; background: rgba(28, 27, 25, 0.2); transform-origin: 0 50%; }
      .m-row .in { display: grid; grid-template-columns: 76px 1fr; column-gap: 8px; }
      .m-row .no { grid-row: span 2; color: #a9311e; font-size: 12px; padding-top: 4px; }
      .m-row .lab { color: #6e6a61; font-size: 12px; }
      .m-row .val { margin-top: 8px; font-family: "Bodoni Moda", serif; font-weight: 500; font-size: 36px; line-height: 1.08; letter-spacing: -0.01em; }
      #m-rows { margin-top: 30px; }

      /* the stage: Studio recordings, 1:1 */
      #stage-wrap { position: absolute; left: 432px; top: 90px; width: ${W}px; height: ${H}px; z-index: 3; }
      #stage { position: absolute; inset: 0; overflow: hidden; border-radius: 14px; background: #faf9f2; box-shadow: 0 40px 80px -36px rgba(28, 27, 25, 0.5), 0 0 0 1px rgba(28, 27, 25, 0.12); }
      #stitch { position: absolute; left: -14px; top: -14px; overflow: visible; }
      .seg { position: absolute; inset: 0; }
      .cam { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
      .cam video { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; object-fit: cover; }
      /* the recording ends mid-composer; at close range, fade it into the panel instead of a hard cut */
      .fade { position: absolute; left: 0; right: 0; bottom: 0; height: 112px; opacity: 0; background: linear-gradient(180deg, rgba(246, 245, 238, 0) 0%, #f6f5ee 72%); }
      #seam { position: absolute; left: 0; top: 0; width: 4px; height: ${H}px; z-index: 30; background: repeating-linear-gradient(180deg, #d2402a 0 16px, transparent 16px 26px); }

      .co { position: absolute; border: 2.5px dashed #d2402a; border-radius: 12px; }
      .co span { position: absolute; left: -15px; top: -15px; width: 28px; height: 28px; border-radius: 50%; background: #a9311e; color: #fff; font-family: "IBM Plex Mono", monospace; font-weight: 500; font-size: 15px; line-height: 28px; text-align: center; }
      .ring { position: absolute; border: 3px solid #d2402a; border-radius: 12px; }
      .arrow { position: absolute; overflow: visible; }
      .rot { position: absolute; transform: rotate(-90deg); transform-origin: 0 0; }
      .rot .tag { position: relative; display: block; }
      .tag { position: absolute; padding: 6px 12px 7px; border-radius: 999px; background: #a9311e; color: #fff; font-size: 17px; font-weight: 600; white-space: nowrap; }

      /* 04 · the kept drafts */
      #spread { background: #ebe3d8; padding: 0 52px 24px; display: flex; flex-direction: column; justify-content: center; }
      #spread header { display: flex; align-items: baseline; justify-content: space-between; }
      #spread .mono { color: #a9311e; }
      #spread h3 { font-size: 58px; }
      #prints { margin-top: 40px; display: flex; flex-wrap: wrap; gap: 30px 24px; }
      .print { width: 316px; }
      .print .ph { display: block; width: 316px; height: 237px; padding: 6px; background: #fff; box-shadow: 0 14px 26px -16px rgba(28, 27, 25, 0.55); }
      .print img { display: block; width: 304px; height: 225px; object-fit: cover; }
      .print figcaption { display: flex; justify-content: space-between; margin-top: 12px; font-size: 17px; color: #45423c; }
      .print figcaption b { font-family: "IBM Plex Mono", monospace; font-weight: 500; font-size: 15px; color: #a9311e; }
      #spread-axis { margin-top: 44px; display: flex; align-items: center; gap: 18px; font-size: 17px; font-weight: 600; }
      #spread-axis i { flex: 1; height: 3px; background: linear-gradient(90deg, #2f55a4, #d2402a); transform-origin: 0 50%; }
      #spread-axis .c { color: #2f55a4; }
      #spread-axis .w { color: #a9311e; }

      /* 05 · what comes out */
      #look { position: absolute; inset: 0; background: #f1ece2; padding: 0 28px 24px; display: flex; flex-direction: column; justify-content: center; }
      #look header { display: flex; align-items: baseline; justify-content: space-between; padding: 0 24px; }
      #look .mono { color: #a9311e; }
      #look h3 { font-size: 58px; }
      #lk-grid { margin-top: 38px; display: flex; flex-wrap: wrap; gap: 28px 20px; }
      .lk { width: 448px; }
      .lk .frame { position: relative; display: block; width: 448px; height: 252px; overflow: hidden; border-radius: 10px; background: #fff; box-shadow: 0 16px 30px -20px rgba(28, 27, 25, 0.6); }
      .lk .frame img, .lk .frame video { display: block; width: 448px; height: 252px; object-fit: cover; }
      .lk .frame.icon { display: flex; align-items: center; justify-content: center; background: #fdf1eb; }
      .lk .frame.icon img { width: 168px; height: 168px; object-fit: contain; }
      /* The recorded Studio replay still shows the raw Recraft icons; the refined ones the site uses sit over them. */
      .iconfix { position: absolute; top: 570px; width: 144px; height: 144px; border-radius: 5px; background: #fffefb; display: grid; place-items: center; }
      .iconfix img { width: 100px; height: 100px; }
      .lk .frame.code { background: #211815; padding: 26px 28px; }
      .lk pre { font-family: "IBM Plex Mono", monospace; font-size: 17px; line-height: 1.62; color: #fdf1eb; white-space: pre; }
      .lk pre i { font-style: normal; color: #35f3b5; }
      .lk figcaption { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12px; font-size: 18px; }
      .lk figcaption b { font-weight: 600; }
      .lk figcaption span { font-family: "IBM Plex Mono", monospace; font-size: 14px; color: #6e6a61; }

      /* the rail */
      #rail { position: absolute; left: 72px; top: 90px; width: 322px; height: ${H}px; z-index: 4; }
      .chap { inset: auto; left: 0; top: 96px; width: 322px; }
      .chap .kicker { color: #a9311e; }
      .chap h2 { margin-top: 12px; font-size: 64px; }
      .chap .lede { margin-top: 16px; font-size: 22px; line-height: 1.32; color: #45423c; }
      .facts { margin-top: 30px; }
      .who-list { position: relative; }
      .changes { margin-top: 22px; list-style: none; display: flex; flex-wrap: wrap; row-gap: 10px; }
      .changes li { width: 50%; display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 600; }
      .changes i { width: 26px; height: 26px; border-radius: 50%; border: 2px dashed #d2402a; font-style: normal; font-family: "IBM Plex Mono", monospace; font-weight: 500; font-size: 13px; line-height: 22px; text-align: center; color: #a9311e; }
      #who-hl { position: absolute; left: 0; top: 0; width: 322px; height: 80px; border-radius: 12px; background: #e7e0d2; box-shadow: inset 3px 0 0 #d2402a; }
      .who { position: relative; height: 80px; padding: 10px 16px 0 18px; display: grid; grid-template-columns: 1fr auto; align-items: center; row-gap: 6px; }
      .who b { font-weight: 400; font-size: 34px; line-height: 1; }
      .who .sw { display: flex; gap: 5px; }
      .who .sw i { display: block; width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); }
      .who .meta { grid-column: span 2; font-family: "IBM Plex Mono", monospace; font-size: 13px; color: #45423c; }
      .stat { display: flex; align-items: baseline; gap: 14px; padding: 12px 0; border-top: 1px solid rgba(28, 27, 25, 0.16); }
      .stat b { font-family: "Bodoni Moda", serif; font-weight: 500; font-size: 50px; line-height: 1; min-width: 104px; }
      .stat span { font-size: 18px; color: #45423c; }
      .note { margin-top: 18px; font-family: "IBM Plex Mono", monospace; font-size: 13.5px; line-height: 1.7; color: #45423c; }
      .note b { font-weight: 500; color: #1c1b19; }
      .note.tight { margin-top: 2px; }
      .wt { padding: 9px 0; }
      .wt p { display: flex; justify-content: space-between; font-size: 18px; }
      .wt p b { font-family: "IBM Plex Mono", monospace; font-weight: 500; font-size: 15px; color: #a9311e; }
      .wt .bar { margin-top: 7px; height: 6px; border-radius: 3px; background: rgba(28, 27, 25, 0.1); }
      .wt .bar i { display: block; height: 6px; border-radius: 3px; background: #d2402a; transform-origin: 0 50%; }
      .kept { margin-top: 18px; font-size: 18px; color: #45423c; }
      .kept b { font-family: "Bodoni Moda", serif; font-weight: 500; font-size: 40px; color: #1c1b19; }
      .out { display: grid; grid-template-columns: 26px 1fr; padding: 12px 0; border-top: 1px solid rgba(28, 27, 25, 0.16); }
      .out .tick { width: 18px; height: 18px; margin-top: 3px; border-radius: 50%; border: 2px dashed #d2402a; }
      .out p { font-size: 19px; font-weight: 600; }
      .out span { grid-column: 2; font-family: "IBM Plex Mono", monospace; font-size: 13px; color: #45423c; margin-top: 3px; }
      .chip { display: inline-block; margin: 0 8px 10px 0; padding: 9px 15px 10px; border-radius: 999px; border: 1px solid rgba(28, 27, 25, 0.25); font-size: 18px; }
      .chip-on { position: absolute; inset: -1px; border-radius: 999px; background: #1c1b19; }
      .chip { position: relative; }
      .chip span { position: relative; }
      .code { margin-top: 6px; padding: 18px 18px 20px; border-radius: 12px; background: #1c1b19; color: #f1ece2; font-family: "IBM Plex Mono", monospace; font-size: 15px; line-height: 1.75; white-space: pre; }
      .code i { font-style: normal; color: #f0c534; }
      #index { position: absolute; left: 0; bottom: 0; width: 322px; list-style: none; }
      #index li { display: flex; gap: 14px; height: 27px; align-items: center; font-family: "IBM Plex Mono", monospace; font-size: 13.5px; color: #6e6a61; }
      #index li span:first-child { width: 22px; }
      #ix-mark { position: absolute; left: -22px; bottom: 0; width: 12px; height: 3px; background: #d2402a; }

      /* end card */
      #s-end { z-index: 8; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      #end-lock { display: flex; align-items: center; gap: 22px; }
      #end-lock b { font-family: "Bodoni Moda", serif; font-style: italic; font-weight: 600; font-size: 92px; line-height: 1; letter-spacing: -0.01em; }
      #end-head { margin-top: 58px; font-size: 104px; text-align: center; }
      #end-head .w { display: inline-block; }
      #end-cmd { margin-top: 54px; display: flex; align-items: center; gap: 18px; }
      #end-cmd code { padding: 14px 26px 15px; border-radius: 999px; background: #1c1b19; color: #f1ece2; font-family: "IBM Plex Mono", monospace; font-size: 24px; }
      #end-cmd span { font-size: 21px; color: #45423c; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${END}" data-width="1920" data-height="1080">
      <div id="grid"></div>
      <div id="logo">${MARK("lg", 34)}<b>Baste</b></div>

      <section id="s-why" class="clip" data-start="0" data-duration="9" data-track-index="0">
        <div id="why-in">
          <div id="why-card">
            <div class="pc-head"><span>User persona</span><span>Segment B</span></div>
            <div class="pc-who">
              <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="#dcdcdc"/><circle cx="32" cy="25" r="11" fill="#b5b5b5"/><path d="M12 54c3-10 11-15 20-15s17 5 20 15" fill="#b5b5b5"/></svg>
              <div><b>Primary user</b><span>“Busy professional”</span></div>
            </div>
            <div class="pc-rows">
              <div class="pc-row" id="why-age"><i class="hl"></i><span>Age</span><b>25–34</b></div>
              <div class="pc-row"><span>Location</span><b>Urban</b></div>
              <div class="pc-row"><span>Income</span><b>$60–80k</b></div>
              <div class="pc-row"><span>Goal</span><b>Save time</b></div>
              <div class="pc-row"><span>Frustration</span><b>Too many clicks</b></div>
            </div>
            <svg class="why-x" id="why-x1" width="600" height="520" viewBox="0 0 600 520" aria-hidden="true"><path d="M-34 70 L634 450" stroke="#d2402a" stroke-width="6" stroke-linecap="round" stroke-dasharray="26 16" fill="none"/></svg>
            <svg class="why-x" id="why-x2" width="600" height="520" viewBox="0 0 600 520" aria-hidden="true"><path d="M634 70 L-34 450" stroke="#d2402a" stroke-width="6" stroke-linecap="round" stroke-dasharray="26 16" fill="none"/></svg>
          </div>
          <h1 id="why-head" class="display"><span class="w" id="why-w1">A</span> <span class="w em" id="why-w2">person</span> <span class="w" id="why-w3">does.</span></h1>
          <div id="why-under"><i></i></div>
        </div>
      </section>

      <section id="s-measure" class="clip" data-start="8.6" data-duration="10.9" data-track-index="0">
        <div id="m-portrait"><img src="assets/portraits/cyberbotanist.webp" alt="" /></div>
        <div id="m-tape"></div>
        <div id="m-caption">
          <p class="mono">Authored persona</p>
          <h3 class="display">Moss</h3>
          <p>The Cyberbotanist. A biologist who studies fungi networks by day.</p>
        </div>
        <div id="m-sheet">
          <div id="m-ruler">${Array.from({ length: 9 }, (_, i) => `<span style="left:${i * 86 + 5}px">${i + 1}</span>`).join("")}</div>
          <p id="m-kicker" class="mono">01 · Measure</p>
          <h2 id="m-title" class="display">Moss, <em>measured.</em></h2>
          <div id="m-rows">
            ${[
              ["Films they rewatch", "Annihilation, Nausicaä, The Fountain"],
              ["Music they work to", "Biosphere, Mary Lattimore, Susumu Yokota"],
              ["Rooms that feel like home", "Greenhouses, herbariums, maker spaces"],
              ["Can’t stand in an app", "Dark patterns, infinite scroll, algorithmic feeds"],
            ]
              .map(([lab, val], i) => `<div class="m-row" id="m-row${i}"><i class="rule"></i><div class="in"><span class="no mono">No. ${i + 1}</span><span class="lab mono">${lab}</span><span class="val">${val}</span></div></div>`)
              .join("\n            ")}
          </div>
        </div>
      </section>

      <div id="stage-wrap">
        <div id="stage">
          ${take("fitting", `
          ${box("co-layout", 1, [58, 132, 996, 488])}
          ${box("co-type", 2, [1072, 157, 316, 91])}
          ${box("co-colour", 3, [1072, 254, 311, 179])}
          ${box("co-motion", 4, [1217, 436, 166, 92])}`)}
          ${take("archA", `
          <div class="ring" id="co-cut" style="left:321px;top:764px;width:344px;height:62px"></div>`)}
          ${take("archB", `
          <svg class="arrow" id="co-temp" style="left:757px;top:818px" width="626" height="16" viewBox="0 0 626 16" aria-hidden="true"><path d="M8 8 H618 M16 1 L6 8 L16 15 M610 1 L620 8 L610 15" stroke="#d2402a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="tag" id="tag-temp" style="left:980px;top:840px">cool → warm</span>
          <svg class="arrow" id="co-dense" style="left:716px;top:389px" width="16" height="398" viewBox="0 0 16 398" aria-hidden="true"><path d="M8 8 V390 M1 16 L8 6 L15 16 M1 382 L8 392 L15 382" stroke="#d2402a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div class="rot" style="left:668px;top:664px"><span class="tag" id="tag-dense">sparse → dense</span></div>`)}
          ${take("archC")}
          ${take("method")}
          <section id="spread" class="clip" data-start="41.25" data-duration="4.2" data-track-index="3">
            <header><h3 class="display">Eight kept, from cool to <em>warm.</em></h3><p class="mono">8 of 24 drafts · one per region</p></header>
            <div id="prints">
              ${KEPT.map(([id, q, f], i) => `<figure class="print" id="pr-${i}"><span class="ph"><img src="assets/kept/${id}.jpg" alt="" /></span><figcaption><span>${direction(f)}</span><b>${q.toFixed(2)}</b></figcaption></figure>`).join("\n              ")}
            </div>
            <div id="spread-axis"><span class="c">Cool</span><i></i><span class="w">Warm</span></div>
          </section>
          ${take("archCut", `<i class="iconfix" style="left:734px"><img src="assets/outputs/mycelium.svg" alt="" /></i><i class="iconfix" style="left:896px"><img src="assets/outputs/herbarium.svg" alt="" /></i>`)}
          <div id="look">
            <header><h3 class="display">Ready to <em>use.</em></h3><p class="mono">Moss’s suite · one run</p></header>
            <div id="lk-grid">
              <figure class="lk" id="lk-0"><span class="frame"><img src="assets/outputs/hero.webp" alt="" /></span><figcaption><b>Hero image</b><span>Seedream v4</span></figcaption></figure>
              <figure class="lk" id="lk-1"><span class="frame"><img src="assets/outputs/background.webp" alt="" /></span><figcaption><b>Background</b><span>Seedream v4</span></figcaption></figure>
              <figure class="lk" id="lk-2"><span class="frame"><video id="v-loop" src="assets/outputs/loop.mp4" muted playsinline data-start="48.9" data-duration="2.1" data-media-start="0.4" data-track-index="3"></video></span><figcaption><b>Ambient loop</b><span>Seedance 1 Pro · 5 s</span></figcaption></figure>
              <figure class="lk" id="lk-3"><span class="frame icon"><img src="assets/outputs/mycelium.svg" alt="" /></span><figcaption><b>Mycelial network</b><span>Icon · SVG</span></figcaption></figure>
              <figure class="lk" id="lk-4"><span class="frame icon"><img src="assets/outputs/herbarium.svg" alt="" /></span><figcaption><b>Herbarium collection</b><span>Icon · SVG</span></figcaption></figure>
              <figure class="lk" id="lk-5"><span class="frame code"><pre>--color-primary:   <i>#a15d3f</i>;
--color-secondary: <i>#5a8e3f</i>;
--color-accent:    <i>#35f3b5</i>;
--font-display:    <i>Fraunces</i>;
--radius:          <i>.75rem</i>;
--motion:          <i>300ms</i>;</pre></span><figcaption><b>Design tokens</b><span>CSS · Tailwind · Panda</span></figcaption></figure>
            </div>
          </div>
          ${take("tok1")}
          ${take("tok2")}
          ${take("tok3")}
          ${take("talk", "", `<i class="fade" id="talk-fade"></i>`)}
          ${take("yours")}
          <i id="seam"></i>
        </div>
        <svg id="stitch" width="${W + 28}" height="${H + 28}" viewBox="0 0 ${W + 28} ${H + 28}" aria-hidden="true"><rect x="1.5" y="1.5" width="${W + 25}" height="${H + 25}" rx="24" fill="none" stroke="#d2402a" stroke-width="2" stroke-dasharray="12 10" opacity="0.55"/></svg>
      </div>

      <aside id="rail">
        ${chap("fitting", "Fitting room", "The same screen, re-cut for three people.", `
          <div class="who-list"><i id="who-hl"></i>
            ${PEOPLE.map(([id, name, font, meta, sw]) => `<div class="who" id="who-${id}"><b style="font-family:'${font}'">${name}</b><span class="sw">${sw.map((c) => `<i style="background:${c}"></i>`).join("")}</span><span class="meta">${meta}</span></div>`).join("\n            ")}
          </div>
          <ol class="changes">${["Layout", "Type", "Colour", "Motion"].map((k, i) => `<li id="chg-${i}"><i>${i + 1}</i>${k}</li>`).join("")}</ol>`)}
        ${chap("baste", "Baste", "Loose drafts across the grid, each one judged.", `
          <div class="stat"><b id="n-drafts">0</b><span>drafts judged</span></div>
          <div class="stat"><b>5</b><span>generations</span></div>
          <div class="stat"><b>3:20</b><span>a real run, sped up</span></div>
          <p class="note">Drafts <b>Seedream v4</b></p><p class="note tight">Judge <b>Gemini 2.5 Flash</b>, via fal</p>`)}
        ${chap("fit", "Fit", "The best draft in each region, not one winner.", `
          ${WEIGHTS.map(([k, v], i) => `<div class="wt"><p><span>${k}</span><b>${v}%</b></p><div class="bar"><i id="wt-${i}" style="width:${(v / 30) * 100}%"></i></div></div>`).join("\n          ")}
          <p class="kept"><b>8</b> kept of 24</p>`)}
        ${chap("cut", "Cut", "Files you can ship, cut to one person.", `
          ${[
            ["Hero & background", "Seedream v4"],
            ["Vector icons", "SVG · refined for UI"],
            ["Ambient loop", "Seedance 1 Pro"],
            ["Design tokens", "CSS · Tailwind · Panda · JSON"],
          ]
            .map(([k, v], i) => `<div class="out" id="out-${i}"><i class="tick"></i><p>${k}</p><span>${v}</span></div>`)
            .join("\n          ")}`)}
        ${chap("talk", "Talk", "Ask the persona why, and hear it in their words.", `
          <span class="chip" id="chip-0"><i class="chip-on"></i><span>What are you into?</span></span>
          <span class="chip" id="chip-1"><i class="chip-on"></i><span>Why these colours?</span></span>
          <p class="note">Type, or press <b>Talk</b> and say it out loud. Replies can be read back in the persona’s voice.</p>`)}
        ${chap("yours", "Yours", "Measure your own people. Cut what fits them.", `
          <div class="code"><i>$</i> npx baste gui
<i>$</i> baste generate cyberbotanist \\
    --provider fal</div>
          <p class="note">Studio · New persona · Measure</p>`)}
        <ol id="index">
          ${CHAPTERS.map(([n, name], i) => `<li id="ix-${i}"><span>${n}</span><span>${name}</span></li>`).join("\n          ")}
        </ol>
        <i id="ix-mark"></i>
      </aside>

      <section id="s-end" class="clip" data-start="69.2" data-duration="${r3(END - 69.2)}" data-track-index="0">
        <div id="end-lock">${MARK("end", 104)}<b id="end-word">Baste</b></div>
        <h2 id="end-head" class="display"><span class="w" id="end-w0">Cut</span> <span class="w" id="end-w1">to</span> <span class="w" id="end-w2">fit</span> <span class="w em" id="end-w3">one</span> <span class="w" id="end-w4">person.</span></h2>
        <div id="end-cmd"><code>npx baste gui</code><span>then open the Studio</span></div>
      </section>

      ${timing.scenes.map((s) => `<audio id="vo-${s.id}" src="assets/voice/${s.id}.mp3" data-start="${s.voiceStart}" data-duration="${s.voice}" data-track-index="8"></audio>`).join("\n      ")}
      <audio id="bed" src="music/bed.mp3" data-start="0" data-duration="${END}" data-track-index="9" data-volume="1"
        data-automation='{"version":1,"lanes":[{"target":"volume","points":[{"t":0,"v":0},{"t":0.8,"v":0.5},{"t":69.2,"v":0.5},{"t":70.4,"v":1.35},{"t":72.5,"v":1.35},{"t":${END},"v":0}]}]}'></audio>
    </div>

    <script>
      const T = ${JSON.stringify(T)};
      const WIPES = ${JSON.stringify(WIPES)};
      const WIPE = ${WIPE};
      const tl = gsap.timeline({ paused: true });
      const set = (s, v, t = 0) => tl.set(s, v, t);
      const to = (s, v, t) => tl.to(s, v, t);
      const rise = (s, t, d = 0.55, y = 18) => { set(s, { opacity: 0, y }); to(s, { opacity: 1, y: 0, duration: d, ease: "power3.out" }, t); };

      // Frame the recording on (cx, cy) at scale s, never showing past its edges.
      const frame = (cx, cy, s) => ({
        x: Math.min(0, Math.max(${W} - ${W} * s, ${W} / 2 - cx * s)),
        y: Math.min(0, Math.max(${H} - ${H} * s, ${H} / 2 - cy * s)),
        scale: s,
      });
      const cam = (sel, t, d, cx, cy, s, ease = "power2.inOut") => to(sel, { ...frame(cx, cy, s), duration: d, ease }, t);
      set(".cam", { x: 0, y: 0, scale: 1 });

      /* persistent */
      rise("#logo", 0.2, 0.6, 8);
      to("#logo", { opacity: 0, duration: 0.3 }, 69.3);

      /* why */
      rise("#why-card", 0.15, 0.8, 26);
      set("#why-age .hl", { scaleX: 0 });
      to("#why-age .hl", { scaleX: 1, duration: 0.45, ease: "power2.out" }, T.aged - 0.05);
      set(".why-x", { clipPath: "inset(0% 100% 0% 0%)" });
      to("#why-x1", { clipPath: "inset(0% 0% 0% 0%)", duration: 0.55, ease: "power2.inOut" }, T.nobody);
      to("#why-x2", { clipPath: "inset(0% 0% 0% 0%)", duration: 0.55, ease: "power2.inOut" }, T.bracket);
      set("#why-card", { rotation: 0, scale: 1 });
      to("#why-card", { rotation: -2.5, opacity: 0.6, duration: 0.4, ease: "power2.out" }, T.taste - 0.15);
      to("#why-card", { y: -176, scale: 0.74, opacity: 0.32, duration: 0.7, ease: "power3.inOut" }, T.a - 0.5);
      rise("#why-w1", T.a, 0.5, 44);
      rise("#why-w2", T.person + 0.05, 0.5, 44);
      rise("#why-w3", T.does, 0.5, 44);
      set("#why-under i", { scaleX: 0 });
      to("#why-under i", { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, T.does + 0.2);
      to("#why-in", { opacity: 0, duration: 0.35, ease: "power1.in" }, 8.62);

      /* measure */
      set("#m-portrait", { opacity: 0, y: 30, rotation: -1.5, boxShadow: "0px 34px 60px -26px rgba(28,27,25,0.55)" });
      to("#m-portrait", { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 8.85);
      set("#m-tape", { opacity: 0, scale: 0.9, rotation: 4 });
      to("#m-tape", { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, 9.45);
      rise("#m-caption", 9.3);
      set("#m-ruler", { scaleX: 0 });
      to("#m-ruler", { scaleX: 1, duration: 0.9, ease: "power2.inOut" }, T.starts - 0.2);
      rise("#m-kicker", T.starts);
      rise("#m-title", T.starts + 0.15, 0.7, 26);
      [T.films, T.music, T.rooms, T.things].forEach((t, i) => {
        set("#m-row" + i + " .rule", { scaleX: 0 });
        to("#m-row" + i + " .rule", { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, t - 0.2);
        rise("#m-row" + i + " .in", t, 0.55, 16);
      });
      to("#m-sheet, #m-caption, #m-tape", { opacity: 0, y: -12, duration: 0.4, ease: "power2.in" }, 18.2);
      set("#m-portrait", { left: 280, top: 196, width: 500, height: 580, borderRadius: 8 });
      to("#m-portrait", { left: 508.5, top: 171, width: 42, height: 42, borderRadius: 21, rotation: 0, boxShadow: "0px 0px 0px 0px rgba(28,27,25,0)", duration: 0.8, ease: "power3.inOut" }, 18.45);
      to("#m-portrait", { opacity: 0, duration: 0.15 }, 19.28);

      /* stage + rail */
      set("#stage-wrap", { opacity: 0, y: 16, scale: 0.985 });
      to("#stage-wrap", { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" }, 18.75);
      to("#stage-wrap", { opacity: 0, y: 14, scale: 0.97, duration: 0.6, ease: "power2.in" }, 69.3);
      set("#rail", { opacity: 0, x: -14 });
      to("#rail", { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, 19.0);
      to("#rail", { opacity: 0, x: -10, duration: 0.4, ease: "power2.in" }, 69.3);

      // Rail chapters: lift in, fade out before the next.
      ${JSON.stringify(Object.entries(RAIL).map(([k, [n, s, e]]) => [k, n, s, e]))}.forEach(([key, n, start, end]) => {
        const c = "#ch-" + key;
        rise(c + " .kicker", start + 0.1, 0.5, 10);
        rise(c + " h2", start + 0.18, 0.6, 16);
        rise(c + " .lede", start + 0.28, 0.6, 12);
        rise(c + " .facts", start + 0.4, 0.6, 12);
        to(c, { opacity: 0, duration: 0.25, ease: "power1.in" }, end - 0.26);
        to("#ix-mark", { y: -(6 - n) * 27 - 12, duration: 0.5, ease: "power3.inOut" }, start);
        to("#ix-" + n, { color: "#1c1b19", duration: 0.3 }, start);
        if (n > 1) to("#ix-" + (n - 1), { color: "#6e6a61", duration: 0.3 }, start);
      });
      set("#ix-mark", { y: -(6 - 1) * 27 - 12 });

      /* wipes */
      set("#seam", { x: ${W}, opacity: 0 });
      WIPES.forEach(([sel, t]) => {
        set(sel, { clipPath: "inset(0% 0% 0% 100%)" });
        to(sel, { clipPath: "inset(0% 0% 0% 0%)", duration: WIPE, ease: "power3.inOut" }, t);
        set("#seam", { opacity: 1, x: ${W} }, t);
        to("#seam", { x: -6, duration: WIPE, ease: "power3.inOut" }, t);
        set("#seam", { opacity: 0 }, t + WIPE);
      });

      /* 02 fitting: who is on screen, then what changed */
      const people = [["#who-moss", 18.85], ["#who-ren", ${r3(18.85 + (6.47 - seg.fitting.from) / seg.fitting.rate)}], ["#who-ada", ${r3(18.85 + (10.23 - seg.fitting.from) / seg.fitting.rate)}]];
      set(".who", { opacity: 0.42 });
      set("#who-moss", { opacity: 1 });
      people.forEach(([sel, t], i) => {
        if (i === 0) return;
        to(people[i - 1][0], { opacity: 0.42, duration: 0.3 }, t);
        to(sel, { opacity: 1, duration: 0.3 }, t);
        to("#who-hl", { y: i * 80, duration: 0.45, ease: "power3.inOut" }, t);
      });
      [["#co-layout", T.layout], ["#co-type", T.type], ["#co-colour", T.colour], ["#co-motion", T.motion]].forEach(([sel, t]) => {
        set(sel, { opacity: 0, scale: 0.97 });
        to(sel, { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" }, t - 0.05);
        to(sel, { opacity: 0, duration: 0.3 }, 26.5);
      });
      [T.layout, T.type, T.colour, T.motion].forEach((t, i) => {
        set("#chg-" + i + " i", { backgroundColor: "rgba(210,64,42,0)", color: "#a9311e" });
        to("#chg-" + i + " i", { backgroundColor: "rgba(210,64,42,1)", color: "#ffffff", duration: 0.3 }, t - 0.05);
      });

      /* 03 baste */
      cam("#c-archA", 27.3, 0.9, 493, 560, 1.25);
      set("#co-cut", { opacity: 0, scale: 1.12 });
      to("#co-cut", { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, T.tries - 0.25);
      to("#co-cut", { opacity: 0, duration: 0.25 }, T.tries + 0.35);
      to("#c-archA", { ...frame(720, 450, 1), duration: 0.3, ease: "power2.inOut" }, 29.2);
      cam("#c-archB", 30.0, 0.8, 1070, 590, 1.5);
      [["#co-temp", "#tag-temp", T.warm - 0.1], ["#co-dense", "#tag-dense", T.sparse - 0.1]].forEach(([a, tag, t]) => {
        set([a, tag], { opacity: 0 });
        to(a, { opacity: 1, duration: 0.35 }, t);
        to(tag, { opacity: 1, duration: 0.35 }, t + 0.08);
      });
      to("#co-temp, #tag-temp, #co-dense, #tag-dense", { opacity: 0, duration: 0.3 }, 34.0);
      const drafts = { n: 0 };
      to(drafts, { n: 24, duration: ${r3(34.06 - 30.18)}, ease: "none", onUpdate: () => { document.getElementById("n-drafts").textContent = Math.round(drafts.n); } }, 30.18);
      set("#c-archC", frame(1070, 590, 1.5));
      cam("#c-archC", 34.2, 0.7, 1057, 250, 1.55);

      /* 04 fit */
      cam("#c-method", 37.2, 4.4, 968, 432, 1.06, "power1.inOut");
      ${JSON.stringify(WEIGHTS.map((_, i) => i))}.forEach((i) => {
        set("#wt-" + i, { scaleX: 0 });
        to("#wt-" + i, { scaleX: 1, duration: 0.6, ease: "power3.out" }, 37.5 + i * 0.12);
      });
      ${JSON.stringify(KEPT.map((_, i) => i))}.forEach((i) => {
        set("#pr-" + i, { opacity: 0, y: 26, rotation: i % 2 ? 1.6 : -1.6 });
        to("#pr-" + i, { opacity: 1, y: 0, rotation: 0, duration: 0.55, ease: "power3.out" }, 41.55 + i * 0.09);
      });
      set("#spread-axis i", { scaleX: 0 });
      to("#spread-axis i", { scaleX: 1, duration: 1.1, ease: "power2.inOut" }, T.range - 0.2);

      /* 05 cut */
      cam("#c-archCut", 45.25, 1.6, 1060, 330, 1.6);
      [[0, T.images], [1, T.images + 0.12], [3, T.vector], [4, T.vector + 0.12], [2, T.ambient - 0.1], [5, T.ambient + 0.35]].forEach(([i, t]) => rise("#lk-" + i, t, 0.5, 18));
      [T.images, T.vector, T.ambient, T.design].forEach((t, i) => {
        set("#out-" + i + " .tick", { borderStyle: "dashed", backgroundColor: "rgba(210,64,42,0)" });
        to("#out-" + i + " .tick", { backgroundColor: "rgba(210,64,42,1)", duration: 0.3 }, t);
      });
      ["#c-tok1", "#c-tok2", "#c-tok3"].forEach((c) => cam(c, 50.9, 0.9, 640, 700, 1.45));

      /* 06 talk */
      // Frame the chat alone, cut at the portrait's edge, so the replies read.
      cam("#c-talk", 55.4, 1.6, 971.5, 612, 1.56);
      to("#c-talk", { ...frame(980, 613, 1.58), duration: 5, ease: "power1.inOut" }, 57.4);
      to("#talk-fade", { opacity: 1, duration: 1.2, ease: "power1.out" }, 55.6);
      set("#talk-fade", { opacity: 0 }, 64.0);
      set(".chip-on", { opacity: 0 });
      set(".chip span", { color: "#1c1b19" });
      [["#chip-0", ${r3(54.88 + (8.95 - seg.talk.from))}], ["#chip-1", ${r3(54.88 + (13.5 - seg.talk.from))}]].forEach(([c, t]) => {
        to(c + " .chip-on", { opacity: 1, duration: 0.25 }, t - 0.3);
        to(c + " span", { color: "#f1ece2", duration: 0.25 }, t - 0.3);
        to(c + " .chip-on", { opacity: 0, duration: 0.4 }, t + 1.6);
        to(c + " span", { color: "#1c1b19", duration: 0.4 }, t + 1.6);
      });

      /* 07 yours */
      cam("#c-yours", 63.95, 1.1, 850, 430, 1.22);

      /* end card */
      const len = (id) => document.getElementById(id).getTotalLength();
      set("#end-needle", { strokeDasharray: len("end-needle"), strokeDashoffset: len("end-needle") });
      to("#end-needle", { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut" }, 69.65);
      set("#end-eye", { opacity: 0 });
      to("#end-eye", { opacity: 1, duration: 0.2 }, 70.0);
      set("#end-mp", { strokeDasharray: len("end-mp"), strokeDashoffset: len("end-mp") });
      to("#end-mp", { strokeDashoffset: 0, duration: 0.9, ease: "power1.inOut" }, 69.95);
      rise("#end-word", 70.25, 0.6, 12);
      ["#end-w0", "#end-w1", "#end-w2", "#end-w3", "#end-w4"].forEach((w, i) => rise(w, 70.65 + i * 0.09, 0.6, 30));
      rise("#end-cmd", 71.35, 0.6, 12);

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;

levelVoice();
writeFileSync(join(here, "index.html"), html);
const captions = vtt();
writeFileSync(join(here, "captions.vtt"), captions);
// French subtitles reuse the English timings; narration/captions.fr.json holds one line per cue.
const french = JSON.parse(readFileSync(join(here, "narration/captions.fr.json"), "utf8")).cues;
const blocks = captions.trim().split("\n\n").slice(1);
if (french.length !== blocks.length) throw new Error(`captions.fr.json has ${french.length} lines for ${blocks.length} cues`);
writeFileSync(join(here, "captions.fr.vtt"), ["WEBVTT", "", ...blocks.map((b, i) => `${b.split("\n").slice(0, 2).join("\n")}\n${french[i]}\n`)].join("\n"));
console.log(SEGMENTS.map((s) => `${s.id.padEnd(8)} ${String(s.start).padStart(6)}–${String(s.end).padEnd(6)} src ${s.from}→${s.until} ×${s.rate}`).join("\n"));
