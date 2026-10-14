/**
 * Narrate the existing browser recording with Cartesia Sonic (scripts/cartesia.mjs).
 *   node scripts/narrate-studio-guide.mjs --skate
 * The credential never enters an artifact.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CARTESIA_MODEL, NARRATOR, cartesiaKey, speak } from './cartesia.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'media/studio-guide-narration');
const published = resolve(root, 'site/public/media/studio-guide/current');
await mkdir(output, { recursive: true });
const key = cartesiaKey();

const script = [
  { id: 'fitting', start: 0, end: 8, text: 'Start with a persona. Fitting shows how their world becomes colour, type, and an interface.', fr: 'Commencez par un persona. Fitting traduit son univers en couleurs, en typographie et en interface.' },
  { id: 'material', start: 8, end: 14.2, text: 'In Material, adjust the cloth. Your changes stay in this browser.', fr: 'Dans Material, ajustez le tissu. Vos modifications restent dans ce navigateur.' },
  { id: 'tokens', start: 14.2, end: 19.2, text: 'Tokens gives you the design system, with OpenPencil here too.', fr: 'Tokens contient le système de design. OpenPencil se trouve ici aussi.' },
  { id: 'moodboard', start: 19.2, end: 24.6, text: 'Keep references and notes together in Moodboard.', fr: 'Rassemblez vos références et vos notes dans Moodboard.' },
  { id: 'feedback', start: 24.6, end: 29.12, text: 'Use Taste to say what works for you, and why.', fr: 'Dans Taste, indiquez ce qui vous plaît, et pourquoi.' },
];
const run = (cmd, args) => execFileSync('rtk', ['proxy', cmd, ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
let cursor = 0;
for (const line of script) {
  const audio = resolve(output, `${line.id}.mp3`);
  const metadata = resolve(output, `${line.id}.json`);
  let cached = false;
  try { await access(audio); cached = JSON.parse(await readFile(metadata, 'utf8')).voiceId === NARRATOR.id; } catch { /* generate below */ }
  if (!cached) {
    const { audio: bytes, requestId } = await speak(line.text, { key });
    const raw = resolve(output, `${line.id}.raw.mp3`);
    await writeFile(raw, bytes);
    run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5', '-ar', '48000', '-b:a', '192k', audio]);
    run('rm', ['-f', raw]);
    await writeFile(metadata, JSON.stringify({ provider: 'cartesia', model: CARTESIA_MODEL, voice: NARRATOR.name, voiceId: NARRATOR.id, text: line.text, requestId, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  }
  const duration = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audio]).trim());
  const hold = Math.ceil(Math.max(line.end - line.start, duration + 0.7) * 25) / 25;
  line.voiceDuration = duration;
  line.publishedStart = cursor;
  line.publishedEnd = cursor + hold;
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(line.start), '-t', String(line.end - line.start), '-i', resolve(published, 'current-studio.mp4'), '-i', audio, '-filter_complex', `[0:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${hold}[v];[1:a]adelay=200|200,apad[a]`, '-map', '[v]', '-map', '[a]', '-t', String(hold), '-r', '25', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', resolve(output, `${line.id}.mp4`)]);
  cursor += hold;
  console.log(`${line.id}: ${duration.toFixed(2)}s voice, ${hold.toFixed(2)}s picture`);
}
await writeFile(resolve(output, 'concat.txt'), script.map(line => `file '${line.id}.mp4'`).join('\n') + '\n');
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', resolve(output, 'concat.txt'), '-c', 'copy', '-movflags', '+faststart', resolve(published, 'current-narrated.mp4')]);
const stamp = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);
for (const lang of ['en', 'fr']) await writeFile(resolve(published, `current-${lang}.vtt`), 'WEBVTT\n\n' + script.map(line => `${stamp(line.publishedStart + 0.2)} --> ${stamp(line.publishedEnd)}\n${lang === 'en' ? line.text : line.fr}\n`).join('\n'));
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ source: 'site/public/media/studio-guide/current/current-studio.mp4', output: 'site/public/media/studio-guide/current/current-narrated.mp4', duration: cursor, provider: 'cartesia', voice: NARRATOR.name, language: 'en', captions: ['en', 'fr'], lines: script }, null, 2) + '\n');
await writeFile(resolve(root, 'site/src/components/docs/current-recording.json'), JSON.stringify({ file: 'current-narrated.mp4', duration: cursor, narrated: true, language: 'en', steps: script.map(line => [line.text, line.fr]) }, null, 2) + '\n');
console.log(`Narrated walkthrough: ${cursor.toFixed(2)}s`);
