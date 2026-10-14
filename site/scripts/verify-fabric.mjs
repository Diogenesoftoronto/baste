// Browser regression check for black canvas frames during resizing and mobile scroll.
// Use an installed Playwright via PLAYWRIGHT_MODULE, matching scripts/shoot.mjs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.FABRIC_QA_URL || "http://localhost:5173";
const output = process.env.FABRIC_QA_OUTPUT || "/tmp/baste-fabric-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const errors = [];
const captures = [];
async function capture(page, name) {
  const png = await page.screenshot({ path: path.join(output, `${name}.png`) });
  const margin = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(data)).blob());
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return [0.2, 0.5, 0.8].map((y) => [...ctx.getImageData(3, Math.floor(bitmap.height * y), 1, 1).data].slice(0, 3));
  }, `data:image/png;base64,${png.toString("base64")}`);
  assert.ok(margin.every((rgb) => Math.min(...rgb) > 70), `${name}: backdrop margin turned dark`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  captures.push({ name, margin });
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const contexts = new Map();
    window.__fabricQA = { contexts, unclearedFrames: [], resizeWrites: 0 };
    const originalContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, options) {
      const gl = originalContext.call(this, kind, options);
      if (kind === "webgl" && gl && !contexts.has(this)) {
        const state = { gl, dirty: false };
        contexts.set(this, state);
        const draw = gl.drawArrays.bind(gl);
        gl.drawArrays = (...args) => { draw(...args); state.dirty = false; };
      }
      return gl;
    };
    for (const dimension of ["width", "height"]) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dimension);
      Object.defineProperty(HTMLCanvasElement.prototype, dimension, {
        ...descriptor,
        set(value) {
          descriptor.set.call(this, value);
          const state = contexts.get(this);
          if (state && this.closest("[data-fabric-backdrop]")) {
            state.dirty = true;
            window.__fabricQA.resizeWrites++;
          }
        },
      });
    }
    const NativeObserver = ResizeObserver;
    window.ResizeObserver = class extends NativeObserver {
      constructor(callback) {
        super((entries, observer) => {
          callback(entries, observer);
          // ResizeObserver runs after rAF, immediately before paint. A changed
          // buffer here must already have been repainted, or it will flash.
          for (const [canvas, state] of contexts) {
            if (canvas.closest("[data-fabric-backdrop]") && state.dirty) window.__fabricQA.unclearedFrames.push(performance.now());
          }
        });
      }
    };
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator("[data-fabric-backdrop] canvas[data-ready=true]").waitFor();
  const sizes = [[1280, 900], [1270, 890], [1000, 780], [760, 920], [390, 844], [390, 750], [390, 650], [390, 844], [800, 600], [1440, 960], [1100, 800], [1280, 900]];
  for (const [i, [width, height]] of sizes.entries()) {
    await page.setViewportSize({ width, height });
    await capture(page, `resize-${i}`);
  }
  const paint = await page.evaluate(() => {
    const qa = window.__fabricQA;
    const canvas = document.querySelector("[data-fabric-backdrop] canvas");
    return { alpha: qa.contexts.get(canvas).gl.getContextAttributes().alpha, resizeWrites: qa.resizeWrites, unclearedFrames: qa.unclearedFrames };
  });
  assert.equal(paint.alpha, true);
  assert.ok(paint.resizeWrites > 2, "Resize checks must actually reallocate the buffer");
  assert.deepEqual(paint.unclearedFrames, [], "A resized buffer reached paint without being drawn");
  await page.evaluate(() => window.__fabricQA.contexts.get(document.querySelector("[data-fabric-backdrop] canvas")).gl.getExtension("WEBGL_lose_context").loseContext());
  await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-fabric-backdrop] canvas")).opacity === "0");
  await capture(page, "context-loss");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: "block" });
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(base, { waitUntil: "domcontentloaded" });
  assert.equal(await mobile.locator("[data-fabric-backdrop] canvas").evaluate((el) => getComputedStyle(el).display), "none");
  for (let i = 0; i < 6; i++) {
    await mobile.setViewportSize({ width: 390, height: 844 - (i % 3) * 65 });
    await mobile.evaluate((y) => window.scrollTo(0, y), i * 100);
    await capture(mobile, `mobile-scroll-${i}`);
  }
  assert.deepEqual(errors, []);
  const report = { base, paint, contextLossFallback: true, mobileBackdrop: "CSS", captures, errors };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, captures: captures.length, output }, null, 2));
} finally {
  await browser.close();
}
