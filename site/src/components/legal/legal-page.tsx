import { component$ } from '@builder.io/qwik';
import { css } from 'styled-system/css';
import { Nav } from '~/components/layout/nav';
import { Footer } from '~/components/layout/footer';
import policies from './policies.json';

const paragraph = css({ mt: 4, lineHeight: 1.75, fontSize: '16px', color: 'ink-soft', overflowWrap: 'anywhere' });

/** Both complete texts remain readable in static HTML without JavaScript. */
export const LegalPage = component$<{ kind: 'terms' | 'privacy' }>(({ kind }) => {
  const texts = policies[kind];
  return <>
    <Nav />
    <main id="main" class={css({ maxW: '900px', mx: 'auto', px: { base: 4, md: 8 }, py: 10, minW: 0 })}>
      <header>
        <p class="label">Baste · Legal review / Révision juridique · 2026-10-02</p>
        <h1 class="display" style={{ fontSize: 'clamp(36px, 6vw, 60px)', lineHeight: 1.15, marginTop: '16px' }}>{kind === 'terms' ? 'Terms of Service / Conditions d’utilisation' : 'Privacy Policy / Politique de confidentialité'}</h1>
        <div role="note" class={css({ bg: 'paper-deep', border: '1px solid token(colors.rule)', p: 5, mt: 6 })}>
          <p lang="en">Unpublished draft for owner review. Not effective. No acceptance or account change is made by this page.</p>
          <p lang="fr" class={css({ mt: 3 })}>Projet non publié pour examen par le propriétaire. Non en vigueur. Cette page ne recueille aucune acceptation et ne modifie aucun compte.</p>
        </div>
        <nav aria-label="Legal language / Langue du texte juridique" class={css({ display: 'flex', flexWrap: 'wrap', gap: 5, mt: 6 })}>
          <a href="#legal-fr" lang="fr">Lire en français</a><a href="#legal-en" lang="en">Read in English</a>
          <a href={kind === 'terms' ? '/privacy/#legal-fr' : '/terms/#legal-fr'} lang="fr">{kind === 'terms' ? 'Confidentialité' : 'Conditions d’utilisation'}</a>
          <a href={kind === 'terms' ? '/privacy/#legal-en' : '/terms/#legal-en'} lang="en">{kind === 'terms' ? 'Privacy' : 'Terms'}</a>
        </nav>
      </header>
      {(['fr', 'en'] as const).map((lang) => <article key={lang} id={`legal-${lang}`} lang={lang} aria-labelledby={`legal-title-${lang}`} class={css({ pt: 10, scrollMarginTop: '90px' })}>
        <h2 id={`legal-title-${lang}`} class="display" style={{ fontSize: '36px', lineHeight: 1.2 }}>{texts[lang].title}</h2>
        <p class={paragraph}>{texts[lang].intro}</p>
        <nav aria-label={lang === 'fr' ? 'Sommaire' : 'Contents'} class={css({ mt: 5 })}>
          <ol class={css({ pl: 5, lineHeight: 1.9 })}>{texts[lang].sections.map((section) => <li key={section.id}><a href={`#${kind}-${lang}-${section.id}`}>{section.title}</a></li>)}</ol>
        </nav>
        {texts[lang].sections.map((section) => <section key={section.id} id={`${kind}-${lang}-${section.id}`} class={css({ py: 7, borderBottom: '1px solid token(colors.rule)', scrollMarginTop: '90px' })}>
          <h3 style={{ fontSize: '24px', lineHeight: 1.3 }}>{section.title}</h3>
          {section.paragraphs.map((p, index) => <p key={index} class={paragraph}>{p}</p>)}
        </section>)}
        <a href={lang === 'fr' ? '#legal-fr' : '#legal-en'} class={css({ display: 'inline-block', mt: 5 })}>{lang === 'fr' ? 'Retour au début du texte' : 'Back to this text'}</a>
      </article>)}
    </main><Footer />
  </>;
});
