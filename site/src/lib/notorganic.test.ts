import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { accountRequest, availableBalance, emptyHostedAccount, refreshHostedAccount, walletBlocked } from './notorganic';
import { createClient } from './api';

test('wallet uses scoped credit, rejects invalid balances and respects reservations and debt', () => {
  assert.equal(availableBalance({ availableMicros: 2000000, balanceMicros: 9000000 }), 2000000);
  assert.equal(availableBalance({ availableMicros: -1, balanceMicros: 9000000 }), null);
  assert.equal(availableBalance({ availableMicros: Number.NaN }), null);
  assert.equal(availableBalance({ balanceMicros: 9000000, reservedMicros: 2000000 }), 7000000);
  assert.equal(availableBalance({ balanceMicros: 1000000, reservedMicros: 2000000 }), 0);
  assert.equal(availableBalance(null), null);
  assert.equal(walletBlocked({ debtMicros: 1 }), true);
  assert.equal(walletBlocked({ hostedInferenceBlocked: true }), true);
});

test('account mutation carries cookies and the CSRF token, and reports provider rejection', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/notorganic/checkout');
      assert.equal(init?.credentials, 'include');
      assert.equal(init?.method, 'POST');
      assert.equal(new Headers(init?.headers).get('X-Baste-CSRF'), 'test-token');
      assert.equal(init?.body, JSON.stringify({ packId: 'approved-pack' }));
      return new Response(JSON.stringify({ error: 'Checkout is unavailable' }), { status: 503 });
    };
    await assert.rejects(accountRequest('/api/', 'checkout', 'test-token', { packId: 'approved-pack' }), /Checkout is unavailable/);
  } finally { globalThis.fetch = original; }
});

test('sign-out clears previous models and wallet, while independent catalog failure preserves verified wallet', async () => {
  const original = globalThis.fetch;
  const account = emptyHostedAccount();
  account.models = [{ id: 'old-image', kind: 'image' }];
  account.wallet = { availableMicros: 1000000 };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ configured: true, authenticated: false, csrfToken: 'anonymous' }));
    await refreshHostedAccount('/api', account);
    assert.deepEqual(account.models, []);
    assert.equal(account.wallet, null);
    assert.equal(account.status?.authenticated, false);
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/status')) return new Response(JSON.stringify({ configured: true, authenticated: true, accessGranted: true, csrfToken: 'signed-in' }));
      if (String(url).endsWith('/models')) return new Response(JSON.stringify({ error: 'Catalog unavailable' }), { status: 502 });
      return new Response(JSON.stringify({ availableMicros: 3000000, checkout: { available: false, packIds: [] } }));
    };
    await refreshHostedAccount('/api', account);
    assert.equal(account.modelError, 'Catalog unavailable');
    assert.equal(availableBalance(account.wallet), 3000000);
    assert.equal(account.loading, false);
  } finally { globalThis.fetch = original; }
});

test('a delayed account refresh cannot overwrite a newer signed-out state', async () => {
  const original = globalThis.fetch;
  const account = emptyHostedAccount();
  let resolveEarlier!: (response: Response) => void;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      if (++calls === 1) return new Promise<Response>((resolve) => { resolveEarlier = resolve; });
      return new Response(JSON.stringify({ configured: true, authenticated: false, csrfToken: 'new-session' }));
    };
    const earlier = refreshHostedAccount('/api', account);
    await refreshHostedAccount('/api', account);
    resolveEarlier(new Response(JSON.stringify({ configured: true, authenticated: true, csrfToken: 'old-session', profile: { did: 'did:plc:previous' } })));
    await earlier;
    assert.equal(account.status?.authenticated, false);
    assert.equal(account.status?.csrfToken, 'new-session');
    assert.deepEqual(account.models, []);
    assert.equal(account.wallet, null);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('bodyless persona deletion still sends the account CSRF token', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/personas/my-persona');
      assert.equal(init?.method, 'DELETE');
      assert.equal(init?.body, undefined);
      assert.equal(new Headers(init?.headers).get('X-Baste-CSRF'), 'account-token');
      return new Response(JSON.stringify({ success: true }));
    };
    const client = createClient('/api');
    client.setCsrfToken!('account-token');
    assert.deepEqual(await client.deletePersona('my-persona'), { success: true });
  } finally { globalThis.fetch = original; }
});


test('authenticated accounts without the Baste gate never load models or wallet, including old servers', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [{ configured: true, authenticated: true, accessGranted: false }, { configured: true, authenticated: true }]) {
      const calls: string[] = [];
      globalThis.fetch = async (url) => { calls.push(String(url)); return Response.json(status); };
      const account = emptyHostedAccount();
      account.models = [{ id: 'previous', kind: 'image' }]; account.wallet = { availableMicros: 2000000 };
      await refreshHostedAccount('/api', account);
      assert.deepEqual(calls, ['/api/notorganic/status']); assert.deepEqual(account.models, []); assert.equal(account.wallet, null);
    }
  } finally { globalThis.fetch = original; }
});
