/**
 * Score the Baste tour (videos/baste-tour) with a quiet instrumental bed from fal.
 * Writes music/bed.mp3 once; delete it to compose a new one. The credential
 * never enters an artifact.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const project = resolve(import.meta.dirname, '..', 'videos/baste-tour');
const output = resolve(project, 'music');
await mkdir(output, { recursive: true });
const bed = resolve(output, 'bed.mp3');
try { await access(bed); console.log('music/bed.mp3 exists; delete it to compose again.'); process.exit(0); } catch { /* compose below */ }
const key = process.env.FAL_KEY || (process.argv.includes('--skate')
  ? execFileSync('rtk', ['proxy', 'skate', 'get', 'fal_api_key@secrets'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  : '');
if (!key) throw new Error('Set FAL_KEY or use --skate.');

const MODEL = 'fal-ai/stable-audio-25/text-to-audio';
const prompt = 'Warm, unhurried instrumental bed for a design product film: felt piano, soft upright bass, brushed snare, faint tape hiss, gentle major-seventh chords at 84 BPM. Calm, tactile, hand-made, no vocals, no drops, steady to the end.';
const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };
const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
  method: 'POST', redirect: 'error', headers,
  body: JSON.stringify({ prompt, seconds_total: 75, num_inference_steps: 8, guidance_scale: 1 }),
  signal: AbortSignal.timeout(60000),
});
if (!submit.ok) throw new Error(`Music: fal returned ${submit.status}.`);
const job = await submit.json();
const queue = new URL(job.status_url);
if (queue.origin !== 'https://queue.fal.run') throw new Error('Unexpected queue host.');
for (let i = 0; ; i++) {
  if (i > 120) throw new Error('Music took too long.');
  await new Promise(r => setTimeout(r, 2000));
  const status = await (await fetch(job.status_url, { headers, redirect: 'error' })).json();
  if (status.status === 'COMPLETED') break;
  if (status.status === 'FAILED' || status.error) throw new Error(`Music failed: ${status.error ?? 'unknown error'}.`);
}
const result = await (await fetch(job.response_url, { headers, redirect: 'error' })).json();
const url = new URL(result.audio?.url ?? '');
if (url.protocol !== 'https:' || !/(^|\.)fal\.media$/.test(url.hostname)) throw new Error('Unexpected audio host.');
const media = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
if (!media.ok) throw new Error(`Music download returned ${media.status}.`);
const raw = resolve(output, `bed-source${url.pathname.match(/\.\w+$/)?.[0] ?? '.wav'}`);
await writeFile(raw, Buffer.from(await media.arrayBuffer()));
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-26:TP=-3:LRA=7', '-ar', '44100', '-b:a', '192k', bed]);
await writeFile(resolve(output, 'bed.json'), JSON.stringify({ provider: 'fal', model: MODEL, prompt, seconds: 75, requestId: job.request_id, generatedAt: new Date().toISOString() }, null, 2) + '\n');
console.log('music/bed.mp3 written');
