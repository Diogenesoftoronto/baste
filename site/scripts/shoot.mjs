import { createRequire } from 'node:module';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

// Use the project's Playwright when installed, or the existing baseline tools.
const require = createRequire(import.meta.url);
const baseline = '/tmp/claude-1000/-home-diogenes-Projects-baste/40a87545-7663-4a10-81f4-c7c198aae9b3/scratchpad';
let chromium;
for (const module of [process.env.PLAYWRIGHT_MODULE, 'playwright', `${baseline}/qa-tools/node_modules/playwright`].filter(Boolean)) {
  try { ({ chromium } = require(module)); break; } catch {}
}
if (!chromium) throw new Error('Playwright unavailable. Install it or set PLAYWRIGHT_MODULE.');

const [outArg, ...args] = process.argv.slice(2);
if (!outArg || !args.length) throw new Error('Usage: node site/scripts/shoot.mjs <outDir> name=path[@WxH][#full|#viewport][!motion]... [--interactions]');
const out = path.resolve(outArg);
const baseUrl = process.env.SHOOT_BASE_URL || 'http://localhost:5199';
await mkdir(out, { recursive: true });
const report = args.includes('--append') ? JSON.parse(await readFile(path.join(out, 'v2-qa.json'), 'utf8')) : { startedAt: new Date().toISOString(), baseUrl, captures: [], interactions: [] };
const persist = () => writeFile(path.join(out, 'v2-qa.json'), JSON.stringify(report, null, 2));
function parse(spec) {
  const match = spec.match(/^([^=]+)=(.+?)(?:@(\d+)x(\d+))?(?:#(full|viewport))?(!motion)?$/);
  if (!match || !/^[\w-]+$/.test(match[1])) throw new Error(`Invalid spec: ${spec}`);
  return { name: match[1], route: match[2], viewport: { width: Number(match[3] || 1440), height: Number(match[4] || 900) }, fullPage: match[5] !== 'viewport', motion: !!match[6] };
}
const specs = args.filter(x => !['--interactions', '--append'].includes(x)).map(parse);
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function open(spec) {
  const context = await browser.newContext({ viewport: spec.viewport, deviceScaleFactor: 1, reducedMotion: spec.motion ? 'no-preference' : 'reduce', isMobile: spec.viewport.width < 500, hasTouch: spec.viewport.width < 500 });
  const page = await context.newPage();
  const events = { consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [] };
  page.on('console', m => { if (m.type() === 'error') events.consoleErrors.push({ text: m.text(), location: m.location() }); });
  page.on('pageerror', e => events.pageErrors.push(e.stack || e.message));
  page.on('requestfailed', r => events.failedRequests.push({ url: r.url(), method: r.method(), error: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) events.httpErrors.push({ url: r.url(), status: r.status() }); });
  const response = await page.goto(new URL(spec.route, baseUrl).href, { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  return { page, context, events, status: response?.status() };
}
async function capture(session, spec, extra = {}) {
  const { page, events, status } = session;
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  const evidence = await page.evaluate(() => {
    const overflowing = [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1);
    return {
      innerWidth, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
      overflowCount: overflowing.length,
      overflow: overflowing.slice(0, 10).map(el => ({ element: `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).trim().replace(/\s+/g, '.').slice(0, 180)}`, right: Math.round(el.getBoundingClientRect().right * 100) / 100, text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 90) })),
      webglMounted: !!document.querySelector('canvas[data-ready="true"]'),
      canvases: [...document.querySelectorAll('canvas')].map(el => ({ ready: el.dataset.ready, width: el.width, height: el.height, opacity: getComputedStyle(el).opacity })),
    };
  });
  const destination = path.join(out, `${spec.name}.png`);
  // SwiftShader corrupts captures taller than its 8192px texture limit.
  // Capture smaller page-coordinate clips, then join them without rescaling.
  if (spec.fullPage && evidence.documentHeight > 8000) {
    const parts = [];
    try {
      for (let y = 0; y < evidence.documentHeight; y += 6000) {
        const part = path.join(out, `.${spec.name}-part-${y}.png`);
        parts.push(part);
        await page.screenshot({ path: part, fullPage: true, clip: { x: 0, y, width: Math.max(evidence.innerWidth, evidence.documentWidth), height: Math.min(6000, evidence.documentHeight - y) }, timeout: 60000 });
      }
      await promisify(execFile)('rtk', ['proxy', 'magick', ...parts, '-append', '+repage', destination]);
    } finally { await Promise.all(parts.map(part => unlink(part).catch(() => {}))); }
  } else {
    await page.screenshot({ path: destination, fullPage: spec.fullPage, timeout: 60000 });
  }
  const entry = { file: `${spec.name}.png`, ...spec, status, ...evidence, ...structuredClone(events), ...extra };
  report.captures = report.captures.filter(c => c.file !== entry.file);
  report.captures.push(entry);
  console.log(JSON.stringify(entry));
  await persist();
  for (const list of Object.values(events)) list.length = 0;
}
try {
  for (const spec of specs) {
    const session = await open(spec);
    try { await capture(session, spec); } finally { await session.context.close(); }
  }
  if (args.includes('--interactions')) {
    const spec = parse('v2-gui-generate-done=/gui/?persona=cyberbotanist&tab=generate@1440x900');
    const session = await open(spec);
    try {
      const dryRun = session.page.getByRole('checkbox', { name: /Dry run/i });
      const checked = await dryRun.isChecked();
      if (!checked) throw new Error('Dry run was not checked; refusing a paid generation.');
      await session.page.getByRole('button', { name: 'Draft the prompts', exact: true }).click();
      await session.page.waitForFunction(() => [...document.querySelectorAll('h2')].some(el => el.textContent.trim() === 'Finished'), null, { timeout: 20000 });
      const log = await session.page.locator('pre[aria-live]').innerText();
      await session.page.waitForTimeout(1200);
      const logShowsCompletion = /complete|finished|done|drafted/i.test(log);
      report.interactions.push({ action: 'dry-run', checked, completed: true, logShowsCompletion, log });
      await capture(session, spec, { dryRunChecked: checked, completed: true, logShowsCompletion, completionLog: log });
    } catch (error) {
      report.interactions.push({ action: 'dry-run', completed: false, error: error.stack });
      await capture(session, spec, { interactionError: error.message });
      process.exitCode = 1;
    } finally { await session.context.close(); }
    const heroSpec = parse('v2-hero-0=/@1440x900#viewport!motion');
    const hero = await open(heroSpec);
    try {
      const tabs = hero.page.locator('#fitting [role="tablist"] [role="tab"]');
      const count = await tabs.count();
      if (!count) throw new Error('No hero persona tabs found.');
      for (let i = 0; i < count; i++) {
        const label = await tabs.nth(i).innerText();
        await tabs.nth(i).click();
        await hero.page.waitForTimeout(1500);
        const selected = await tabs.nth(i).getAttribute('aria-selected');
        report.interactions.push({ action: 'hero-tab', index: i, label, selected });
        await capture(hero, { ...heroSpec, name: `v2-hero-${i}` }, { tabLabel: label, selected });
      }
    } finally { await hero.context.close(); }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  await persist();
  await browser.close();
}
