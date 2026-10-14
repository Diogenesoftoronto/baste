import { useLocale } from "~/i18n/provider";
import { localeHref } from "~/i18n/runtime";
import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { type DocumentHead } from '@builder.io/qwik-city';
import { Nav } from '~/components/layout/nav';
import { Footer } from '~/components/layout/footer';
import { DocsNavigation } from '~/components/docs/navigation';
import chaptersEn from '~/components/docs/guide.json';
import chaptersFr from '~/components/docs/guide.fr.json';
import transcriptEn from '~/components/docs/walkthrough.json';
import transcriptFr from '~/components/docs/walkthrough.fr.json';
import currentRecording from '~/components/docs/current-recording.json';
import { ChapterClip } from '~/components/docs/chapter-clip';
import tour from '~/lib/tour.json';

const MEDIA = '/media/studio-guide';
const CURRENT_SCREENS: Record<string, string> = { orientation: 'fitting', fitting: 'fitting', material: 'material', tokens: 'tokens', moodboard: 'moodboard', feedback: 'feedback' };
const LEGACY_DEVELOPER_ANCHORS: Record<string, string> = { development: 'development', providers: 'providers', operators: 'notorganic', notorganic: 'notorganic', cli: 'cli', api: 'api', reference: 'cli' };
const CURRENT_STEPS = currentRecording.steps;
const CURRENT_DURATION = Math.round(currentRecording.duration);
const CURRENT_TIME = `${Math.floor(CURRENT_DURATION / 60)}:${String(CURRENT_DURATION % 60).padStart(2, '0')}`;
const TOUR_DURATION = Math.round(tour.duration);
const TOUR_TIME = `${Math.floor(TOUR_DURATION / 60)}:${String(TOUR_DURATION % 60).padStart(2, '0')}`;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
// Silent excerpts of the tour's takes (videos/baste-tour/publish.mjs), shown in place of a still.
const CLIPS: Record<string, { file: string; home?: boolean }> = {
  conversation: { file: 'conversation', home: true }, 'new-persona': { file: 'new-persona' }, tokens: { file: 'tokens' }, generate: { file: 'generate' },
};

export default component$(() => {
  const language = useLocale();
  const recording = useSignal<'tour' | 'current' | 'en' | 'fr'>('tour');

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const followHash = () => {
      const hash = window.location.hash.slice(1);
      if (LEGACY_DEVELOPER_ANCHORS[hash]) {
        window.location.replace(localeHref(`/docs/developers/#${LEGACY_DEVELOPER_ANCHORS[hash]}`, language.value));
        return;
      }
      const target = document.getElementById(hash === 'start' ? 'orientation' : hash === 'outputs' ? 'persistence' : hash);
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
      }
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    cleanup(() => window.removeEventListener('hashchange', followHash));
  }, { strategy: 'document-ready' });

  const fr = language.value === 'fr';
  const t = (en: string, french: string) => fr ? french : en;
  const chapters = fr ? chaptersFr : chaptersEn;
  const isTour = recording.value === 'tour';
  const current = recording.value === 'current';
  const videoLang = isTour || current ? language.value : recording.value;
  const video = isTour ? tour.src : current ? `${MEDIA}/current/${currentRecording.file}` : `${MEDIA}/walkthrough-${videoLang}.mp4`;
  const captions = isTour ? tour.captions[videoLang === 'fr' ? 'fr' : 'en'] : current ? `${MEDIA}/current/current-${videoLang}.vtt` : `${MEDIA}/captions-${videoLang}.vtt`;
  const poster = isTour ? tour.poster : current ? `${MEDIA}/current/fitting.png` : `${MEDIA}/poster-${videoLang}.webp`;
  const transcript = videoLang === 'fr' ? transcriptFr : transcriptEn;

  return <>
    <Nav />
    <main id="main" class="guide-page" lang={language.value}>
      <DocsNavigation active="studio" french={fr} />
      <header class="guide-heading">
        <div>
          <h1 class="display">{t('The Studio guide.', 'Le guide du Studio.')}</h1>
          <p>{t('Start with a person. Shape their visual world, collect references, and keep the work you want to use. These walkthroughs show you where to begin.', 'Commencez par une personne. Façonnez son univers visuel, rassemblez des références et conservez le travail que vous souhaitez utiliser. Ces visites vous montrent par où commencer.')}</p>
        </div>
        <nav class="guide-language" aria-label={t('Guide language', 'Langue du guide')}>
          <a href="/docs/?lang=en" lang="en" aria-current={!fr ? 'true' : undefined}>{t('English', 'English')}</a>
          <a href="/docs/?lang=fr" lang="fr" aria-current={fr ? 'true' : undefined}>{t('Français', 'Français')}</a>
        </nav>
      </header>

      <section class="guide-watch" aria-labelledby="walkthrough-title">
        <div>
          <video key={`${recording.value}-${language.value}`} controls preload="metadata" playsInline width={isTour ? 1920 : 1440} height={isTour ? 1080 : 900}
            class={isTour ? 'guide-wide' : undefined} poster={poster}
            aria-label={isTour ? t('Baste in 74 seconds, narrated tour', 'Baste en 74 secondes, visite commentée') : t('Studio walkthrough', 'Visite du Studio')}>
            <source src={video} type="video/mp4" />
            <track kind="captions" src={captions} srclang={videoLang} label={videoLang === 'fr' ? 'Français' : 'English'} default />
            {t('Download the recording to watch it on your device.', 'Téléchargez l’enregistrement pour le regarder sur votre appareil.')}
          </video>
          <div class="guide-downloads">
            <a href={video} download>{t('Download recording', 'Télécharger la vidéo')}</a>
            <a href={captions} download>{t('Download captions', 'Télécharger les sous-titres')}</a>
          </div>
          <p class="guide-recording-note">{isTour
            ? t('Narrated tour of Baste, recorded October 10, 2026 · English narration with English or French captions. The archive replays a recorded fal run.', 'Visite commentée de Baste, enregistrée le 10 octobre 2026 · narration anglaise, sous-titres anglais ou français. L’archive rejoue une génération fal enregistrée.')
            : current
            ? currentRecording.narrated
              ? t(`Current Studio · ${CURRENT_DURATION} seconds · English narration with captions.`, `Studio actuel · ${CURRENT_DURATION} secondes · narration anglaise et sous-titres français.`)
              : t(`Current Studio · ${CURRENT_DURATION} seconds · silent recording with step-by-step captions.`, `Studio actuel · ${CURRENT_DURATION} secondes · enregistrement silencieux avec sous-titres explicatifs.`)
            : t('Narrated tour, recorded October 2, 2026. OpenPencil has since moved inside Tokens; Material now has its own tab.', 'Visite commentée enregistrée le 2 octobre 2026. OpenPencil a depuis été déplacé dans Tokens ; Material dispose désormais de son propre onglet.')}</p>
          <details class="guide-transcript">
            <summary>{current ? t('Read the steps', 'Lire les étapes') : t('Read the transcript', 'Lire la transcription')}</summary>
            {isTour
              ? tour.chapters.map(part => <section key={part.id}><h3>{clock(part.start)} · {fr ? part.titleFr : part.title}</h3><p>{fr ? part.textFr : part.text}</p></section>)
              : current ? CURRENT_STEPS.map(([en, french]) => <p key={en}>{t(en, french)}</p>) : transcript.map(part => <section key={part.id}><h3>{part.title}</h3><p>{part.paragraph}</p></section>)}
          </details>
        </div>
        <div class="guide-watch-aside">
          <h2 id="walkthrough-title">{t('Watch a fitting.', 'Suivez une séance.')}</h2>
          <p>{t('Start with Baste in 74 seconds, follow the current worktable, or take the longer narrated walkthrough in English or French.', 'Commencez par Baste en 74 secondes, découvrez la table de travail actuelle, ou suivez la visite commentée plus longue en anglais ou en français.')}</p>
          <div class="guide-recordings" role="group" aria-label={t('Choose a recording', 'Choisir une vidéo')}>
            <button type="button" aria-pressed={isTour} onClick$={() => { recording.value = 'tour'; }}><span>{t('Baste in 74 seconds', 'Baste en 74 secondes')}</span><small>{TOUR_TIME}</small></button>
            <button type="button" aria-pressed={current} onClick$={() => { recording.value = 'current'; }}><span>{t('Current Studio', 'Studio actuel')}</span><small>{CURRENT_TIME}</small></button>
            <button type="button" aria-pressed={recording.value === 'en'} onClick$={() => { recording.value = 'en'; }}><span>{t('Narrated tour · English', 'Visite commentée · anglais')}</span><small>1:53</small></button>
            <button type="button" lang="fr" aria-pressed={recording.value === 'fr'} onClick$={() => { recording.value = 'fr'; }}><span>{t('Visite commentée · Français', 'Visite commentée · Français')}</span><small>1:56</small></button>
          </div>
          <a href={localeHref("/gui/", language.value)}>{t('Open Studio', 'Ouvrir le Studio')} →</a>
        </div>
      </section>

      <div class="guide-layout">
        <nav class="guide-outline" aria-label={t('Guide chapters', 'Chapitres du guide')}>
          <h2>{t('In the workroom', 'Dans l’atelier')}</h2>
          {chapters.map(chapter => <a key={chapter.id} href={`#${chapter.id}`}>{chapter.title}</a>)}
          <a class="guide-developer-link" href={localeHref("/docs/developers/", language.value)}>{t('Installation, CLI and API', 'Installation, CLI et API')} ↗</a>
        </nav>
        <div class="guide-chapters">
          <label class="guide-jump">{t('Jump to a chapter', 'Aller à un chapitre')}
            <select aria-label={t('Jump to a chapter', 'Aller à un chapitre')} onChange$={(_, el) => { if (el.value) window.location.hash = el.value; }}>
              <option value="">{t('Choose a chapter', 'Choisir un chapitre')}</option>
              {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
            </select>
          </label>
          {chapters.map(chapter => {
            const clip = CLIPS[chapter.id];
            const screen = CURRENT_SCREENS[chapter.id];
            const src = screen ? `${MEDIA}/current/${screen}.png` : chapter.screen && chapter.screen !== 'docs' ? `${MEDIA}/${language.value}/${chapter.screen}.webp` : undefined;
            return <details key={chapter.id} id={chapter.id} class="guide-chapter" open={chapter.id === 'orientation'}>
              <summary><h2>{chapter.title}</h2></summary>
              <div class="guide-chapter-body">
                {chapter.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
                {chapter.href && <a href={localeHref(chapter.href, language.value)}>{t('Open this view', 'Ouvrir cette vue')} →</a>}
                {clip ? <figure>
                  <ChapterClip src={`/media/tour/clips/${clip.file}.mp4`} poster={`/media/tour/clips/${clip.file}.webp`} label={chapter.title} french={fr} />
                  <figcaption>{clip.home
                    ? t('Recorded on the home page · October 10, 2026', 'Enregistré sur la page d’accueil · 10 octobre 2026')
                    : t('Recorded in the Studio · October 10, 2026', 'Enregistré dans le Studio · 10 octobre 2026')}</figcaption>
                </figure> : src && <figure>
                  <a href={src} target="_blank" rel="noopener"><img src={src} width={1440} height={screen ? 900 : 1000} loading="lazy" alt={chapter.title} /></a>
                  <figcaption>{screen ? t('Current Studio recording · October 10, 2026', 'Enregistrement du Studio actuel · 10 octobre 2026') : t('Published Studio guide · October 2, 2026. Some controls have since moved.', 'Guide du Studio publié le 2 octobre 2026. Certains contrôles ont depuis été déplacés.')}</figcaption>
                </figure>}
              </div>
            </details>;
          })}
          <details class="guide-edition">
            <summary>{t('Keep the published edition', 'Conserver l’édition publiée')}</summary>
            <p>{t('The illustrated October 2 guide is available for offline reading. It includes the original screenshots and a developer appendix. Use the chapters above for the current navigation.', 'Le guide illustré du 2 octobre est disponible hors ligne. Il contient les captures d’origine et une annexe développeur. Consultez les chapitres ci-dessus pour la navigation actuelle.')}</p>
            <div class="guide-downloads"><a href={`${MEDIA}/guide-en.pdf`} download>{t('English PDF', 'PDF anglais')}</a><a href={`${MEDIA}/guide-fr.pdf`} download>{t('PDF français', 'PDF français')}</a></div>
          </details>
        </div>
      </div>
    </main>
    <Footer />
  </>;
});

export const head: DocumentHead = {
  title: 'Studio guide · Baste',
  meta: [{ name: 'description', content: 'Learn the Baste Studio with recorded walkthroughs: personas, materials, tokens, moodboards, generation, feedback and saved projects. English and French guides.' }],
};
