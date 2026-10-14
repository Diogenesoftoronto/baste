/**
 * English narration through Cartesia Sonic, shared by the tour and Studio guide
 * narration scripts. The key comes from CARTESIA_API_KEY, or from Skate with
 * --skate; it is only held in the process and never written to an artifact.
 */
import { execFileSync } from 'node:child_process';

export const CARTESIA_MODEL = 'sonic-3.6';
/** Theo: "steady, enunciating, confident young male for narrations." */
export const NARRATOR = { id: '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e', name: 'Theo' };

export function cartesiaKey() {
  const key = process.env.CARTESIA_API_KEY || (process.argv.includes('--skate')
    ? execFileSync('rtk', ['proxy', 'skate', 'get', 'cartesia_api_key@secrets'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    : '');
  if (!key) throw new Error('Set CARTESIA_API_KEY or use --skate.');
  return key;
}

/** One line of narration as a 44.1 kHz MP3. `speed` is Cartesia's 0.6–1.5 multiplier. */
export async function speak(text, { key, voice = NARRATOR.id, speed = 1, emotion } = {}) {
  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${key}`, 'Cartesia-Version': '2026-08-14', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_id: CARTESIA_MODEL, transcript: text, voice: { mode: 'id', id: voice }, language: 'en',
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 192000 },
      generation_config: { speed, ...(emotion ? { emotion } : {}) },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Cartesia returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}.`);
  }
  return { audio: Buffer.from(await response.arrayBuffer()), requestId: response.headers.get('x-request-id') };
}
