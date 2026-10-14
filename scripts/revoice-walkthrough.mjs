/**
 * Re-voice the published English Studio walkthrough with Cartesia Sonic (scripts/cartesia.mjs).
 *
 *   node scripts/revoice-walkthrough.mjs --skate
 *
 * The walkthrough's picture is kept. Each sentence in captions-en.vtt is spoken again
 * and placed at its cue's start, fitted so it ends before the next sentence begins;
 * the caption timings stay true. The original is kept beside it as walkthrough-en.source.mp4
 * on the first run, so re-running always starts from the original picture.
 */
import { execFileSync } from 'node:child_process';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CARTESIA_MODEL, NARRATOR, cartesiaKey, speak } from './cartesia.mjs';

const root = resolve(import.meta.dirname, '..');
const media = resolve(root, 'site/public/media/studio-guide');
const work = resolve(root, 'media/studio-guide-narration/walkthrough-en');
await mkdir(work, { recursive: true });
const source = resolve(media, 'walkthrough-en.source.mp4');
try { await access(source); } catch { await copyFile(resolve(media, 'walkthrough-en.mp4'), source); }
const key = cartesiaKey();

const ffmpeg = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const seconds = file => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
const stamp = t => { const [h, m, s] = t.split(':'); return +h * 3600 + +m * 60 + +s; };

// Cues split mid-sentence for line length are joined back into one spoken sentence.
const cues = (await readFile(resolve(media, 'captions-en.vtt'), 'utf8')).trim().split(/\n\n+/)
  .map(block => block.split('\n')).filter(lines => lines.some(l => l.includes('-->')))
  .map(lines => { const i = lines.findIndex(l => l.includes('-->')); const [a, b] = lines[i].split(' --> '); return { start: stamp(a), end: stamp(b.split(' ')[0]), text: lines.slice(i + 1).join(' ') }; });
const sentences = [];
for (const cue of cues) {
  const last = sentences.at(-1);
  if (last && !/[.!?:;]["”’]?$/.test(last.text)) { last.text += ` ${cue.text}`; last.end = cue.end; }
  else sentences.push({ ...cue });
}
const total = seconds(source);

const parts = [];
for (const [i, line] of sentences.entries()) {
  const room = Math.min((sentences[i + 1]?.start ?? total) - line.start - 0.25, line.end - line.start + 0.6);
  const file = resolve(work, `${String(i).padStart(2, '0')}.mp3`);
  const meta = resolve(work, `${String(i).padStart(2, '0')}.json`);
  let cached = false;
  try { const m = JSON.parse(await readFile(meta, 'utf8')); cached = m.text === line.text && m.voiceId === NARRATOR.id; } catch { /* speak below */ }
  if (!cached) {
    let speed = 1;
    let { audio, requestId } = await speak(line.text, { key });
    const raw = resolve(work, 'raw.mp3');
    const trim = (tempo = 1) => ffmpeg('-i', raw, '-af', `silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse${tempo > 1 ? `,atempo=${tempo.toFixed(4)}` : ''}`, '-ar', '48000', '-ac', '1', '-b:a', '192k', file);
    await writeFile(raw, audio); trim();
    if (seconds(file) > room) {
      speed = Math.min(1.25, seconds(file) / room);
      ({ audio, requestId } = await speak(line.text, { key, speed }));
      await writeFile(raw, audio); trim();
      const tempo = seconds(file) / room;
      if (tempo > 1.15) throw new Error(`Sentence ${i} needs ${tempo.toFixed(2)}× to fit: “${line.text}”`);
      if (tempo > 1) trim(tempo);
    }
    await writeFile(meta, JSON.stringify({ provider: 'cartesia', model: CARTESIA_MODEL, voice: NARRATOR.name, voiceId: NARRATOR.id, speed: +speed.toFixed(3), text: line.text, requestId }, null, 2) + '\n');
  }
  parts.push({ file, start: line.start });
  console.log(`${String(i).padStart(2, '0')} ${line.start.toFixed(2)}s  ${seconds(file).toFixed(2)}/${room.toFixed(2)}s  ${line.text.slice(0, 60)}`);
}

// Lay every sentence at its start, level the whole track, and put it under the original picture.
const inputs = parts.flatMap(p => ['-i', p.file]);
const delays = parts.map((p, i) => `[${i + 1}:a]adelay=${Math.round(p.start * 1000)}:all=1[a${i}]`).join(';');
const mix = `${delays};${parts.map((_, i) => `[a${i}]`).join('')}amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${total},loudnorm=I=-16:TP=-1.5:LRA=11[voice]`;
ffmpeg('-i', source, ...inputs, '-filter_complex', mix, '-map', '0:v', '-map', '[voice]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', resolve(media, 'walkthrough-en.mp4'));
const vtt = resolve(media, 'captions-en.vtt');
await writeFile(vtt, (await readFile(vtt, 'utf8')).replace(/^NOTE .*$/m, `NOTE Narrated edition. Voice: Cartesia ${CARTESIA_MODEL}, ${NARRATOR.name}; each sentence placed at its caption's start over the captured screens.`));
console.log(`walkthrough-en.mp4: ${sentences.length} sentences re-voiced over ${total.toFixed(2)}s`);
