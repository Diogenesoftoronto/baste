import type { IncomingMessage } from 'node:http';
import { AccountError } from '../notorganic/server.js';

export const VOICE_TEXT_LIMIT = 1600;
export const VOICE_AUDIO_LIMIT = 1024 * 1024;
const VOICES: Record<string, string> = { cyberbotanist: 'Aria', nightmarketcoder: 'Roger', liminalweeb: 'Sarah' };

/** Hosted use is an explicit operator-funded service, never a wallet charge. */
export function voiceAvailable(accountMode: boolean): boolean {
  return !!process.env.FAL_KEY?.trim() && process.env.BASTE_VOICE_ENABLED !== 'false'
    && (!accountMode || process.env.BASTE_VOICE_ENABLED === 'true');
}

export function speechInput(body: Record<string, unknown>, id: string): { text: string; voice: string } {
  if (!VOICES[id]) throw new AccountError(404, 'This companion has no voice yet.');
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > VOICE_TEXT_LIMIT) {
    throw new AccountError(400, `Speech needs between 1 and ${VOICE_TEXT_LIMIT} characters.`);
  }
  return { text: body.text.trim(), voice: VOICES[id] };
}

/** Bounded allocation and spending. Do not trust forwarded addresses from clients. */
export class VoiceLimits {
  private callers = new Map<string, { used: number; until: number }>();
  private total = { used: 0, until: 0 };
  private active = new Set<string>();
  acquire(caller: string, now = Date.now()): () => void {
    for (const [id, value] of this.callers) if (value.until <= now) this.callers.delete(id);
    if (this.total.until <= now) this.total = { used: 0, until: now + 3600000 };
    const entry = this.callers.get(caller) ?? { used: 0, until: now + 60000 };
    if (entry.used >= 10 || this.total.used >= 120) throw new AccountError(429, 'Voice has reached its limit. Please try again later; you can still type.');
    if (this.active.has(caller) || this.active.size >= 4) throw new AccountError(429, 'Another voice request is finishing. Try again in a moment.');
    if (this.callers.size >= 1000 && !this.callers.has(caller)) throw new AccountError(503, 'Voice is busy. You can still type.');
    entry.used++; this.total.used++;
    this.callers.set(caller, entry); this.active.add(caller);
    return () => { this.active.delete(caller); };
  }
}

async function bytes(response: Response, max: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new AccountError(502, 'The voice recording did not arrive.');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) throw new AccountError(502, 'The voice recording was too large.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}

export async function readRecording(req: IncomingMessage): Promise<{ audio: Buffer; mime: string }> {
  const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim();
  if (!['audio/webm', 'audio/mp4', 'audio/wav', 'audio/mpeg'].includes(mime)) throw new AccountError(415, 'This recording format is not supported.');
  const chunks: Buffer[] = []; let size = 0;
  for await (const part of req) {
    const chunk = Buffer.from(part); size += chunk.length;
    if (size > VOICE_AUDIO_LIMIT) throw new AccountError(413, 'That recording is too long. Please try a shorter message.');
    chunks.push(chunk);
  }
  if (size < 100) throw new AccountError(400, 'No recording was received.');
  const audio = Buffer.concat(chunks);
  const isWebm = audio.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const isMp4 = audio.subarray(4, 8).toString() === 'ftyp';
  const isWav = audio.subarray(0, 4).toString() === 'RIFF' && audio.subarray(8, 12).toString() === 'WAVE';
  const isMp3 = audio.subarray(0, 3).toString() === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0);
  if (!({ 'audio/webm': isWebm, 'audio/mp4': isMp4, 'audio/wav': isWav, 'audio/mpeg': isMp3 }[mime])) throw new AccountError(400, 'The recording is not valid audio.');
  return { audio, mime };
}

async function fal(model: string, input: object, fetcher: typeof fetch, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetcher(`https://fal.run/${model}`, {
    method: 'POST', redirect: 'error',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json', 'X-Fal-Store-IO': '0' },
    body: JSON.stringify(input), signal: AbortSignal.any([AbortSignal.timeout(45000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) {
    // Provider errors may contain account information: never return the raw body.
    throw new AccountError(response.status === 429 ? 429 : 503, 'Voice is temporarily unavailable. Your conversation is still here; you can keep typing.');
  }
  return JSON.parse((await bytes(response, 1024 * 1024)).toString());
}

export async function synthesizeSpeech(input: { text: string; voice: string }, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<Buffer> {
  const result = await fal('fal-ai/elevenlabs/tts/turbo-v2.5', { ...input, stability: 0.55, similarity_boost: 0.75, speed: 1 }, fetcher, signal);
  const raw = (result.audio as { url?: unknown } | undefined)?.url;
  let url: URL;
  try { url = new URL(String(raw)); } catch { throw new AccountError(502, 'The voice recording did not arrive.'); }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.fal.media') || url.username || url.password || url.port) throw new AccountError(502, 'The voice recording could not be loaded.');
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]) });
  if (!response.ok) throw new AccountError(502, 'The voice recording could not be loaded.');
  return bytes(response, 8 * 1024 * 1024);
}

export async function transcribeSpeech(recording: { audio: Buffer; mime: string }, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
  const result = await fal('fal-ai/wizper', { audio_url: `data:${recording.mime};base64,${recording.audio.toString('base64')}`, task: 'transcribe', language: null, chunk_level: 'segment' }, fetcher, signal);
  if (typeof result.text !== 'string') throw new AccountError(502, 'The transcript did not arrive. Try recording again, or type your message.');
  const text = result.text.trim();
  return { text: text.slice(0, 600), truncated: text.length > 600 };
}
