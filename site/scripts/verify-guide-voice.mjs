// Run against a production preview with /api proxied to a local Baste server.
// Uses synthetic microphone audio and an existing recording for provider fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.VOICE_QA_URL || 'http://localhost:5184';
const output = path.resolve(process.env.VOICE_QA_OUTPUT || '../.baste/qa/studio-voice');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const checks = [], errors = [];
const check = name => { checks.push(name); console.log(`PASS ${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/docs/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.guide-chapter').count(), 25);
  assert.equal(await page.locator('main').evaluate(el => /devenv|FAL_KEY|X-Baste-CSRF|DPoP/.test(el.innerText)), false);
  await page.screenshot({ path: path.join(output, 'guide-desktop.png') });
  check('25 customer guide chapters, with developer setup separated');
  const video = page.locator('video');
  await video.evaluate(async el => { el.muted = true; await el.play(); });
  await page.waitForFunction(() => document.querySelector('video').currentTime > .4);
  await video.evaluate(el => { el.pause(); el.currentTime = 20; });
  await page.waitForFunction(() => Math.abs(document.querySelector('video').currentTime - 20) < .2 && document.querySelector('video').readyState >= 2);
  assert.equal(await video.evaluate(el => el.textTracks[0]?.cues?.length), 5);
  check('Current MP4 plays, seeks and has five caption cues');
  const urls = await page.locator('main img,main a[download],video source,video track').evaluateAll(els => [...new Set(els.map(el => el.src || el.href))]);
  for (const url of urls) { const res = await page.request.get(url, { headers: { Range: 'bytes=0-127' } }); assert.ok(res.ok(), url); if (/\.mp4$/.test(url)) assert.equal(res.status(), 206); }
  check('Guide images, downloads and captions load; video range requests return 206');
  for (const [name, duration, language] of [['Narrated tour · English', 112.88, 'en'], ['Visite commentée · Français', 116.04, 'fr']]) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await page.waitForFunction(() => document.querySelector('video').readyState >= 1);
    await page.locator('video').evaluate(async el => { el.muted = true; await el.play(); });
    await page.waitForFunction(() => document.querySelector('video').currentTime > .2);
    assert.ok(Math.abs(await page.locator('video').evaluate(el => el.duration) - duration) < .2);
    assert.equal(await page.locator('track').getAttribute('srclang'), language);
    await page.locator('video').evaluate(el => el.pause());
  }
  check('Archived English and French narrated tours play with their caption languages');
  await page.goto(`${base}/docs/#cli`, { waitUntil: 'networkidle' });
  await page.waitForURL('**/docs/developers/#cli');
  assert.ok(await page.getByRole('heading', { name: 'Developer docs.' }).isVisible());
  check('Legacy developer links redirect to the separate developer page');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.goto(`${base}/docs/?lang=fr`, { waitUntil: 'networkidle' });
  await page.getByRole('combobox', { name: 'Aller à un chapitre' }).selectOption('material');
  await page.waitForFunction(() => document.getElementById('material').open);
  assert.equal(await page.locator('main').getAttribute('lang'), 'fr');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(output, 'guide-mobile.png') });
  check('French guide and chapter navigation work at 390px without overflow');

  const fixture = await readFile(path.resolve('public/media/studio-guide/walkthrough-en.mp4'));
  let speechDelay = 250, transcriptDelay = 250;
  const requests = [];
  await page.route('**/api/voice/speak/*', async route => {
    requests.push({ kind: 'speech', url: route.request().url(), body: route.request().postDataJSON() });
    await new Promise(resolve => setTimeout(resolve, speechDelay));
    await route.fulfill({ status: 200, contentType: 'audio/mp4', body: fixture }).catch(() => {});
  });
  await page.route('**/api/voice/transcribe', async route => {
    requests.push({ kind: 'transcription', bytes: route.request().postDataBuffer()?.length });
    await new Promise(resolve => setTimeout(resolve, transcriptDelay));
    await route.fulfill({ status: 200, json: { text: 'Why these colours?', truncated: false } }).catch(() => {});
  });
  await page.addInitScript(() => {
    window.__tracks = [];
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await get(constraints);
      window.__tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto(`${base}/#meet`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Listen to reply' }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'speaking');
  assert.equal(await page.locator('.companion-portrait').evaluate(el => getComputedStyle(el).transform), 'none');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'paused');
  assert.equal(await page.locator('[data-voice-state]').evaluate(el => Number(el.style.getPropertyValue('--voice-level'))), 0);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'speaking');
  await page.getByRole('button', { name: 'Stop voice', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'idle');
  check('Production playback pauses, resumes and stops; reduced motion keeps the portrait still');
  await page.locator('#converse-input').fill('My thought:');
  await page.getByRole('button', { name: 'Talk', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'listening');
  await page.waitForTimeout(750);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'idle');
  assert.equal(await page.locator('#converse-input').inputValue(), 'My thought: Why these colours?');
  assert.equal(await page.locator('[data-from=you]').count(), 0);
  assert.equal(await page.evaluate(() => window.__tracks.every(t => t.readyState === 'ended')), true);
  check('Microphone transcription appends to the editable draft without sending and releases tracks');
  await page.getByRole('button', { name: 'Spoken replies off' }).click();
  await page.locator('#converse-input').fill('Why these colours?');
  await page.locator('#converse-input').press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'speaking');
  assert.equal(await page.locator('[data-from=you]').count(), 1);
  assert.match(requests.at(-1).body.text, /brown|mint|palette|ground/i);
  await page.getByRole('tab', { name: /Ren/ }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'idle');
  check('Spoken replies follow an opted-in turn; changing companions stops playback');
  speechDelay = 1200;
  await page.getByRole('button', { name: 'Listen to reply' }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'preparing');
  await page.getByRole('tab', { name: /Ada/ }).click();
  await page.waitForTimeout(1400);
  assert.equal(await page.locator('[data-voice-state]').getAttribute('data-voice-state'), 'idle');
  check('A late speech response cannot speak as a newly selected companion');
  transcriptDelay = 1200;
  await page.getByRole('button', { name: 'Talk', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'listening');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-voice-state]').dataset.voiceState === 'transcribing');
  await page.getByRole('tab', { name: /Moss/ }).click();
  await page.waitForTimeout(1400);
  assert.equal(await page.locator('#converse-input').inputValue(), '');
  assert.equal(await page.evaluate(() => window.__tracks.every(t => t.readyState === 'ended')), true);
  check('Cancelled transcription cannot overwrite another companion’s draft');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('#meet').screenshot({ path: path.join(output, 'voice-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#meet').screenshot({ path: path.join(output, 'voice-desktop.png') });
  check('Desktop and mobile voice layouts fit, with recorded screenshots');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ checks, pageErrors: errors, voiceTransport: 'mock', microphone: 'Chromium synthetic audio', physicalDevice: false, sources: requests.map(({kind,url,bytes}) => ({kind,url,bytes})) }, null, 2) + '\n');
} finally { await browser.close(); }
