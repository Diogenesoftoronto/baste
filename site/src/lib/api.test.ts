import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { connect } from './api';

test('unavailable public API enters an isolated demo and generation makes no provider requests', async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  try {
    globalThis.fetch = async (url) => {
      requests.push(String(url));
      return new Response('Not found', { status: 404 });
    };
    const first = await connect('/api');
    const second = await connect('/api');
    assert.equal(first.mode, 'demo');
    assert.equal(second.mode, 'demo');
    const persona = (await first.listPersonas())[0];
    await first.createPersona({ ...persona, id: 'tab-only', name: 'Tab only' });
    assert.equal((await first.listPersonas()).some((p) => p.id === 'tab-only'), true);
    assert.equal((await second.listPersonas()).some((p) => p.id === 'tab-only'), false);
    const { jobId } = await first.generate(persona.id, { type: 'suite', dryRun: false });
    assert.ok((await first.getJob(jobId)).logs.length);
    await assert.rejects(first.decompose({ url: 'https://example.com' }), /local Baste server/);
    assert.deepEqual(requests, ['/api/health', '/api/health']);
  } finally {
    globalThis.fetch = original;
  }
});
