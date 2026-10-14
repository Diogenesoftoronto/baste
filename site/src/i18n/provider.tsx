import { component$, createContextId, Slot, useContext, useContextProvider, useSignal, useVisibleTask$, type Signal } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import { css } from 'styled-system/css';
import { browserLocale, LANGUAGE_COOKIE, localeHref, normalizeLocale, text, type Locale } from './runtime';
const LocaleContext = createContextId<Signal<Locale>>('baste.locale');
export const useLocale = () => useContext(LocaleContext, useSignal<Locale>('en'));
export const LocaleProvider = component$<{ initialLocale: Locale }>(({ initialLocale }) => {
  const locale = useSignal(initialLocale);
  const location = useLocation();
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => location.url.search);
    const sync = () => { locale.value = browserLocale(new URL(window.location.href)); };
    sync();
    window.addEventListener("languagechange", sync);
    cleanup(() => window.removeEventListener("languagechange", sync));
  }, { strategy: "document-ready" });
  useContextProvider(LocaleContext, locale);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const current = track(() => locale.value);
    document.documentElement.lang = current;
    document.body.lang = current;
  });
  return <div lang={locale.value}><Slot /></div>;
});
export const LanguageSelect = component$(() => {
  const locale = useLocale();
  const location = useLocation();
  return <label class={css({ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: '13px' })}>
    <span class={css({ display: { base: 'none', lg: 'inline' } })}>{text(locale.value, 'Language')}</span>
    <select aria-label={text(locale.value, 'Language')} value={locale.value} style={{ maxWidth: '100px' }} onChange$={(_, el) => {
      const choice = normalizeLocale(el.value) ?? 'en';
      try { document.cookie = `${LANGUAGE_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* The URL still carries the choice when cookies are disabled. */ }
      window.location.assign(localeHref(location.url.pathname + location.url.search + location.url.hash, choice));
    }}>
      <option value="en" lang="en">English</option><option value="fr" lang="fr">Français</option>
    </select>
  </label>;
});
