import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";

/**
 * A basting thread in the left margin that sews itself down the page as you
 * read (driven by --scroll-progress from fx/reveal). Wide screens only.
 */
export const PageSeam = component$(() => {
  // a long, gently wandering seam
  let d = "M 20 0";
  for (let y = 0; y < 2000; y += 100) {
    const x = y % 200 === 0 ? 30 : 10;
    d += ` Q ${x} ${y + 50} 20 ${y + 100}`;
  }
  return (
    <div
      aria-hidden="true"
      class={css({
        position: "fixed",
        left: "max(8px, calc((100vw - 1320px) / 2 - 24px))",
        top: "60px",
        bottom: 0,
        w: "40px",
        pointerEvents: "none",
        zIndex: 1,
        display: { base: "none", "2xl": "block" },
      })}
    >
      <svg viewBox="0 0 40 2000" preserveAspectRatio="none" class={css({ w: "100%", h: "100%", overflow: "visible" })}>
        <path d={d} fill="none" stroke="#CFC7B8" stroke-width="1.2" stroke-dasharray="3 6" vector-effect="non-scaling-stroke" />
        <path
          d={d}
          fill="none"
          stroke="#D2402A"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="10 8"
          vector-effect="non-scaling-stroke"
          style={{ clipPath: "inset(0 0 calc((1 - var(--scroll-progress, 0)) * 100%) 0)" }}
        />
      </svg>
      {/* the needle rides the end of the thread */}
      <svg
        width="22"
        height="40"
        viewBox="0 0 22 40"
        class={css({ position: "absolute", left: "9px", transition: "top 0.12s linear" })}
        style={{ top: "calc(var(--scroll-progress, 0) * 100% - 20px)" }}
      >
        <line x1="11" y1="2" x2="11" y2="38" stroke="#1C1B19" stroke-width="2.2" stroke-linecap="round" />
        <ellipse cx="11" cy="7" rx="1.2" ry="3" fill="#F1ECE2" stroke="#1C1B19" stroke-width="1" />
      </svg>
    </div>
  );
});
