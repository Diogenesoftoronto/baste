import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToHsl, inferTemperatureFromPalette } from "../dist/src/decompose/index.js";
import { slugifyUrl, isPrivateAddress } from "../dist/src/shared/url.js";
import { labelRegion } from "../dist/src/assets/splitter.js";

// ─── Tiny deterministic PRNG (mulberry32) so property runs are reproducible ───
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RUNS = 500;
const randInt = (r: () => number, min: number, max: number) =>
  min + Math.floor(r() * (max - min + 1));
const randHex = (r: () => number) =>
  "#" + randInt(r, 0, 0xffffff).toString(16).padStart(6, "0");

// ─── hexToHsl ─────────────────────────────────────────────────────────────────

test("property: hexToHsl always yields h∈[0,360), s∈[0,1], l∈[0,1]", () => {
  const r = rng(1);
  for (let i = 0; i < RUNS; i++) {
    const hex = randHex(r);
    const { h, s, l } = hexToHsl(hex);
    assert.ok(h >= 0 && h < 360, `h out of range for ${hex}: ${h}`);
    assert.ok(s >= 0 && s <= 1, `s out of range for ${hex}: ${s}`);
    assert.ok(l >= 0 && l <= 1, `l out of range for ${hex}: ${l}`);
    assert.ok(Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l));
  }
});

test("property: grayscale hex (r=g=b) has zero saturation and l = value/255", () => {
  const r = rng(2);
  for (let i = 0; i < RUNS; i++) {
    const v = randInt(r, 0, 255);
    const hh = v.toString(16).padStart(2, "0");
    const { h, s, l } = hexToHsl(`#${hh}${hh}${hh}`);
    assert.equal(s, 0, `expected s=0 for gray #${hh}${hh}${hh}`);
    assert.equal(h, 0);
    assert.ok(Math.abs(l - v / 255) < 1e-9);
  }
});

// ─── inferTemperatureFromPalette ────────────────────────────────────────────────

test("property: inferTemperatureFromPalette only ever returns a valid label", () => {
  const valid = new Set(["warm", "cool", "high-contrast", "neutral"]);
  const r = rng(3);
  for (let i = 0; i < RUNS; i++) {
    const palette = Array.from({ length: randInt(r, 0, 10) }, () => randHex(r));
    assert.ok(valid.has(inferTemperatureFromPalette(palette)));
  }
});

test("example: all-red palette is warm, all-blue is cool", () => {
  assert.equal(inferTemperatureFromPalette(["#ff0000", "#cc0000"]), "warm");
  assert.equal(inferTemperatureFromPalette(["#0000ff", "#0000cc"]), "cool");
  assert.equal(inferTemperatureFromPalette([]), "neutral");
});

// ─── slugifyUrl ──────────────────────────────────────────────────────────────

test("property: slugifyUrl output is lowercase and only [a-z0-9-]", () => {
  const r = rng(4);
  const tlds = ["com", "dev", "io", "net", "co.uk"];
  for (let i = 0; i < RUNS; i++) {
    const sub = randInt(r, 0, 1) ? "www." : "";
    const host = `acme${randInt(r, 0, 999)}`;
    const tld = tlds[randInt(r, 0, tlds.length - 1)];
    const path = randInt(r, 0, 1) ? `/Some Path/${randInt(r, 0, 99)}` : "";
    const slug = slugifyUrl(`https://${sub}${host}.${tld}${path}`);
    assert.match(slug, /^[a-z0-9-]*$/, `bad charset: "${slug}"`);
    assert.equal(slug, slug.toLowerCase());
    assert.ok(!slug.startsWith("-") && !slug.endsWith("-"), `dangling dash: "${slug}"`);
  }
});

test("example: slugifyUrl strips www, lowercases, dashes the path", () => {
  assert.equal(slugifyUrl("https://www.Example.COM/Foo/Bar"), "example-com-foo-bar");
});

// ─── isPrivateAddress ────────────────────────────────────────────────────────

test("property: documented IPv4 private ranges are always private", () => {
  const r = rng(5);
  for (let i = 0; i < RUNS; i++) {
    const x = () => randInt(r, 0, 255);
    assert.equal(isPrivateAddress(`10.${x()}.${x()}.${x()}`), true);
    assert.equal(isPrivateAddress(`192.168.${x()}.${x()}`), true);
    assert.equal(isPrivateAddress(`172.${randInt(r, 16, 31)}.${x()}.${x()}`), true);
    assert.equal(isPrivateAddress(`127.${x()}.${x()}.${x()}`), true);
    assert.equal(isPrivateAddress(`100.${randInt(r, 64, 127)}.${x()}.${x()}`), true);
  }
});

test("property: public IPv4 ranges excluding reserved documentation addresses are never private", () => {
  const r = rng(6);
  for (let i = 0; i < RUNS; i++) {
    const x = () => randInt(r, 0, 255);
    assert.equal(isPrivateAddress(`8.${x()}.${x()}.${x()}`), false);
    assert.equal(isPrivateAddress(`1.${randInt(r, 1, 255)}.${x()}.${x()}`), false);
    assert.equal(isPrivateAddress(`203.${randInt(r, 1, 255)}.${x()}.${x()}`), false);
  }
});

test("property: documentation, benchmark and multicast IPv4 ranges are not safe public fetch targets", () => {
  const r = rng(8);
  for (let i = 0; i < RUNS; i++) {
    const x = () => randInt(r, 0, 255);
    for (const prefix of ["192.0.2", "198.51.100", "203.0.113"]) assert.equal(isPrivateAddress(`${prefix}.${x()}`), true);
    assert.equal(isPrivateAddress(`198.${randInt(r, 18, 19)}.${x()}.${x()}`), true);
    assert.equal(isPrivateAddress(`${randInt(r, 224, 255)}.${x()}.${x()}.${x()}`), true);
  }
});

// ─── labelRegion ─────────────────────────────────────────────────────────────

const REGION_LABELS = new Set([
  "unknown", "icon", "square", "ultrawide-banner", "banner", "hero",
  "landscape", "tall-banner", "tall-portrait", "portrait", "tile",
]);

test("property: labelRegion always returns a known label for any non-negative size", () => {
  const r = rng(7);
  for (let i = 0; i < RUNS; i++) {
    const w = randInt(r, 0, 4000);
    const h = randInt(r, 0, 4000);
    assert.ok(REGION_LABELS.has(labelRegion(w, h)), `unknown label for ${w}x${h}`);
  }
});

test("property: a zero dimension is always 'unknown'", () => {
  const r = rng(8);
  for (let i = 0; i < RUNS; i++) {
    const n = randInt(r, 1, 4000);
    assert.equal(labelRegion(0, n), "unknown");
    assert.equal(labelRegion(n, 0), "unknown");
  }
});

test("property: very wide images never get a portrait/tall label", () => {
  const r = rng(9);
  const portraitish = new Set(["portrait", "tall-portrait", "tall-banner"]);
  for (let i = 0; i < RUNS; i++) {
    const h = randInt(r, 100, 1000);
    const w = h * randInt(r, 4, 10); // aspect ≥ 4
    assert.ok(!portraitish.has(labelRegion(w, h)));
  }
});

test("example: labelRegion classifies common sizes", () => {
  assert.equal(labelRegion(32, 32), "icon");
  assert.equal(labelRegion(1000, 1000), "square");
  assert.equal(labelRegion(1920, 1080), "hero");
  assert.equal(labelRegion(4000, 500), "ultrawide-banner");
  assert.equal(labelRegion(300, 1200), "tall-banner");
});
