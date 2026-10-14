import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseColor,
  relativeLuminance,
  contrastRatio,
  wcagLevel,
  lintPalette,
} from "../dist/src/assets/contrast.js";

test("parseColor: hex 3-digit", () => {
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColor("#000"), { r: 0, g: 0, b: 0 });
  assert.deepEqual(parseColor("#abc"), { r: 170, g: 187, b: 204 });
});

test("parseColor: hex 6-digit", () => {
  assert.deepEqual(parseColor("#C6FF00"), { r: 198, g: 255, b: 0 });
  assert.deepEqual(parseColor("#0a0a12"), { r: 10, g: 10, b: 18 });
});

test("parseColor: rgb() and rgba()", () => {
  assert.deepEqual(parseColor("rgb(255, 0, 184)"), { r: 255, g: 0, b: 184 });
  assert.deepEqual(parseColor("rgba(138, 0, 255, 0.5)"), { r: 138, g: 0, b: 255 });
});

test("parseColor: invalid returns null", () => {
  assert.equal(parseColor("hsl(0, 0%, 50%)"), null);
  assert.equal(parseColor("not a color"), null);
  assert.equal(parseColor(""), null);
});

test("relativeLuminance: black=0, white=1", () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
});

test("relativeLuminance: in 0..1 for all inputs", () => {
  for (let r = 0; r < 256; r += 17) {
    const l = relativeLuminance({ r, g: 0, b: 0 });
    assert.ok(l >= 0 && l <= 1, `luma out of range for r=${r}: ${l}`);
  }
});

test("contrastRatio: black vs white = 21", () => {
  const r = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.ok(Math.abs(r - 21) < 0.01, `expected 21, got ${r}`);
});

test("contrastRatio: symmetric", () => {
  const a = { r: 198, g: 255, b: 0 };
  const b = { r: 10, g: 10, b: 18 };
  assert.equal(contrastRatio(a, b), contrastRatio(b, a));
});

test("contrastRatio: same color = 1", () => {
  const a = { r: 100, g: 100, b: 100 };
  assert.equal(contrastRatio(a, a), 1);
});

test("wcagLevel: thresholds", () => {
  assert.equal(wcagLevel(21), "AAA");
  assert.equal(wcagLevel(7),  "AAA");
  assert.equal(wcagLevel(4.5),"AA");
  assert.equal(wcagLevel(3),  "AA-large");
  assert.equal(wcagLevel(2.9),"fail");
});

test("lintPalette: returns issues for low-contrast pairs", () => {
  // Acid lime on near-black should pass; a low-saturation gray on near-black
  // should fail AA.
  const issues = lintPalette(["#C6FF00", "#0A0A12", "#9A8FB5"]);
  // text-muted on bg should be flagged
  assert.ok(issues.length > 0, "expected at least one AA failure");
  assert.ok(issues.some((i) => i.pair[0] === "#9A8FB5"));
});

test("lintPalette: all-AAA palette returns no issues", () => {
  const issues = lintPalette(["#000000", "#FFFFFF"], { minRatio: 4.5 });
  assert.equal(issues.length, 0);
});

test("lintPalette: respects explicit `against` background", () => {
  // Acid lime on near-black should pass; near-black on pure black should fail.
  const againstBlack = lintPalette(["#C6FF00", "#0A0A12"], { minRatio: 4.5, against: "#000000" });
  const lime = againstBlack.find((i) => i.pair[0] === "#C6FF00");
  const nearBlack = againstBlack.find((i) => i.pair[0] === "#0A0A12");
  assert.equal(lime, undefined, "lime on black should pass AA");
  assert.ok(nearBlack, "near-black on black should fail AA");
});

test("lintPalette: empty / single-color input returns no issues", () => {
  assert.deepEqual(lintPalette([]), []);
  assert.deepEqual(lintPalette(["#fff"]), []);
});
