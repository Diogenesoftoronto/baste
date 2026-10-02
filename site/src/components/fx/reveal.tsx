import { component$, useVisibleTask$ } from "@builder.io/qwik";

/**
 * Scroll choreography for the whole page:
 * - `[data-reveal]` elements rise into place as they enter the viewport
 *   (`data-reveal-delay="120"` staggers them).
 * - `[data-depth]` elements drift at their own rate for parallax depth.
 * - `--scroll-progress` on <html> drives the basting thread that sews down the page.
 * Content is visible by default; this only adds motion once JS is running.
 */
export const Reveal = component$(() => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    if (reduced) return;
    root.classList.add("motion");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          const delay = Number(el.dataset.revealDelay || 0);
          setTimeout(() => el.setAttribute("data-revealed", ""), delay);
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const observe = () => document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])").forEach((el) => io.observe(el));
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        root.style.setProperty("--scroll-progress", String(max > 0 ? window.scrollY / max : 0));
        const vh = window.innerHeight;
        document.querySelectorAll<HTMLElement>("[data-depth]").forEach((el) => {
          const r = el.getBoundingClientRect();
          const center = r.top + r.height / 2 - vh / 2;
          const depth = Number(el.dataset.depth || 0);
          el.style.setProperty("--depth-y", `${(-center * depth).toFixed(1)}px`);
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    cleanup(() => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.classList.remove("motion");
    });
  });
  return null;
});
