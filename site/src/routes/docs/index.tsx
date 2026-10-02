import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { css } from 'styled-system/css';
import { Nav, GITHUB_URL } from '~/components/layout/nav';
import { Footer } from '~/components/layout/footer';
import { CodeView } from '~/components/ui/code-view';
import { btn } from '~/components/studio/ui';
import { useLocale } from '~/i18n/provider';
import { localeAsset, localeHref, text } from '~/i18n/runtime';
import chapters from '~/components/docs/guide.json';
import transcript from '~/components/docs/walkthrough.json';
import { COMMANDS, API, REFERENCE_NOTES } from '~/components/docs/reference';

const section = css({ py: 10, borderBottom: '1px solid token(colors.rule)', scrollMarginTop: '90px', minW: 0 });
const paragraph = css({ maxW: '75ch', color: 'ink-soft', lineHeight: 1.75, fontSize: '16px', mt: 4 });
const tables = css({ w: '100%', borderCollapse: 'collapse', fontSize: '13px', '& td, & th': { textAlign: 'left', p: 3, borderBottom: '1px solid token(colors.rule)', verticalAlign: 'top' }, '& td:first-child': { fontFamily: 'mono' } });
const anchorAliases: Record<string, string[]> = { orientation: ['start'], operators: ['notorganic'], development: ['providers'], persistence: ['outputs'] };
const partial = new Set(['generate', 'settings', 'projects', 'materials', 'specimen']);
export default component$(() => {
  const locale = useLocale();
  return <>
    <Nav />
    <main id="main" class={css({ maxW: '1280px', mx: 'auto', px: { base: 4, md: 8 }, py: 10 })}>
      <header class={css({ maxW: '850px', pb: 10 })}>
        <p class="label">{text(locale.value, 'Public browser demo · EN / FR · verified with synthetic content')}</p>
        <h1 class="display" style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 1.07, marginTop: '16px' }}>{text(locale.value, 'The complete Studio guide.')}</h1>
        <p class={paragraph}>{text(locale.value, 'A practical guide to every tab, flow, export and connection boundary in the current Baste Studio.')}</p>
        <a class={btn('primary', css({ mt: 5 }))} href={localeHref('/gui/', locale.value)}>{text(locale.value, 'Open Studio')} →</a>
      </header>
      <section class={css({ pb: 10 })} aria-labelledby="walkthrough-title">
        <h2 id="walkthrough-title" class="display" style={{ fontSize: '36px' }}>{text(locale.value, 'A short Studio walkthrough.')}</h2>
        <p class={paragraph}>{text(locale.value, 'Narrated walkthrough · {duration}. Aria guides you through personas, measurements, tokens, feedback, OpenPencil and saving your work.', { duration: locale.value === 'fr' ? '1 min 56 s' : '1 min 53 s' })}</p>
        <video key={locale.value} controls preload="none" playsInline poster={localeAsset('walkthrough-poster', locale.value)} aria-label={text(locale.value, 'Studio walkthrough')} class={css({ w: '100%', maxW: '1100px', mt: 5, rounded: 'lg', border: '1px solid token(colors.rule)' })}>
          <source src={localeAsset('walkthrough', locale.value)} type="video/mp4" />
          <track kind="captions" src={localeAsset('walkthrough-captions', locale.value)} srclang={locale.value} label={locale.value === 'fr' ? 'Français' : 'English'} default />
          {text(locale.value, 'Your browser cannot play this video. Use the video download below.')}
        </video>
        <p class={paragraph}>{text(locale.value, 'Read the full instructions below. The downloads are optional copies for offline use.')}</p>
        <div class={css({ display: 'flex', flexWrap: 'wrap', gap: 4, mt: 4 })}>
          <a class={btn('secondary')} href={localeAsset('walkthrough', locale.value)} download>{text(locale.value, 'Download narrated video')}</a>
          <a class={btn('secondary')} href={localeAsset('walkthrough-captions', locale.value)} download>{text(locale.value, 'Download spoken captions')}</a>
          <a class={btn('secondary')} href={localeAsset('guide-pdf', locale.value)} download>{text(locale.value, 'Download the illustrated guide (PDF)')}</a>
        </div>
        <details class={css({ mt: 6, maxW: '850px' })}>
          <summary class={css({ cursor: 'pointer', fontSize: '16px', color: 'thread-ink' })}>{text(locale.value, 'Read the video transcript')}</summary>
          {transcript.map(part => <section key={part.id} class={css({ mt: 5 })}>
            <h3 class={css({ fontSize: '20px' })}>{text(locale.value, part.title)}</h3>
            <p class={paragraph}>{text(locale.value, part.paragraph)}</p>
          </section>)}
        </details>
      </section>
      <div class={css({ display: 'grid', gridTemplateColumns: { base: 'minmax(0, 1fr)', lg: '240px minmax(0, 1fr)' }, gap: { base: 6, lg: 10 }, alignItems: 'start' })}>
        <nav aria-label={text(locale.value, 'Guide chapters')} class={css({ position: { lg: 'sticky' }, top: '90px', maxH: { lg: 'calc(100vh - 110px)' }, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, fontSize: '13px', pr: 3 })}>
          {chapters.map((chapter, i) => <a key={chapter.id} href={`#${chapter.id}`} class={css({ color: 'ink-soft', textDecoration: 'none', py: 1, _hover: { color: 'thread-ink', textDecoration: 'underline' } })}>{String(i + 1).padStart(2, '0')} · {text(locale.value, chapter.title)}</a>)}
          <a href="#reference">{text(locale.value, 'CLI and API reference')}</a>
        </nav>
        <div class={css({ minW: 0 })}>
          {chapters.map((chapter, i) => <section key={chapter.id} id={chapter.id} class={section}>
            {(anchorAliases[chapter.id] ?? []).map(id => <span key={id} id={id} aria-hidden="true" />)}
            <p class="label">{String(i + 1).padStart(2, '0')} / {chapters.length}</p>
            <h2 class="display" style={{ fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.15, marginTop: '12px' }}>{text(locale.value, chapter.title)}</h2>
            {chapter.paragraphs.map((p, n) => <p key={n} class={paragraph}>{text(locale.value, p)}</p>)}
            {'code' in chapter && chapter.code && <div class={css({ mt: 5 })}><CodeView code={chapter.code} label={text(locale.value, chapter.title)} /></div>}
            {chapter.href && <p class={css({ mt: 4 })}><a class={btn('secondary')} href={localeHref(chapter.href, locale.value)}>{text(locale.value, 'Open this view')} →</a></p>}
            {chapter.screen && chapter.screen !== 'docs' && <figure class={css({ mt: 6, mx: 0 })}>
              <a href={localeAsset(`guide-${chapter.screen}`, locale.value)} target="_blank" rel="noopener"><img src={localeAsset(`guide-${chapter.screen}`, locale.value)} width={1440} height={1000} loading="lazy" alt={text(locale.value, 'Actual demo screen · {title}', { title: text(locale.value, chapter.title) })} class={css({ w: '100%', h: 'auto', border: '1px solid token(colors.rule)', rounded: 'lg' })} /></a>
              <figcaption class={css({ color: 'ink-muted', fontSize: '12px', mt: 2 })}>{text(locale.value, 'Actual demo screen · {title}', { title: text(locale.value, chapter.title) })}{locale.value === 'fr' && partial.has(chapter.screen) && <> · {text(locale.value, 'English copy remains in this screen; see localization coverage.')}</>}</figcaption>
            </figure>}
          </section>)}
          <section id="reference" class={section}>
            <h2 class="display" style={{ fontSize: '36px' }}>{text(locale.value, 'CLI and API reference')}</h2>
            <p class={paragraph}>{text(locale.value, 'These routes and commands are preserved from the existing manual. Use baste --help and the repository README for the complete package interface.')}</p>
            {[COMMANDS, API].map((rows, i) => <div key={i} id={i === 0 ? 'cli' : 'api'} class={css({ overflowX: 'auto', mt: 5 })} tabIndex={0} role="region" aria-label={i === 0 ? 'CLI' : 'API'}>{REFERENCE_NOTES[i].map(note => <p key={note} class={paragraph}>{text(locale.value, note)}</p>)}<table class={tables}><thead><tr><th>{text(locale.value, i === 0 ? 'Command' : 'Route')}</th><th>{text(locale.value, 'Purpose')}</th></tr></thead><tbody>{rows.map(([command, description]) => <tr key={command}><td>{command}</td><td>{text(locale.value, description)}</td></tr>)}</tbody></table></div>)}
            <p class={paragraph}><a href={`${GITHUB_URL}/tree/main#readme`}>{text(locale.value, 'Repository development guide')}</a></p>
          </section>
        </div>
      </div>
    </main>
    <Footer />
  </>;
});
export const head: DocumentHead = { title: 'Studio guide · Baste', meta: [{ name: 'description', content: 'A complete guide to the Baste Studio: personas, fitting, tokens, generation, moodboards, feedback, OpenPencil and saved projects.' }] };
