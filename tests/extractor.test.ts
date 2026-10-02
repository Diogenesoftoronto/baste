import { test } from "node:test";
import assert from "node:assert/strict";
import { decomposeUrl } from "../dist/src/decompose/index.js";

const FIXTURE_HTML = `<!doctype html>
<html><head>
  <title>Acme Studio</title>
  <meta name="description" content="A studio for organic, solarpunk design.">
  <meta property="og:image" content="/og.png">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple.png">
  <link rel="stylesheet" href="/styles.css">
  <style>
    :root { --brand: #4caf50; --ink: #1a1a1a; }
    body { color: var(--ink); background: #ffffff; font-family: 'Inter', sans-serif; }
    .btn { background: var(--brand); border-radius: 8px; transition-timing-function: ease-in-out; }
    @font-face { font-family: 'Acme'; src: url('/fonts/acme.woff2'); }
    .grid { display: grid; }
  </style>
</head><body>
  <header>
    <img src="/logo.svg" alt="Acme logo" class="brand">
    <nav><a href="/">Home</a></nav>
  </header>
  <main>
    <picture>
      <source srcset="/hero@2x.webp 2x, /hero.webp 1x">
      <img src="/hero.jpg" alt="Hero">
    </picture>
    <p>We design solarpunk gardens with bioluminescent fungi and mycelial networks.</p>
  </main>
</body></html>`;

const FIXTURE_CSS = `
.nav { color: #4caf50; }
.heading { font-family: 'Space Grotesk', 'Acme', sans-serif; }
.card { background: rgb(76, 175, 80); border-radius: 24px; }
.muted { color: hsl(0, 0%, 40%); }
`;

const fakeFetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.endsWith("/styles.css")) {
    return new Response(FIXTURE_CSS, { status: 200, headers: { "Content-Type": "text/css" } });
  }
  return new Response(FIXTURE_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
}) as unknown as typeof fetch;

const originalFetch = globalThis.fetch;

test("decompose extracts title, meta, logo, og, palette roles, fonts", async (t) => {
  globalThis.fetch = fakeFetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const { persona, brandKit } = await decomposeUrl("https://acme.test/", { id: "acme", allowPrivateHosts: true });

  assert.equal(brandKit.title, "Acme Studio");
  assert.match(brandKit.description, /solarpunk/i);
  assert.equal(brandKit.ogImage, "https://acme.test/og.png");
  assert.equal(brandKit.logo, "https://acme.test/logo.svg");

  assert.ok(brandKit.palette.includes("#4caf50"), `expected brand green in palette; got ${brandKit.palette.join(",")}`);
  assert.ok(brandKit.fonts.length > 0);

  assert.ok(brandKit.paletteRoles.primary, "primary role should be assigned");
  assert.ok(brandKit.paletteRoles.background, "background role should be assigned");

  assert.ok(brandKit.fontFaces.some((f) => f.family === "Acme" && f.src?.endsWith(".woff2")));

  assert.equal(brandKit.signals.hasGrid, true);
  assert.equal(brandKit.signals.borderRadiusMax, 24);

  const imageUrls = brandKit.images.map((i) => i.url);
  assert.ok(imageUrls.some((u) => u.endsWith("/hero.jpg")), "should capture <img src>");
  assert.ok(imageUrls.some((u) => u.endsWith("/hero@2x.webp")), "should capture <source srcset>");

  assert.equal(persona.id, "acme");
  assert.equal(persona.name, "Acme Studio");
});

const QWIK_FIXTURE_HTML = `<!doctype html>
<html><head><title>Qwik-like Site</title>
<style>
:root { --p: #009dfd; }
body { font-family: 'Poppins', ui-sans-serif, 'Apple Color Emoji', Menlo; color: var(--p); }
.btn { border-radius: 8px; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
.grid { display: grid; }
</style></head><body><h1>Hi</h1></body></html>`;

test("typographyStyle does not pick handcrafted for ui-sans-serif", async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(QWIK_FIXTURE_HTML, { status: 200, headers: { "Content-Type": "text/html" } })) as unknown as typeof fetch;
  t.after(() => { globalThis.fetch = original; });

  const { persona } = await decomposeUrl("https://qwiklike.test/", { id: "qwiklike", allowPrivateHosts: true });
  assert.notEqual(persona.aesthetic.typographyStyle, "handcrafted");
  assert.equal(persona.aesthetic.layoutStyle, "grid");
});

test("CSS variables resolve in palette ranking", async (t) => {
  globalThis.fetch = fakeFetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const { brandKit } = await decomposeUrl("https://acme.test/", { id: "acme2", allowPrivateHosts: true });
  assert.ok(brandKit.palette.includes("#4caf50"));
  assert.ok(brandKit.palette.includes("#1a1a1a") || brandKit.paletteRoles.text === "#1a1a1a");
});
