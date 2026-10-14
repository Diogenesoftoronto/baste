import { component$, useVisibleTask$ } from "@builder.io/qwik";

/**
 * Scroll choreography for the whole page:
 * - `[data-reveal]` elements rise into place as they enter the viewport
 *   (`data-reveal-delay="120"` staggers them).
 * - `[data-words]` headings sew in word by word as they arrive.
 * Parallax (`[data-depth]`) and scroll progress live in fx/smooth-scroll.
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
    const observe = () => {
      document.querySelectorAll<HTMLElement>("[data-words]:not([data-split])").forEach(splitWords);
      document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])").forEach((el) => io.observe(el));
    };
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });

    cleanup(() => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove("motion");
    });
  });
  return null;
});

/**
 * Wrap each word of a heading's text nodes in a span with its index, so CSS can
 * stagger them (react-bits' BlurText, done with one transition per word and no
 * runtime). Nested elements such as <em> keep their own styling.
 */
function splitWords(el: HTMLElement) {
  el.setAttribute("data-split", "");
  el.setAttribute("data-reveal", el.getAttribute("data-reveal") || "words");
  let i = 0;
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent || "").split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.append(part);
          else {
            const w = document.createElement("span");
            w.className = "w";
            w.style.setProperty("--i", String(i++));
            w.textContent = part;
            frag.append(w);
          }
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    }
  };
  walk(el);
}
