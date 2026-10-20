#!/usr/bin/env node
/**
 * Publishes the rendered tour to the site: site/public/media/tour/.
 *
 *   node videos/baste-tour/publish.mjs
 *
 * Reads renders/baste-tour.mp4 (`npm run render` here), captions.vtt and
 * captions.fr.vtt (build.mjs) and the recorded takes in footage/cfr/. Writes a
 * web encode of the tour with its poster and captions, and the silent chapter
 * clips the Studio guide plays, each with a still. Takes are cut after 3.6 s,
 * when the dev overlay has left the frame. site/src/lib/tour.json gives the site
 * each chapter's start and its narration in English and French, so the chapter
 * list and transcripts follow the cut.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../site/public/media/tour");
mkdirSync(join(out, "clips"), { recursive: true });

const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const report = (file) => console.log(`${file.replace(`${out}/`, "media/tour/")}  ${(statSync(file).size / 1e6).toFixed(1)} MB`);

// Refuse a render that is still being written: the log's final line is "exit 0" only once it is done.
const log = join(here, "renders/render.log");
if (existsSync(log) && !/exit 0\s*$/.test(readFileSync(log, "utf8"))) throw new Error("renders/render.log does not end in \"exit 0\"; the render is unfinished or failed.");
// The tour: 1080p H.264 with the moov atom up front, so it starts before it has loaded.
const tour = join(out, "baste-tour.mp4");
ffmpeg("-i", join(here, "renders/baste-tour.mp4"), "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-tune", "stillimage",
  "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", tour);
report(tour);
// "Eight kept, from cool to warm": the frame that says the most about what Baste does.
ffmpeg("-ss", "43", "-i", join(here, "renders/baste-tour.mp4"), "-frames:v", "1", "-c:v", "libwebp", "-quality", "86", join(out, "poster.webp"));
report(join(out, "poster.webp"));
copyFileSync(join(here, "captions.vtt"), join(out, "captions-en.vtt"));
copyFileSync(join(here, "captions.fr.vtt"), join(out, "captions-fr.vtt"));

// Chapter clips for the Studio guide: source seconds in each take, and the frame used as the still.
const CLIPS = [
  { id: "generate", take: "archive", from: 6.0, to: 34.9, still: 34.4 },
  { id: "tokens", take: "tokens", from: 3.7, to: 12.1, still: 5.2 },
  { id: "conversation", take: "talk", from: 3.7, to: 16.9, still: 16.4 },
  { id: "new-persona", take: "yours", from: 3.7, to: 16.4, still: 15.9 },
];
// The archive take's replay shows the raw Recraft icons; the site uses refined ones, so they are laid
// over the two icon tiles. ICON_TILES is where the tiles' tops sit (source px) as the page scrolls into
// the cut, measured from the take; from 29.67 s they are still.
const ICON_TILES = [[29.4, 827], [29.433, 708], [29.467, 661], [29.533, 616], [29.567, 596], [29.6, 582], [29.633, 571], [29.667, 567]];
const PATCHES = [["patch-mycelium.png", 734], ["patch-herbarium.png", 896]];
const patched = (c, scale) => {
  if (c.take !== "archive") return { inputs: [], graph: `[0:v]${scale}[v]` };
  // Clip time t is source time minus c.from; each tile top is held until the next measurement.
  let y = "3000";
  for (const [at, top] of ICON_TILES) y = `if(gte(t,${(at - c.from - 0.015).toFixed(3)}),${top + 3},${y})`;
  const inputs = PATCHES.flatMap(([png]) => ["-loop", "1", "-i", join(here, "assets/patches", png)]);
  const graph = `[0:v][1:v]overlay=x=${PATCHES[0][1]}:y='${y}':shortest=1[a];[a][2:v]overlay=x=${PATCHES[1][1]}:y='${y}':shortest=1,${scale}[v]`;
  return { inputs, graph };
};
for (const c of CLIPS) {
  if (c.from < 3.6) throw new Error(`${c.id} starts inside the dev overlay`);
  const src = join(here, "footage/cfr", `${c.take}.mp4`);
  const file = join(out, "clips", `${c.id}.mp4`);
  const scale = "scale=1280:800:flags=lanczos";
  const clip = patched(c, scale);
  ffmpeg("-ss", String(c.from), "-to", String(c.to), "-i", src, ...clip.inputs, "-filter_complex", clip.graph, "-map", "[v]", "-an", "-c:v", "libx264",
    "-preset", "slow", "-crf", "24", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file);
  const still = patched({ ...c, from: c.still }, scale);
  ffmpeg("-ss", String(c.still), "-i", src, ...still.inputs, "-filter_complex", still.graph, "-map", "[v]", "-frames:v", "1", "-c:v", "libwebp", "-quality", "84",
    join(out, "clips", `${c.id}.webp`));
  report(file);
}

// Chapters and transcript for the site. French lines are the subtitles that fall inside each scene.
const TITLES = {
  why: ["A person", "Une personne"], measure: ["Measure", "Mesurer"], fitting: ["Fitting room", "Cabine d’essayage"],
  baste: ["Baste", "Bâtir"], fit: ["Fit", "Ajuster"], cut: ["Cut", "Couper"], talk: ["Talk", "Parler"], yours: ["Yours", "À vous"],
};
const cues = (file) => readFileSync(join(here, file), "utf8").trim().split("\n\n").slice(1).map((block) => {
  const [, time, ...text] = block.split("\n");
  const [h, m, sec] = time.split(" --> ")[0].split(":");
  return { start: +h * 3600 + +m * 60 + +sec, text: text.join(" ") };
});
const french = cues("captions.fr.vtt");
const { scenes } = JSON.parse(readFileSync(join(here, "narration/timing.json"), "utf8"));
const manifest = {
  src: "/media/tour/baste-tour.mp4",
  poster: "/media/tour/poster.webp",
  captions: { en: "/media/tour/captions-en.vtt", fr: "/media/tour/captions-fr.vtt" },
  duration: +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", tour], { encoding: "utf8" }).trim(),
  recorded: "2026-10-10",
  chapters: scenes.map((s, i) => {
    const end = scenes[i + 1]?.start ?? Infinity;
    return {
      id: s.id, start: +s.start.toFixed(2), title: TITLES[s.id][0], titleFr: TITLES[s.id][1], text: s.text,
      textFr: french.filter((c) => c.start >= s.start && c.start < end).map((c) => c.text).join(" "),
    };
  }),
};
writeFileSync(resolve(here, "../../site/src/lib/tour.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("site/src/lib/tour.json");
