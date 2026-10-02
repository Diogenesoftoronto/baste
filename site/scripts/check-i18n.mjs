import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import ts from 'typescript';
import { parse } from '@generaltranslation/icu';
const root = new URL('../src/', import.meta.url);
const load = async locale => JSON.parse(await readFile(new URL(`i18n/messages/${locale}.json`, root), 'utf8'));
const en = await load('en'), fr = await load('fr');
assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), 'EN/FR catalog keys differ');
const variables = ast => {
  const found = new Set();
  function walk(nodes) { for (const node of nodes) {
    if ([1,2,3,4,5,6].includes(node.type)) found.add(node.value);
    if (node.children) walk(node.children);
    for (const option of Object.values(node.options ?? {})) walk(option.value);
  } }
  walk(ast); return [...found].sort();
};
for (const [source, value] of Object.entries(fr)) {
  assert.ok(typeof value === 'string' && value.trim(), `Empty French message: ${source}`);
  // Static text uses GT STRING; templates/plurals use ICU. Paths are never templates.
  if (/\{\w+(?:\}|,)/.test(source) && !source.includes('{svg,images,videos}')) {
    assert.deepEqual(variables(parse(value)), variables(parse(en[source])), `ICU arguments differ: ${source}`);
  }
}
for (const locale of ['en', 'fr']) await access(new URL(`../public/media/og-${locale}.png`, root));
const scoped = [
  ...['nav','footer'].map(n=>`components/layout/${n}.tsx`),
  ...['hero','measure','method','wardrobe','deliverables','install','closing'].map(n=>`components/sections/${n}.tsx`),
  'components/ui/copy-command.tsx', 'components/studio/topbar.tsx', 'components/studio/rail.tsx', 'components/studio/workspace.tsx',
  'components/fitting/fitting-room.tsx', 'components/fitting/garment.tsx', 'components/fitting/measurement-sheet.tsx',
  'components/fitting/persona-card.tsx','components/fitting/qd-archive.tsx','components/studio/tabs/fitting.tsx',
  ...['tokens','moodboard','brandkit','feedback','editor'].map(n => `components/studio/tabs/${n}.tsx`),
  ...['persona-form','remix','decompose','server-only'].map(n => `components/studio/flows/${n}.tsx`),
  'components/studio/hold-button.tsx', 'routes/docs/index.tsx'
];
const invariant = new Set(['GitHub','README','v0.2.0 · MIT','.app / collections','$ baste tokens','--format','Aa','Tailwind','Panda','JSON','OpenPencil','×','OpenPencil · v','personas/','.json','URL','baste gui']);
const gaps = [];
for (const file of scoped) {
  const source = await readFile(new URL(file, root), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = node => {
    if (ts.isJsxText(node)) {
      const value = node.getText(ast).replace(/\s+/g,' ').trim();
      if (/[A-Za-z]/.test(value) && !invariant.has(value)) gaps.push(`${file}: ${value}`);
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'text' && node.arguments[1] && ts.isStringLiteral(node.arguments[1])) {
      assert.ok(en[node.arguments[1].text], `Unregistered message in ${file}: ${node.arguments[1].text}`);
    }
    ts.forEachChild(node, visit);
  }; visit(ast);
}
assert.deepEqual(gaps, [], 'Untranslated literal JSX in migrated surfaces');
const chapters = JSON.parse(await readFile(new URL('components/docs/guide.json', root), 'utf8'));
assert.equal(chapters.length, 25, 'Guide topology changed');
for (const chapter of chapters) {
  for (const message of [chapter.title, ...chapter.paragraphs]) assert.ok(en[message] && fr[message], `Unregistered guide message: ${message}`);
  if (chapter.screen && chapter.screen !== 'docs') for (const locale of ['en','fr']) await access(new URL(`../public/media/studio-guide/${locale}/${chapter.screen}.webp`, root));
}
for (const locale of ['en','fr']) for (const file of [`walkthrough-${locale}.mp4`, `poster-${locale}.webp`, `captions-${locale}.vtt`, `guide-${locale}.pdf`]) await access(new URL(`../public/media/studio-guide/${file}`, root));
const transcript = JSON.parse(await readFile(new URL('components/docs/walkthrough.json', root), 'utf8'));
assert.equal(transcript.length, 6, 'Narrated transcript chapters changed');
for (const part of transcript) for (const message of [part.title, part.paragraph]) assert.ok(en[message] && fr[message], `Unregistered spoken transcript: ${message}`);
for (const locale of ['en','fr']) {
  const captions = await readFile(new URL(`../public/media/studio-guide/captions-${locale}.vtt`, root), 'utf8');
  assert.ok(captions.startsWith('WEBVTT'), 'Captions must be WebVTT');
  assert.equal((captions.match(/ --> /g) ?? []).length, 27, 'Spoken caption cues changed');
}
const reference = await readFile(new URL('components/docs/reference.ts', root), 'utf8');
const notes = JSON.parse(reference.split('export const REFERENCE_NOTES = ')[1].split(' as const;')[0]);
for (const note of notes.flat()) assert.ok(en[note] && fr[note], `Unregistered reference note: ${note}`);
const form = await readFile(new URL('components/studio/flows/persona-form.tsx', root), 'utf8');
assert.match(form, /JSON\.parse\(JSON\.stringify\(persona\)\)/, 'Reactive form must cross the JSON wire boundary as a plain payload');
assert.ok(!/value=\{text\(locale\.value,\s*[vo]\)\}/.test(form), 'Translated display choices must retain raw form values');
console.log(`${Object.keys(en).length} EN/FR messages, ICU argument parity, 2 raster assets and ${scoped.length} migrated surfaces passed. 25 guide chapters and bilingual screenshot assets passed. Auth, projects, payment, generation and Materials remain outside the migrated UI scope.`);
