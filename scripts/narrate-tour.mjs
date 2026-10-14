/**
 * Narrate the Baste tour (videos/baste-tour) with Cartesia Sonic (scripts/cartesia.mjs).
 * Lines come from videos/baste-tour/SCRIPT.md; each is generated once and cached.
 * Writes narration/<id>.mp3 and narration/timing.json, which the composition reads
 * to place each scene, then times every word with fal Whisper (narration/words.json)
 * for captions. Credentials never enter an artifact.
 *
 *   node scripts/narrate-tour.mjs --skate               # keys from Skate
 *   node scripts/narrate-tour.mjs --skate --keep-timing # fit new lines to the current cut
 *
 * --keep-timing keeps every scene where narration/timing.json has it, and fits each
 * new line to the length of the line it replaces, so build.mjs's edit still lands.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CARTESIA_MODEL, NARRATOR, cartesiaKey, speak } from './cartesia.mjs';

const root = resolve(import.meta.dirname, '..');
const project = resolve(root, 'videos/baste-tour');
const output = resolve(project, 'narration');
await mkdir(output, { recursive: true });
const key = process.env.FAL_KEY || (process.argv.includes('--skate')
  ? execFileSync('rtk', ['proxy', 'skate', 'get', 'fal_api_key@secrets'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  : '');
if (!key) throw new Error('Set FAL_KEY or use --skate.');
const voiceKey = cartesiaKey();
const keep = process.argv.includes('--keep-timing')
  ? JSON.parse(await readFile(resolve(output, 'timing.json'), 'utf8')).scenes
  : null;

// | # | id | scene | line |
const lines = (await readFile(resolve(project, 'SCRIPT.md'), 'utf8')).split('\n')
  .map(row => row.split('|').map(cell => cell.trim()))
  .filter(cells => /^\d+$/.test(cells[1] ?? ''))
  .map(cells => ({ id: cells[2], scene: cells[3], text: cells[4] }));
if (!lines.length) throw new Error('No narration lines found in SCRIPT.md.');

/** Pause before a scene's line, and breath after it, in seconds. */
const LEAD = 0.45;
const BREATH = 0.75;
const ffprobe = file => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' }).trim());

let cursor = 0;
const timing = [];
for (const line of lines) {
  const audio = resolve(output, `${line.id}.mp3`);
  const metadata = resolve(output, `${line.id}.json`);
  let cached = false;
  try {
    await access(audio);
    const meta = JSON.parse(await readFile(metadata, 'utf8'));
    cached = meta.text === line.text && meta.provider === 'cartesia' && meta.voiceId === NARRATOR.id;
  } catch { /* generate below */ }
  if (!cached) {
    const slot = keep?.find(scene => scene.id === line.id);
    let { audio: bytes, requestId } = await speak(line.text, { key: voiceKey });
    let speed = 1;
    const trim = (from, to, tempo = 1) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', from, '-af',
      `silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse${tempo === 1 ? '' : `,atempo=${tempo.toFixed(4)}`}`,
      '-ar', '44100', '-b:a', '192k', to]);
    const raw = resolve(output, `${line.id}.raw.mp3`);
    await writeFile(raw, bytes);
    if (slot) {
      // Fill the scene less its lead-in and a short breath. Cartesia's speed moves pace only about
      // 10%, so a gentle atempo trims what is left.
      const room = slot.duration - LEAD - 0.2;
      trim(raw, audio);
      speed = Math.min(1.25, Math.max(0.9, ffprobe(audio) / room));
      if (Math.abs(speed - 1) > 0.02) {
        ({ audio: bytes, requestId } = await speak(line.text, { key: voiceKey, speed }));
        await writeFile(raw, bytes);
        trim(raw, audio);
      }
      const tempo = ffprobe(audio) / room;
      if (tempo > 1.14) throw new Error(`${line.id}: needs ${tempo.toFixed(2)}× to fit; shorten the line or loosen the cut.`);
      if (tempo > 1) trim(raw, audio, tempo);
    } else trim(raw, audio);
    execFileSync('rm', ['-f', raw]);
    await writeFile(metadata, JSON.stringify({ provider: 'cartesia', model: CARTESIA_MODEL, voice: NARRATOR.name, voiceId: NARRATOR.id, speed: +speed.toFixed(3), text: line.text, requestId, generatedAt: new Date().toISOString() }, null, 2) + '\n');
    // The old word timings belong to the old voice.
    await writeFile(resolve(output, `${line.id}.words.json`), '{}\n');
  }
  const voice = ffprobe(audio);
  const slot = keep?.find(scene => scene.id === line.id);
  const duration = slot ? slot.duration : Math.ceil((LEAD + voice + BREATH) * 30) / 30; // whole frames at 30fps
  if (slot && voice > slot.duration - LEAD - 0.1) throw new Error(`${line.id}: ${voice.toFixed(2)}s of voice will not fit its ${slot.duration}s scene.`);
  timing.push({ id: line.id, scene: line.scene, text: line.text, start: +cursor.toFixed(3), duration: +duration.toFixed(3), voiceStart: +(cursor + LEAD).toFixed(3), voice: +voice.toFixed(3) });
  console.log(`${line.id}: ${voice.toFixed(2)}s voice → ${duration.toFixed(2)}s scene${cached ? ' (cached)' : ''}`);
  cursor += duration;
}
await writeFile(resolve(output, 'timing.json'), JSON.stringify({ voice: NARRATOR.name, provider: 'cartesia', total: +cursor.toFixed(3), scenes: timing }, null, 2) + '\n');
console.log(`Tour narration: ${cursor.toFixed(2)}s`);

// Word timings: Whisper hears each line, and its words are matched back to the
// script so captions keep the written spelling and punctuation.
const norm = word => word.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
function align(script, heard) {
  const a = script.map(norm), b = heard.map(h => norm(h.text));
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    L[i][j] = a[i] && a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = new Array(a.length).fill(null);
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] && a[i] === b[j]) { hit[i] = heard[j]; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  // Words Whisper heard differently ("25" for "twenty-five") share the gap between matched neighbours.
  const words = [];
  for (let i = 0; i < script.length;) {
    if (hit[i]) { words.push({ text: script[i], start: hit[i].start, end: hit[i].end }); i++; continue; }
    let k = i; while (k < script.length && !hit[k]) k++;
    const from = words.at(-1)?.end ?? heard[0]?.start ?? 0;
    const to = hit[k]?.start ?? heard.at(-1)?.end ?? from;
    const weight = script.slice(i, k).map(w => w.length + 1), total = weight.reduce((x, y) => x + y, 0);
    let at = from;
    for (let n = i; n < k; n++) { const d = (to - from) * weight[n - i] / total; words.push({ text: script[n], start: at, end: at + d }); at += d; }
    i = k;
  }
  return words.map(w => ({ text: w.text, start: +w.start.toFixed(3), end: +w.end.toFixed(3) }));
}
const allWords = [];
for (const scene of timing) {
  const cache = resolve(output, `${scene.id}.words.json`);
  let heard;
  try {
    const saved = JSON.parse(await readFile(cache, 'utf8'));
    if (saved.text === scene.text) heard = saved.heard;
  } catch { /* transcribe below */ }
  if (!heard) {
    const audio = await readFile(resolve(output, `${scene.id}.mp3`));
    const response = await fetch('https://fal.run/fal-ai/whisper', {
      method: 'POST', redirect: 'error',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json', 'X-Fal-Store-IO': '0' },
      body: JSON.stringify({ audio_url: `data:audio/mpeg;base64,${audio.toString('base64')}`, task: 'transcribe', language: 'en', chunk_level: 'word', version: '3' }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Word timing ${scene.id}: fal returned ${response.status}.`);
    const data = await response.json();
    heard = (data.chunks ?? []).filter(c => Array.isArray(c.timestamp)).map(c => ({ text: String(c.text).trim(), start: Number(c.timestamp[0]), end: Number(c.timestamp[1] ?? c.timestamp[0]) }));
    if (!heard.length) throw new Error(`Word timing ${scene.id}: no words came back.`);
    await writeFile(cache, JSON.stringify({ model: 'fal-ai/whisper', text: scene.text, heard }, null, 2) + '\n');
  }
  const words = align(scene.text.split(/\s+/).filter(Boolean), heard);
  allWords.push({ id: scene.id, voiceStart: scene.voiceStart, words: words.map(w => ({ ...w, start: +(scene.voiceStart + w.start).toFixed(3), end: +(scene.voiceStart + w.end).toFixed(3) })) });
  console.log(`${scene.id}: ${words.length} words timed`);
}
await writeFile(resolve(output, 'words.json'), JSON.stringify({ scenes: allWords }, null, 2) + '\n');
