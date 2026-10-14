// Read-only screen recording of the current Studio, using the built-in persona.
// PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH follow verify-fabric.mjs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.STUDIO_GUIDE_URL || "http://localhost:5173";
const output = process.env.STUDIO_GUIDE_OUTPUT || "/tmp/baste-studio-guide-recording";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block", recordVideo: { dir: output, size: { width: 1440, height: 900 } } });
const page = await context.newPage();
const video = page.video();
const started = Date.now();
const errors = [];
const cues = [];
page.on("pageerror", e => errors.push(e.message));
try {
  await page.goto(`${base}/gui/?persona=cyberbotanist&tab=fitting`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Fitting", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.getByRole("tab", { name: "Material", exact: true }).count(), 1);
  const capture = async (id, caption, fr) => {
    const start = (Date.now() - started) / 1000;
    cues.push({ id, start, caption, fr });
    await page.screenshot({ path: path.join(output, `${id}.png`) });
    await page.waitForTimeout(3500); // Reading time in the actual recording.
  };
  await capture("fitting", "Choose a persona. Fitting previews its colours, type, and interface.", "Choisissez un persona. Fitting présente ses couleurs, sa typographie et son interface.");
  for (const [id, label, caption, fr] of [
    ["material", "Material", "Material changes the persona’s cloth. Adjustments stay in this browser.", "Material permet de modifier le tissu du persona. Les réglages restent dans ce navigateur."],
    ["tokens", "Tokens", "Tokens lets you copy or download the design system. OpenPencil is inside this tab.", "Tokens permet de copier ou télécharger le système de design. OpenPencil se trouve dans cet onglet."],
    ["moodboard", "Moodboard", "Moodboard keeps references, notes, and influences beside the persona.", "Moodboard rassemble les références, notes et influences du persona."],
    ["feedback", "Taste", "Taste records what you want more or less of, and why.", "Taste conserve ce que vous souhaitez voir davantage ou moins souvent, et pourquoi."],
  ]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await page.waitForFunction(label => document.querySelector('[role=tab][aria-selected=true]')?.textContent === label, label);
    await page.locator("#persona-tabpanel").waitFor();
    await page.waitForTimeout(500);
    await capture(id, caption, fr);
  }
  assert.deepEqual(errors, []);
} finally {
  await context.close();
  await browser.close();
}
await copyFile(await video.path(), path.join(output, "current-studio.webm"));
const end = Number(JSON.parse(execFileSync("rtk", ["proxy", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path.join(output, "current-studio.webm")], { encoding: "utf8" })).format.duration);
const stamp = seconds => new Date(Math.max(0, seconds) * 1000).toISOString().slice(11, 23);
for (const lang of ["en", "fr"]) {
  const vtt = "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(cues[i + 1]?.start ?? end)}\n${lang === "fr" ? c.fr : c.caption}\n`).join("\n");
  await writeFile(path.join(output, `current-${lang}.vtt`), vtt);
}
await writeFile(path.join(output, "capture.json"), JSON.stringify({ base, recordedAt: new Date().toISOString(), viewport: { width: 1440, height: 900 }, interactions: "Read-only navigation; no generation or account changes", cues, duration: end, errors }, null, 2) + "\n");
console.log(JSON.stringify({ output, duration: end, screens: cues.map(c => c.id), errors }));
