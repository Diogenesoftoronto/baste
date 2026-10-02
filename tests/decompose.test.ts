import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToHsl, inferTemperatureFromPalette } from "../dist/src/decompose/index.js";
import { isPrivateAddress, slugifyUrl, assertSafePublicUrl } from "../dist/src/shared/url.js";

test("slugifyUrl strips www and lowercases", () => {
  assert.equal(slugifyUrl("https://www.Example.COM/path/Page"), "example-com-path-page");
  assert.equal(slugifyUrl("https://qwik.dev"), "qwik-dev");
});

test("isPrivateAddress catches RFC1918 + loopback + link-local", () => {
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("10.0.0.1"), true);
  assert.equal(isPrivateAddress("172.16.5.5"), true);
  assert.equal(isPrivateAddress("192.168.1.1"), true);
  assert.equal(isPrivateAddress("169.254.169.254"), true);
  assert.equal(isPrivateAddress("::1"), true);
  assert.equal(isPrivateAddress("fe80::1"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("1.1.1.1"), false);
});

test("assertSafePublicUrl rejects localhost and private IPs", async () => {
  await assert.rejects(() => assertSafePublicUrl("http://localhost/"), /local|private/i);
  await assert.rejects(() => assertSafePublicUrl("http://127.0.0.1/"), /private|loopback/i);
  await assert.rejects(() => assertSafePublicUrl("file:///etc/passwd"), /non-http/i);
  await assert.rejects(() => assertSafePublicUrl("http://169.254.169.254/"), /private/i);
});

test("hexToHsl roundtrips for primary colors", () => {
  const red = hexToHsl("#ff0000");
  assert.ok(Math.abs(red.h - 0) < 1);
  assert.ok(red.s > 0.99);
  assert.ok(Math.abs(red.l - 0.5) < 0.01);

  const blue = hexToHsl("#0000ff");
  assert.ok(Math.abs(blue.h - 240) < 1);

  const gray = hexToHsl("#808080");
  assert.ok(gray.s < 0.01);
});

test("inferTemperatureFromPalette: warm vs cool vs high-contrast", () => {
  assert.equal(inferTemperatureFromPalette(["#ff7e5f", "#feb47b", "#d2691e"]), "warm");
  assert.equal(inferTemperatureFromPalette(["#1e90ff", "#0066cc", "#4169e1"]), "cool");
  assert.equal(inferTemperatureFromPalette(["#000000", "#ffffff", "#888888"]), "high-contrast");
  assert.equal(inferTemperatureFromPalette([]), "neutral");
});
