import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { voiceAvailable, speechInput, readRecording, synthesizeSpeech, transcribeSpeech, VoiceLimits } from '../dist/src/gui/voice.js';

test('voice requires a server key and a separate opt-in for hosted accounts', () => {
  const key = process.env.FAL_KEY, enabled = process.env.BASTE_VOICE_ENABLED;
  try {
    delete process.env.FAL_KEY; delete process.env.BASTE_VOICE_ENABLED;
    assert.equal(voiceAvailable(false), false);
    process.env.FAL_KEY = 'test-only';
    assert.equal(voiceAvailable(false), true);
    assert.equal(voiceAvailable(true), false);
    process.env.BASTE_VOICE_ENABLED = 'true';
    assert.equal(voiceAvailable(true), true);
    process.env.BASTE_VOICE_ENABLED = 'false';
    assert.equal(voiceAvailable(false), false);
  } finally {
    if (key === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = key;
    if (enabled === undefined) delete process.env.BASTE_VOICE_ENABLED; else process.env.BASTE_VOICE_ENABLED = enabled;
  }
});

test('speech limits text and maps only known companions to provider voices', () => {
  assert.deepEqual(speechInput({ text: ' Hello ', voice: 'arbitrary' }, 'cyberbotanist'), { text: 'Hello', voice: 'Aria' });
  for (const text of ['', 123, 'x'.repeat(1601)]) assert.throws(() => speechInput({ text }, 'cyberbotanist'));
  assert.throws(() => speechInput({ text: 'Hello' }, 'unknown'));
});

test('voice rejects overlapping requests, rate limits callers, and expires limits', () => {
  const limits = new VoiceLimits();
  const release = limits.acquire('a', 1000);
  assert.throws(() => limits.acquire('a', 1000));
  release();
  for (let i = 0; i < 9; i++) limits.acquire('a', 1000)();
  assert.throws(() => limits.acquire('a', 1000));
  assert.doesNotThrow(() => limits.acquire('a', 61001)());
});

test('the hourly provider spending guard applies across identities', () => {
  const limits = new VoiceLimits();
  for (let i = 0; i < 120; i++) limits.acquire(`caller-${i}`, 1000)();
  assert.throws(() => limits.acquire('another', 1000));
  assert.doesNotThrow(() => limits.acquire('another', 3601001)());
});

function request(content: Buffer, type: string) {
  const stream = Readable.from([content]) as unknown as IncomingMessage;
  stream.headers = { 'content-type': type };
  return stream;
}

test('recordings accept bounded browser audio and reject forged or oversized uploads', async () => {
  const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(200)]);
  const result = await readRecording(request(webm, 'audio/webm;codecs=opus'));
  assert.equal(result.mime, 'audio/webm'); assert.deepEqual(result.audio, webm);
  await assert.rejects(readRecording(request(webm, 'image/png')));
  await assert.rejects(readRecording(request(Buffer.alloc(1024 * 1024 + 1), 'audio/webm')));
  await assert.rejects(readRecording(request(Buffer.alloc(200), 'audio/webm')));
});

test('provider account failures never expose raw upstream data', async () => {
  await assert.rejects(synthesizeSpeech({ text: 'Hi', voice: 'Aria' }, async () => new Response('{"detail":"TOP_UP private-account"}', { status: 403 })), error => {
    assert.match(String(error), /temporarily unavailable/); assert.doesNotMatch(String(error), /TOP_UP|private-account/); return true;
  });
});

test('speech downloads only fal media and never forwards the credential to the file host', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    if (calls === 1) {
      assert.match(String(url), /^https:\/\/fal.run\/fal-ai\/elevenlabs/);
      assert.ok(new Headers(init?.headers).has('Authorization'));
      return Response.json({ audio: { url: 'https://v3.fal.media/test.mp3' } });
    }
    assert.equal(new Headers(init?.headers).has('Authorization'), false);
    return new Response('audio');
  };
  assert.equal((await synthesizeSpeech({ text: 'Hi', voice: 'Aria' }, fetcher)).toString(), 'audio');
  assert.equal(calls, 2);
  for (const url of ['http://v3.fal.media/a', 'https://attacker.test/a', 'https://fal.media.attacker.test/a', 'https://user@v3.fal.media/a']) {
    await assert.rejects(synthesizeSpeech({ text: 'Hi', voice: 'Aria' }, async () => Response.json({ audio: { url } })));
  }
});

test('transcription sends inline audio and makes text truncation explicit', async () => {
  const result = await transcribeSpeech({ audio: Buffer.from('test'), mime: 'audio/webm' }, async (_url, init) => {
    const data = JSON.parse(String(init?.body));
    assert.equal(data.audio_url, 'data:audio/webm;base64,dGVzdA==');
    assert.equal(data.task, 'transcribe');
    return Response.json({ text: 'a'.repeat(610) });
  });
  assert.equal(result.text.length, 600); assert.equal(result.truncated, true);
});
