import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';

interface ChapterClipProps {
  src: string;
  poster: string;
  label: string;
  french?: boolean;
}

/**
 * A short silent recording for a guide chapter. It plays while it is on screen
 * and stops when scrolled away or when its chapter closes. Pausing it keeps it
 * paused, and under reduced motion it waits for Play.
 */
export const ChapterClip = component$<ChapterClipProps>(({ src, poster, label, french }) => {
  const video = useSignal<HTMLVideoElement>();
  const playing = useSignal(false);
  const held = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const v = video.value;
    if (!v || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !held.value) v.play().catch(() => undefined);
      else if (!entry.isIntersecting) v.pause();
    }, { threshold: 0.5 });
    io.observe(v);
    cleanup(() => io.disconnect());
  });

  const toggle = $(() => {
    const v = video.value;
    if (!v) return;
    if (v.paused) {
      held.value = false;
      v.play().catch(() => undefined);
    } else {
      held.value = true;
      v.pause();
    }
  });

  return <div class="guide-clip">
    <video ref={video} src={src} poster={poster} width={1280} height={800} muted loop playsInline preload="none" aria-label={label}
      onPlay$={() => (playing.value = true)} onPause$={() => (playing.value = false)} />
    <button type="button" class="guide-clip-play" onClick$={toggle}>
      <span aria-hidden="true">{playing.value
        ? <svg width="10" height="12" viewBox="0 0 10 12"><path d="M1.5 1 V11 M8.5 1 V11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
        : <svg width="10" height="12" viewBox="0 0 14 16"><path d="M1.5 1.6 L12.6 8 L1.5 14.4 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>}</span>
      {playing.value ? 'Pause' : french ? 'Lire' : 'Play'}
    </button>
  </div>;
});
