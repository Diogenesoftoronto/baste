import { formatMessage } from 'generaltranslation';
import en from './messages/en.json';
import fr from './messages/fr.json';

export const LOCALES = ['en', 'fr'] as const;
export type Locale = typeof LOCALES[number];
export const LANGUAGE_COOKIE = 'baste.language';
export const catalogs: Record<Locale, Record<string, string>> = { en, fr };
export function normalizeLocale(value: string | null | undefined): Locale | undefined {
  const base = value?.trim().toLowerCase().split('-')[0];
  return LOCALES.includes(base as Locale) ? base as Locale : undefined;
}
export function resolveLocale(query: string | null, cookie: string | undefined, header = ''): Locale {
  const explicit = normalizeLocale(query) ?? normalizeLocale(cookie);
  if (explicit) return explicit;
  const preferences = header.split(',').map((range, index) => {
    const [language, ...params] = range.trim().split(';');
    const weight = params.find(p => p.trim().startsWith('q='));
    return { language, q: weight ? Number(weight.trim().slice(2)) : 1, index };
  }).filter(p => Number.isFinite(p.q) && p.q > 0 && p.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return preferences.map(p => normalizeLocale(p.language)).find(Boolean) ?? 'en';
}
/** Local ICU only. Source fallback never makes a network request. */
export function text(locale: Locale, source: string, variables: Record<string, string | number> = {}): string {
  const translated = catalogs[locale][source];
  return formatMessage(translated ?? source, { locales: translated ? locale : 'en', variables, dataFormat: Object.keys(variables).length ? 'ICU' : 'STRING' });
}
/** Preserve deep links and existing parameters while carrying the language. */
export function localeHref(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const url = new URL(href, 'https://baste.love');
  url.searchParams.set('lang', locale);
  return url.pathname + url.search + url.hash;
}
export const localizedAssets: Record<string, Partial<Record<Locale, string>> & { neutral: string }> = {
  walkthrough: { en: '/media/studio-guide/walkthrough-en.mp4', fr: '/media/studio-guide/walkthrough-fr.mp4', neutral: '/media/studio-guide/walkthrough-en.mp4' },
  'walkthrough-poster': { en: '/media/studio-guide/poster-en.webp', fr: '/media/studio-guide/poster-fr.webp', neutral: '/media/studio-guide/poster-en.webp' },
  'walkthrough-captions': { en: '/media/studio-guide/captions-en.vtt', fr: '/media/studio-guide/captions-fr.vtt', neutral: '/media/studio-guide/captions-en.vtt' },
  'guide-pdf': { en: '/media/studio-guide/guide-en.pdf', fr: '/media/studio-guide/guide-fr.pdf', neutral: '/media/studio-guide/guide-en.pdf' },
  social: { en: '/media/og-en.png', fr: '/media/og-fr.png', neutral: '/favicon.svg' },
};
export function localeAsset(id: string, locale: Locale): string {
  const asset = localizedAssets[id];
  if (!asset) throw new Error(`Unknown localized asset: ${id}`);
  return asset[locale] ?? asset.neutral;
}
// Verified manual screenshots use the same locale resolver as the interface.
for (const screen of ['home', 'fitting', 'tokens', 'generate', 'moodboard', 'brandkit', 'feedback', 'editor', 'new', 'tailor', 'decompose', 'remix', 'settings', 'projects', 'materials', 'specimen']) {
  localizedAssets[`guide-${screen}`] = { en: `/media/studio-guide/en/${screen}.webp`, fr: `/media/studio-guide/fr/${screen}.webp`, neutral: `/media/studio-guide/en/${screen}.webp` };
}
/** Static builds resume from English HTML, then apply the same locale policy. */
export function browserLocale(url: URL): Locale {
  let cookie: string | undefined;
  try { cookie = document.cookie.split(';').map(p => p.trim()).find(p => p.startsWith(`${LANGUAGE_COOKIE}=`))?.slice(LANGUAGE_COOKIE.length + 1); } catch { /* Cookie access may be disabled. */ }
  return resolveLocale(url.searchParams.get('lang'), cookie, navigator.languages.join(','));
}

/** Localize only authored built-in display content; custom personas stay verbatim.
 * IDs, generation input, tokens and cultural proper names are never rewritten.
 */
export function personaText(locale: Locale, persona: { id: string; _source?: string }, source: string): string {
  return persona._source === 'base' && ['cyberbotanist', 'nightmarketcoder', 'liminalweeb'].includes(persona.id)
    ? text(locale, source) : source;
}
