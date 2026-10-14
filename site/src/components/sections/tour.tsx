import { $, component$, useSignal, useStyles$ } from "@builder.io/qwik";
import tour from "~/lib/tour.json";
import styles from "./tour.css?inline";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * The narrated tour (videos/baste-tour), screened between the fitting room and
 * the conversation. It loads nothing until asked; the chapter rule underneath
 * doubles as the scrubber, filling with thread as each chapter plays.
 */
export const TourSection = component$(() => {
  useStyles$(styles);
  const video = useSignal<HTMLVideoElement>();
  const started = useSignal(false);
  const time = useSignal(0);

  const play = $(async (at?: number) => {
    const v = video.value;
    if (!v) return;
    if (at !== undefined) v.currentTime = at;
    started.value = true;
    try {
      await v.play();
    } catch {
      // Blocked or failed: the native controls are showing now, so the reader can retry.
    }
  });

  const chapters = tour.chapters.map((c, i) => {
    const end = tour.chapters[i + 1]?.start ?? tour.duration;
    return { ...c, end, fill: started.value ? Math.min(1, Math.max(0, (time.value - c.start) / (end - c.start))) : 0 };
  });
  const active = started.value ? chapters.findIndex((c) => time.value >= c.start - 0.05 && time.value < c.end) : -1;

  return (
    <section id="tour" class="tour" aria-labelledby="tour-title">
      <div class="tour-layout">
        <header class="tour-intro">
          <div>
            <p class="label tour-kicker">The tour · {clock(tour.duration)}</p>
            <h2 id="tour-title" class="display" data-words>A fitting, start to <em>finish.</em></h2>
          </div>
          <p>
            Seventy-four seconds, narrated. Measure a person, re-cut one screen for three people, judge two dozen
            drafts, then keep the files. The screens are recorded from Baste; the drafts come from real runs.
          </p>
        </header>

        <figure class="tour-film">
          <div class="tour-screen">
            <video
              ref={video}
              src={tour.src}
              poster={tour.poster}
              width={1920}
              height={1080}
              preload="none"
              playsInline
              controls={started.value}
              aria-label="Baste tour, narrated, with captions"
              onPlay$={() => (started.value = true)}
              onTimeUpdate$={(_, el) => (time.value = el.currentTime)}
            >
              <track kind="captions" src={tour.captions.en} srclang="en" label="English" default />
              <track kind="captions" src={tour.captions.fr} srclang="fr" label="Français" />
            </video>
            {!started.value && (
              <button type="button" class="tour-play" onClick$={() => play()}>
                <span class="tour-play-pill">
                  <span class="tour-play-icon" aria-hidden="true">
                    <svg width="14" height="16" viewBox="0 0 14 16"><path d="M1.5 1.6 L12.6 8 L1.5 14.4 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
                  </span>
                  <span class="tour-play-label">Play the tour</span>
                  <span class="tour-play-time">{clock(tour.duration)} · sound on</span>
                </span>
              </button>
            )}
          </div>

          <ol class="tour-chapters" aria-label="Tour chapters">
            {chapters.map((c, i) => (
              <li key={c.id} style={{ "--d": String(c.end - c.start), "--f": c.fill.toFixed(3) } as Record<string, string>}>
                <button type="button" aria-current={i === active ? "true" : undefined} onClick$={() => play(c.start)}>
                  <span class="tour-chapter-time">{clock(c.start)}</span>
                  <span class="tour-chapter-name">{c.title}</span>
                </button>
              </li>
            ))}
          </ol>

          <figcaption>
            English narration with English and French captions.
            <span class="tour-links">
              <a href={tour.src} download>Download the MP4</a>
              <a href="/docs/">Read the Studio guide</a>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
});
