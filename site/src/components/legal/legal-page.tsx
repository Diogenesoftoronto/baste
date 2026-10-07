import { component$ } from '@builder.io/qwik';
import { css } from 'styled-system/css';
import { Nav } from '~/components/layout/nav';
import { Footer } from '~/components/layout/footer';
import { btn } from '~/components/studio/ui';
import { useLocale } from '~/i18n/provider';
import { localeHref } from '~/i18n/runtime';
import policies from './policies.json';

const paragraph = css({ mt: 4, lineHeight: 1.8, fontSize: '16px', color: 'ink-soft', overflowWrap: 'anywhere' });
const link = css({ color: 'chalk', textUnderlineOffset: '4px', _hover: { color: 'ink' }, _focusVisible: { outline: '2px solid token(colors.chalk)', outlineOffset: '4px' } });
const copy = {
  en: { label: 'The atelier / Legal', status: 'Review draft — not effective', date: 'Prepared 2 October · release review 7 October 2026', note: 'For owner review. Not effective. This page does not collect acceptance or change an account.', contents: 'On this page', language: 'Choose your reading language', description: { terms: 'The browser demo, your work and the boundaries of the service.', privacy: 'What stays in your browser, what leaves it and the choices you have.' }, other: { terms: 'Read the privacy policy', privacy: 'Read the terms of service' }, back: 'Back to this text' },
  fr: { label: 'L’atelier / Textes juridiques', status: 'Projet pour examen — non en vigueur', date: 'Préparé le 2 octobre · publication examinée le 7 octobre 2026', note: 'Pour examen par le propriétaire. Non en vigueur. Cette page ne recueille aucune acceptation et ne modifie aucun compte.', contents: 'Sur cette page', language: 'Choisir la langue de lecture', description: { terms: 'La démonstration, votre travail et les limites du service.', privacy: 'Ce qui reste dans votre navigateur, ce qui en sort et vos choix.' }, other: { terms: 'Lire la politique de confidentialité', privacy: 'Lire les conditions d’utilisation' }, back: 'Retour au début du texte' },
};

/** Both complete texts remain readable in static HTML without JavaScript. */
export const LegalPage = component$<{ kind: 'terms' | 'privacy' }>(({ kind }) => {
  const locale = useLocale();
  const lang = locale.value;
  const texts = policies[kind];
  const words = copy[lang];
  return <>
    <Nav />
    <main id="main" class={css({ maxW: '1240px', mx: 'auto', px: { base: 4, md: 8 }, pt: { base: 8, md: 14 }, pb: 12, minW: 0 })}>
      <header class={css({ pb: { base: 9, md: 12 } })}>
        <div class={css({ display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap', alignItems: 'center' })}>
          <p class="label" style={{ color: 'var(--colors-thread-ink)' }}>{words.label}</p>
          <span class={css({ bg: 'tape', color: 'ink', px: 3, py: 2, fontFamily: 'mono', fontSize: '11px', letterSpacing: '0.04em', borderRadius: 'xs' })}>{words.status}</span>
        </div>
        <h1 class="display" style={{ fontSize: 'clamp(40px, 6.5vw, 82px)', lineHeight: 1.04, marginTop: '24px', maxWidth: '950px' }}>{texts[lang].title}</h1>
        <p class={css({ maxW: '680px', mt: 6, fontSize: { base: '18px', md: '22px' }, lineHeight: 1.55, color: 'ink-soft' })}>{words.description[kind]}</p>
        <div class={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', mt: 8 })}>
          <nav aria-label={words.language} class={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
            <a href={localeHref(`/${kind}/`, 'en') + '#legal-en'} lang="en" aria-current={lang === 'en' ? 'true' : undefined} class={btn(lang === 'en' ? 'primary' : 'secondary', css({ minH: '44px', h: 'auto', py: 3 }))}>English</a>
            <a href={localeHref(`/${kind}/`, 'fr') + '#legal-fr'} lang="fr" aria-current={lang === 'fr' ? 'true' : undefined} class={btn(lang === 'fr' ? 'primary' : 'secondary', css({ minH: '44px', h: 'auto', py: 3 }))}>Français</a>
          </nav>
          <a href={localeHref(kind === 'terms' ? '/privacy/' : '/terms/', lang)} class={link}>{words.other[kind]} <span aria-hidden="true">→</span></a>
        </div>
        <div role="note" class={css({ borderLeft: '3px solid token(colors.thread-ink)', bg: 'paper-deep', px: 5, py: 4, mt: 8, maxW: '900px' })}>
          <p class={css({ fontFamily: 'mono', fontSize: '11px', color: 'ink-soft', mb: 2 })}>{words.date}</p>
          <p lang={lang} class={css({ fontSize: '14px', lineHeight: 1.6, color: 'ink' })}>{words.note}</p>
        </div>
      </header>
      {([lang, lang === 'en' ? 'fr' : 'en'] as const).map((language) => <article key={language} id={`legal-${language}`} lang={language} aria-labelledby={`legal-title-${language}`} class={css({ borderTop: '1px dashed token(colors.rule-strong)', pt: 9, pb: 8, scrollMarginTop: '85px', minW: 0 })}>
        <div class={css({ display: 'grid', gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: '230px minmax(0, 1fr)' }, gap: { base: 7, lg: 10 }, alignItems: 'start', minW: 0 })}>
          <aside class={css({ position: { lg: 'sticky' }, top: '88px', minW: 0 })}>
            <nav aria-label={`${copy[language].contents} / ${language.toUpperCase()}`} class={css({ bg: 'paper-deep', p: 5, borderRadius: 'base' })}>
              <p class="label" style={{ color: 'var(--colors-ink-soft)', marginBottom: '12px' }}>{copy[language].contents} · {language.toUpperCase()}</p>
              <ol class={css({ listStyle: 'none', display: 'grid', gap: 1 })}>{texts[language].sections.map((section, index) => <li key={section.id}>
                <a href={`#${kind}-${language}-${section.id}`} class={css({ display: 'flex', gap: 3, py: 2, minH: '44px', fontSize: '14px', lineHeight: 1.45, color: 'ink-soft', textDecoration: 'none', _hover: { color: 'chalk' }, _focusVisible: { outline: '2px solid token(colors.chalk)', outlineOffset: '2px' } })}>
                  <span aria-hidden="true" class={css({ fontFamily: 'mono', color: 'thread-ink', fontSize: '11px', pt: '2px' })}>{String(index + 1).padStart(2, '0')}</span><span>{section.title}</span>
                </a>
              </li>)}</ol>
            </nav>
          </aside>
          <div class={css({ bg: 'card', p: { base: 5, md: 8 }, border: '1px solid token(colors.rule)', borderRadius: 'lg', boxShadow: 'sheet', minW: 0 })}>
            <p class="label" style={{ color: 'var(--colors-thread-ink)' }}>{language === 'fr' ? 'Texte intégral · Français' : 'Full text · English'}</p>
            <h2 id={`legal-title-${language}`} class="display" style={{ fontSize: 'clamp(30px, 4vw, 42px)', lineHeight: 1.15, marginTop: '16px' }}>{texts[language].title}</h2>
            <p class={paragraph}>{texts[language].intro}</p>
            {texts[language].sections.map((section, index) => <section key={section.id} id={`${kind}-${language}-${section.id}`} class={css({ pt: 8, pb: 7, borderBottom: '1px solid token(colors.rule)', scrollMarginTop: '90px' })}>
              <p class="label" style={{ color: 'var(--colors-ink-muted)', marginBottom: '12px' }}>{String(index + 1).padStart(2, '0')}</p>
              <h3 class="display" style={{ fontSize: 'clamp(26px, 3vw, 32px)', lineHeight: 1.2 }}>{section.title}</h3>
              {section.paragraphs.map((p, i) => <p key={i} class={paragraph}>{p}</p>)}
            </section>)}
            <a href={`#legal-${language}`} class={css({ display: 'inline-block', mt: 6, color: 'chalk', minH: '44px', textUnderlineOffset: '4px', _focusVisible: { outline: '2px solid token(colors.chalk)', outlineOffset: '4px' } })}>{copy[language].back} <span aria-hidden="true">↑</span></a>
          </div>
        </div>
      </article>)}
    </main><Footer />
  </>;
});
