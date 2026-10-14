/**
 * Record the real Baste screens used by the tour (videos/baste-tour) at 1440x900.
 *
 *   node scripts/record-tour.mjs [out-dir] [scene,scene]
 *
 * Needs the site on TOUR_SITE (default http://127.0.0.1:5173) and, for the
 * Studio scenes, nothing else: the archive take replays a recorded run with
 * /api blocked, so no provider is called. Each page is loaded once unrecorded
 * (so dev-server compiles never appear), then recorded; the seconds when the
 * scripted actions start and end go to clips.json so the composition can trim
 * each take exactly. Finally every take is copied to a 30 fps H.264 file in
 * cfr/, which is what videos/baste-tour/build.mjs cuts from.
 *
 * Uses the system Chrome on the real GPU (the method page and fitting room run
 * WebGPU shaders). PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
 * follow site/scripts/verify-fabric.mjs. On a nix/guix host, run it with
 * `env -u LD_LIBRARY_PATH` so Chrome loads the system libraries.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const OUT = resolve(process.argv[2] || resolve(import.meta.dirname, '../videos/baste-tour/footage'));
const only = process.argv[3];
mkdirSync(OUT, { recursive: true });
const SITE = process.env.TOUR_SITE || 'http://127.0.0.1:5173';
const W = 1440, H = 900;
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({
  ...(chrome ? { executablePath: chrome } : {}),
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan', '--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1'],
});
const clipsPath = join(OUT, 'clips.json');
const clips = existsSync(clipsPath) ? JSON.parse(readFileSync(clipsPath, 'utf8')) : {};

const CURSOR = `
  (() => {
    if (document.getElementById('tour-cursor')) return;
    const c = document.createElement('div');
    c.id = 'tour-cursor';
    c.innerHTML = '<svg width="24" height="28" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13.5 28 L17.5 26.2 L13 17 L21 17 Z" fill="#1C1B19" stroke="#F1ECE2" stroke-width="2" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-100px,-100px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' });
    const ring = document.createElement('div');
    Object.assign(ring.style, { position: 'fixed', left: '-22px', top: '-22px', width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #D2402A', zIndex: 2147483646, pointerEvents: 'none', opacity: '0' });
    const style = document.createElement('style');
    style.textContent = 'html, html * { cursor: none !important; }';
    document.documentElement.append(style, ring, c);
    addEventListener('pointermove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('pointerdown', e => {
      ring.animate([{ opacity: .9, transform: 'translate(' + e.clientX + 'px,' + e.clientY + 'px) scale(.4)' }, { opacity: 0, transform: 'translate(' + e.clientX + 'px,' + e.clientY + 'px) scale(1.4)' }], { duration: 520, easing: 'ease-out' });
    }, true);
  })();`;

async function scene(name, url, act, { demo = false } = {}) {
  if (only && !only.split(',').includes(name)) return;
  // Warm the page (and the dev server's module graph) without recording.
  {
    const warm = await browser.newContext({ viewport: { width: W, height: H } });
    const wp = await warm.newPage();
    if (demo) await wp.route('**/api/**', r => r.abort());
    await wp.goto(SITE + url, { waitUntil: 'networkidle', timeout: 120000 });
    await wp.waitForTimeout(800);
    await warm.close();
  }
  // Wait for the Studio to settle into demo mode before any interaction.
  const studioReady = async (pg) => {
    if (!url.startsWith('/gui')) return;
    await pg.waitForFunction(() => !/Connecting/.test(document.querySelector('header')?.textContent ?? ''), null, { timeout: 30000 });
    await pg.waitForTimeout(400);
  }
  const dir = join(OUT, `.${name}`);
  rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir, size: { width: W, height: H } } });
  const t0 = Date.now();
  const page = await ctx.newPage();
  if (demo) await page.route('**/api/**', r => r.abort());
  await page.addInitScript(CURSOR);
  let x = W * 0.62, y = H * 0.55;
  const move = async (tx, ty, ms = 650) => {
    const steps = Math.max(8, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, e = t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      await page.mouse.move(x + (tx - x) * e, y + (ty - y) * e);
      await page.waitForTimeout(16);
    }
    x = tx; y = ty;
  };
  const point = async (locator, ms) => {
    // A pointer click only lands on what is on screen: bring the target into view first.
    const box = await locator.boundingBox();
    if (!box || box.y < 70 || box.y + box.height > H - 10) {
      await locator.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      await page.waitForTimeout(700);
    }
    const b = await locator.boundingBox();
    if (!b) throw new Error(`${name}: target not visible`);
    await move(b.x + b.width / 2, b.y + b.height / 2, ms);
  };
  const click = async (locator, ms) => { await point(locator, ms); await page.waitForTimeout(140); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); };
  const scrollTo = async (target, duration = 1.4) => {
    await page.evaluate(([t, d]) => {
      const top = typeof t === 'number' ? t : document.querySelector(t).getBoundingClientRect().top + scrollY - 76;
      window.__lenis ? window.__lenis.scrollTo(top, { duration: d }) : window.scrollTo({ top, behavior: 'smooth' });
    }, [target, duration]);
    await page.waitForTimeout(duration * 1000 + 250);
  };
  const jump = async (top) => {
    await page.evaluate(t => { const y = typeof t === 'number' ? t : document.querySelector(t).getBoundingClientRect().top + scrollY - 76; window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y); }, top);
    await page.waitForTimeout(400);
  };
  await page.goto(SITE + url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await studioReady(page);
  await page.mouse.move(x, y);
  const marks = {};
  const mark = (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); };
  await act({ page, move, point, click, scrollTo, jump, mark, wait: ms => page.waitForTimeout(ms) });
  mark('end');
  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), join(OUT, `${name}.webm`));
  rmSync(dir, { recursive: true, force: true });
  clips[name] = marks;
  writeFileSync(clipsPath, JSON.stringify(clips, null, 2) + '\n');
  console.log(`recorded ${name}`, JSON.stringify(marks));
}

// 3 · The same screen fitted to three people
await scene('fitting', '/', async ({ page, click, jump, wait, move, mark }) => {
  await jump('.fitting-room');
  await wait(1200);
  mark('start');
  const tab = n => page.locator('[role=tablist][aria-label="Fit for persona"] [role=tab]').nth(n);
  await move(760, 560, 500); await wait(700);
  await click(tab(1), 700); await wait(2300);
  await click(tab(2), 600); await wait(2300);
  await click(tab(0), 600); await wait(2000);
});

// 4–5 · The method contact sheet developing as the page scrolls, then the cut
await scene('method', '/method/', async ({ page, wait, mark }) => {
  await wait(1200);
  const span = await page.evaluate(() => document.querySelector('.method-run').offsetHeight - innerHeight);
  mark('start');
  // develop + judge, slowly
  await page.evaluate(s => window.__lenis.scrollTo(s * 0.74, { duration: 9, easing: t => t }), span);
  await wait(9300);
  mark('cut');
  await page.evaluate(s => window.__lenis.scrollTo(s * 0.99, { duration: 4, easing: t => 1 - (1 - t) ** 2 }), span);
  await wait(4600);
});

// 5 · The archive in the Studio: a recorded fal run replays, candidates land by temperature and density
await scene('archive', '/gui/?persona=cyberbotanist&tab=generate', async ({ page, click, point, wait, mark, scrollTo }) => {
  await scrollTo('#gen-title', 1);
  mark('start');
  await point(page.locator('#gen-provider'), 700);
  await page.selectOption('#gen-provider', 'fal'); await wait(900);
  await click(page.getByLabel('Dry run'), 600); await wait(500);
  await click(page.getByRole('button', { name: /generate|cut/i }).last(), 600);
  mark('run');
  await page.waitForSelector('.archive-map', { timeout: 20000 });
  await page.evaluate(() => { const m = document.querySelector('.archive-map'); const y = m.getBoundingClientRect().top + scrollY - 360; window.scrollTo({ top: y, behavior: 'smooth' }); });
  await wait(1200);
  await point(page.locator('.archive-map-grid'), 900);
  await page.waitForFunction(() => /Finished/.test(document.querySelector('#gen-progress')?.textContent ?? ''), null, { timeout: 45000 });
  await wait(900);
  mark('done');
  await page.evaluate(() => { const h = [...document.querySelectorAll('h3')].find(e => /The cut/.test(e.textContent)); const y = h.getBoundingClientRect().top + scrollY - 90; window.scrollTo({ top: y, behavior: 'smooth' }); });
  await wait(1600);
  mark('cut');
  await page.mouse.move(400, 500);
  await wait(4200);
}, { demo: true });

// 6 · Tokens: the design system as code
await scene('tokens', '/gui/?persona=cyberbotanist&tab=tokens', async ({ page, wait, click, mark }) => {
  await wait(1200);
  mark('start');
  const tab = name => page.getByRole('tab', { name, exact: true });
  await click(tab('Tailwind'), 700); await wait(1500);
  await click(tab('Panda'), 500); await wait(1500);
  await click(tab('CSS variables'), 500); await wait(1600);
});

// 7 · Ask the persona why
await scene('talk', '/', async ({ page, click, jump, wait, mark }) => {
  await jump('#meet');
  await wait(900);
  mark('start');
  await click(page.locator('#talk-nightmarketcoder'), 700); await wait(1400);
  await click(page.locator('.companion-suggestions button').first(), 700);
  await page.waitForFunction(() => !document.querySelector('.companion-typing'), null, { timeout: 30000 }).catch(() => {});
  await wait(2600);
  mark('end-1');
  await click(page.locator('.companion-suggestions button').first(), 700);
  await page.waitForFunction(() => !document.querySelector('.companion-typing'), null, { timeout: 30000 }).catch(() => {});
  await wait(2600);
});

// 8 · Bring your own person
await scene('yours', '/gui?new=1', async ({ page, wait, click, mark }) => {
  await wait(1000);
  mark('start');
  const field = page.locator('#pf-name');
  await click(field, 700);
  await page.keyboard.type('The Night Potter', { delay: 55 });
  await wait(500);
  const summary = page.locator('#pf-summary');
  if (await summary.count()) { await click(summary, 600); await page.keyboard.type('A ceramicist who glazes at 3am to Arthur Russell records.', { delay: 32 }); }
  await wait(1800);
});

await browser.close();

// Playwright records variable frame rate; the composition seeks by time, so give it constant 30 fps.
mkdirSync(join(OUT, 'cfr'), { recursive: true });
for (const name of Object.keys(clips)) {
  if (only && !only.split(',').includes(name)) continue;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(OUT, `${name}.webm`), '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-an', join(OUT, 'cfr', `${name}.mp4`)], { stdio: 'inherit' });
  console.log(`cfr/${name}.mp4`);
}
