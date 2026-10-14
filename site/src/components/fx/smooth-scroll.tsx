import { component$, useVisibleTask$ } from "@builder.io/qwik";
import Lenis from "lenis";
import Tempus from "tempus";
import "lenis/dist/lenis.css";

/**
 * Lenis smooth scroll on the shared Tempus frame loop (marketing pages only;
 * native touch and nested scrollers stay independent). Each frame publishes:
 *   --scroll-progress  0–1 down the page, on <html>
 *   --scene            0–1 as each [data-scroll] element crosses the viewport
 *   --pin              0–1 through each [data-pin] element's sticky span
 *   --depth-y          parallax offset for [data-depth] elements
 */
export const SmoothScroll = component$(() => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    let lenis: Lenis | undefined;
    let removeFrame: (() => void) | undefined;
    let scenes: HTMLElement[] = [];
    let depths: HTMLElement[] = [];
    let pins: HTMLElement[] = [];
    let lastY = -1;
    let dirty = true;

    const refresh = () => {
      scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll]"));
      depths = Array.from(document.querySelectorAll<HTMLElement>("[data-depth]"));
      pins = Array.from(document.querySelectorAll<HTMLElement>("[data-pin]"));
      dirty = true;
    };
    const paint = () => {
      const y = lenis?.animatedScroll ?? window.scrollY;
      if (!dirty && Math.abs(y - lastY) < 0.05) return;
      lastY = y;
      dirty = false;
      const vh = window.innerHeight;
      const max = root.scrollHeight - vh;
      root.style.setProperty("--scroll-progress", String(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0));
      // Read geometry before writes, and only while the scroll position changes.
      const sceneValues = scenes.map((el) => {
        const rect = el.getBoundingClientRect();
        return Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
      });
      const depthValues = depths.map((el) => {
        if (reduced.matches || !fine.matches) return 0;
        const rect = el.getBoundingClientRect();
        const previous = parseFloat(el.style.getPropertyValue("--depth-y")) || 0;
        const center = rect.top - previous + rect.height / 2 - vh / 2;
        return Math.min(32, Math.max(-32, -center * Number(el.dataset.depth || 0)));
      });
      // Progress through a pinned element: 0 as it reaches the top, 1 as its sticky span ends.
      const pinValues = pins.map((el) => {
        const rect = el.getBoundingClientRect();
        const span = rect.height - vh;
        return span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 1;
      });
      scenes.forEach((el, i) => el.style.setProperty("--scene", sceneValues[i].toFixed(4)));
      pins.forEach((el, i) => el.style.setProperty("--pin", pinValues[i].toFixed(4)));
      depths.forEach((el, i) => el.style.setProperty("--depth-y", `${depthValues[i].toFixed(1)}px`));
    };
    const configure = () => {
      removeFrame?.();
      lenis?.destroy();
      lenis = !reduced.matches && fine.matches ? new Lenis({
        autoRaf: false, anchors: { offset: -76 }, lerp: 0.11, wheelMultiplier: 0.95,
        allowNestedScroll: true,
        prevent: (node) => node.closest("[data-lenis-prevent], dialog, [role=dialog]") !== null,
      }) : undefined;
      (window as Window & { __lenis?: Lenis }).__lenis = lenis;
      dirty = true;
      paint();
      removeFrame = lenis ? Tempus.add(({ time }) => { lenis?.raf(time); paint(); }, { order: -10, label: "baste-scroll" }) : undefined;
    };
    const onScroll = () => { if (!lenis) paint(); };
    const onResize = () => { dirty = true; paint(); };
    refresh();
    configure();
    const observer = new MutationObserver(refresh);
    observer.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });
    reduced.addEventListener("change", configure);
    fine.addEventListener("change", configure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    cleanup(() => {
      observer.disconnect();
      reduced.removeEventListener("change", configure);
      fine.removeEventListener("change", configure);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      removeFrame?.();
      lenis?.destroy();
      delete (window as Window & { __lenis?: Lenis }).__lenis;
      root.style.removeProperty("--scroll-progress");
      depths.forEach((el) => el.style.removeProperty("--depth-y"));
      pins.forEach((el) => el.style.removeProperty("--pin"));
    });
  }, { strategy: "document-ready" });
  return null;
});
