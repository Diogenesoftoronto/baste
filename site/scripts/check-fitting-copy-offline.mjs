/** Dependency-free source/catalog regression checks. Does not replace a Qwik build or browser QA. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const root = new URL('../src/', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const en = JSON.parse(await read('i18n/messages/en.json'));
const fr = JSON.parse(await read('i18n/messages/fr.json'));
assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
for (const [key, value] of Object.entries(fr)) {
  assert.equal(typeof value, 'string'); assert.ok(value.trim(), key);
  const vars = s => [...s.matchAll(/\{([A-Za-z][\w]*)(?:\}|,)/g)].map(x => x[1]).sort();
  if (!key.includes('{svg,images,videos}')) assert.deepEqual(vars(value), vars(en[key]), key);
}
const visible = {
  'The Cyberbotanist': 'Le cyberbotaniste', 'Cyberbotanist': 'Cyberbotaniste',
  'Night Market Coder': 'Programmeur des marchés de nuit', 'Liminal Weeb': 'Otaku des espaces liminaires',
  'Pacific Northwest': 'Nord-Ouest du Pacifique', 'mycelial network topology': 'topologie des réseaux mycéliens',
  'greenhouses': 'serres', 'herbariums': 'herbiers', 'maker spaces with plants': 'ateliers de fabrication végétalisés',
  'ambient': 'musique d’ambiance', 'bioluminescent': 'bioluminescent', 'mycelial': 'mycélien',
  'organic': 'organique', 'rich': 'riche', 'smooth': 'fluide',
};
for (const [source, value] of Object.entries(visible)) assert.equal(fr[source], value, source);
const demoSource = await read('lib/demo-data.ts');
const start = demoSource.indexOf('= [') + 2;
const end = demoSource.indexOf('\n];', start) + 2;
const personas = JSON.parse(demoSource.slice(start, end));
const properNames = new Set(['Mushishi','Ernst Haeckel','Chungking Express','city pop','Serial Experiments Lain','vaporwave','Yume Nikki']);
for (const p of personas) {
  assert.equal(p._source, 'base');
  for (const source of [p.name, p.name.replace(/^The /, ''), p.summary, p.culture.region, p.influences.obsessions[0], ...p.influences.spaces.slice(0,3), ...p.aesthetic.visualKeywords.slice(0,4)]) {
    assert.ok(fr[source] || properNames.has(source), `Missing fitting translation: ${p.id}: ${source}`);
  }
}
// Execute the real, isolated dispatch function with a recording formatter.
// GT ICU formatting and Qwik rendering still require the actual dependencies.
const runtime = await read('i18n/runtime.ts');
const helperSource = runtime.slice(runtime.indexOf('export function personaText('));
const calls = [];
const format = (locale, source) => { calls.push([locale, source]); return (locale === 'fr' ? fr : en)[source] ?? source; };
const personaText = new Function('text', stripTypeScriptTypes(helperSource).replace('export ', '') + '\nreturn personaText;')(format);
for (const p of personas) {
  assert.equal(personaText('fr', p, p.name), fr[p.name]);
  assert.equal(personaText('en', p, p.summary), p.summary);
  assert.equal(personaText('fr', p, 'Biosphere'), 'Biosphere');
}
const count = calls.length;
for (const p of [{id:'cyberbotanist',_source:'custom'}, {id:'private',_source:'base'}, {id:'cyberbotanist'}]) {
  assert.equal(personaText('fr', p, 'The Cyberbotanist'), 'The Cyberbotanist');
}
assert.equal(calls.length, count, 'Custom/unknown content must not reach translation');
const wiring = {
  'components/fitting/garment.tsx': ['personaText(locale.value, persona, inf?.obsessions?.[0] ?? persona.name)', 'personaText(locale.value, persona, persona.summary)', 'personaText(locale.value, persona, s)', 'personaText(locale.value, persona, genre)', 'personaText(locale.value, persona, k)'],
  'components/fitting/fitting-room.tsx': ['text(locale.value, a.edgeStyle)', 'text(locale.value, a.density)', 'text(locale.value, a.motionStyle)', 'personaText(locale.value, p, p.name.replace', 'text(locale.value, "Measurements for {name}"', 'text(locale.value, "{name} cloth"'],
  'components/studio/workspace.tsx': ['personaText(locale.value, persona, persona.name)', 'personaText(locale.value, persona, persona.summary)', 'text(locale.value, "Unpicked {name}'],
  'components/studio/tabs/fitting.tsx': ['name: personaText(locale.value, persona, persona.name.replace', 'text(locale.value, grade)'],
  'components/fitting/persona-card.tsx': ['text(locale.value, "{name} — open in Studio"', 'personaText(locale.value, persona, persona.summary)'],
  'components/studio/rail.tsx': ['personaText(locale.value, p, p.name.replace'],
};
for (const [path, fragments] of Object.entries(wiring)) {
  const source = await read(path);
  for (const fragment of fragments) assert.ok(source.includes(fragment), `Unwired display: ${path}: ${fragment}`);
}
console.log(`${Object.keys(en).length} EN/FR keys, nonempty values, placeholder-name parity, 3 built-in preview inventories, 6 component wiring checks, isolated display-dispatch/custom-content guards passed. No GT/Qwik/browser execution claimed.`);
