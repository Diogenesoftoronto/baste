import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogs, localeAsset, localeHref, normalizeLocale, resolveLocale, text, personaText } from './runtime';

test('regional French/English and explicit choices outrank cookie/browser', () => {
  assert.equal(normalizeLocale('fr-CA'), 'fr');
  assert.equal(normalizeLocale('EN-us'), 'en');
  assert.equal(normalizeLocale('es'), undefined);
  assert.equal(resolveLocale('en', 'fr', 'fr-CA'), 'en');
  assert.equal(resolveLocale(null, 'fr', 'en-US'), 'fr');
  assert.equal(resolveLocale('invalid', 'invalid', 'es,fr-CA;q=0.9,en;q=0.2'), 'fr');
});
test('quality weights, exclusions, malformed ranges and fallback', () => {
  assert.equal(resolveLocale(null, undefined, 'fr;q=0,en;q=0.7'), 'en');
  assert.equal(resolveLocale(null, undefined, 'fr;q=bad,en'), 'en');
  assert.equal(resolveLocale(null, undefined, 'en;q=0.2,fr;q=1'), 'fr');
  assert.equal(resolveLocale(null, undefined, 'es,ja'), 'en');
});
test('French UI, ICU variables and literal private content', () => {
  assert.equal(text('fr', 'Open Studio'), 'Ouvrir le Studio');
  assert.equal(text('en', 'Open Studio'), 'Open Studio');
  assert.equal(text('fr', 'Copy command: {command}', { command: 'baste generate demo --dry-run' }), 'Copier la commande : baste generate demo --dry-run');
  assert.equal(text('fr', 'private {draft}'), 'private {draft}');
  assert.equal(text('fr', '{count, plural, one {# persona} other {# personas}}', { count: 2 }), '2 personas');
});
test('deep-link locale propagation preserves project, view and anchor', () => {
  assert.equal(localeHref('/gui?project=synthetic&flow=projects#main', 'fr'), '/gui?project=synthetic&flow=projects&lang=fr#main');
  assert.equal(localeHref('/?lang=en#method', 'fr'), '/?lang=fr#method');
  assert.equal(localeHref('https://example.test/', 'fr'), 'https://example.test/');
  assert.equal(localeHref('//example.test/', 'fr'), '//example.test/');
  assert.equal(localeHref('#main', 'fr'), '#main');
});
test('bundled catalog parity, nonempty values, no English substitutes', () => {
  assert.deepEqual(Object.keys(catalogs.fr).sort(), Object.keys(catalogs.en).sort());
  const approvedSame = new Set(['minimal','Texture','Abstraction','Documentation','Studio','Influences','Habitat','Personas','Notes','Collections','Palette','Films','Anime','dense','neutre','niches ·','bioluminescent','impermanence','texture','Collection','accent','surface']);
  for (const [key, value] of Object.entries(catalogs.fr)) {
    assert.ok(value.trim(), key);
    if (value === catalogs.en[key]) assert.ok(approvedSame.has(key) || key.includes('plural'), `Unreviewed unchanged French message: ${key}`);
  }
});
test('locale assets point to actual variants and reject unknown entries', () => {
  assert.equal(localeAsset('social', 'fr'), '/media/og-fr.png');
  assert.equal(localeAsset('social', 'en'), '/media/og-en.png');
  assert.throws(() => localeAsset('missing', 'fr'));
});

test('built-in fitting display localizes without modifying authored personas or identifiers', () => {
  const base = { id: 'cyberbotanist', _source: 'base' };
  assert.equal(personaText('fr', base, 'The Cyberbotanist'), 'Le cyberbotaniste');
  assert.equal(personaText('fr', base, 'mycelial network topology'), 'topologie des réseaux mycéliens');
  assert.equal(personaText('en', base, 'The Cyberbotanist'), 'The Cyberbotanist');
  assert.equal(personaText('fr', base, 'Biosphere'), 'Biosphere');
  assert.equal(personaText('fr', { ...base, _source: 'custom' }, 'The Cyberbotanist'), 'The Cyberbotanist');
  assert.equal(personaText('fr', { id: 'private' }, 'Pacific Northwest'), 'Pacific Northwest');
  assert.equal(base.id, 'cyberbotanist');
});
