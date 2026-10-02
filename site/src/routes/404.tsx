import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";

export default component$(() => {
  return (
    <>
      <Nav />
      <main id="main" class={css({ maxW: "1240px", mx: "auto", px: { base: 4, md: 8 }, py: { base: 16, md: 28 }, display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 12, alignItems: "center" })}>
        <div class={css({ display: "flex", flexDirection: "column", gap: 5 })}>
          <span class="label" style={{ color: "#A9311E" }}>404 · dropped stitch</span>
          <h1 class="display" style={{ fontSize: "clamp(48px, 7vw, 96px)" }}>
            This page came <em style={{ color: "#A9311E" }}>unpicked.</em>
          </h1>
          <p class={css({ fontSize: "18px", color: "ink-soft", maxW: "40ch" })}>
            The thread ran out before we got here. Pick it back up from the start, or go straight to the cutting table.
          </p>
          <div class={css({ display: "flex", gap: 3, flexWrap: "wrap" })}>
            <a href="/" class={css({ display: "inline-flex", alignItems: "center", px: 5, h: "46px", rounded: "base", bg: "ink", color: "paper", fontWeight: 600, textDecoration: "none", _hover: { bg: "thread-ink" } })}>Back to the start</a>
            <a href="/gui" class={css({ display: "inline-flex", alignItems: "center", px: 5, h: "46px", rounded: "base", border: "1px solid token(colors.rule-strong)", bg: "card", fontWeight: 600, textDecoration: "none", _hover: { borderColor: "ink" } })}>Open the Studio</a>
          </div>
        </div>
        {/* a seam that sews itself in, then frays at the end */}
        <svg viewBox="0 0 420 300" class={css({ w: "100%", h: "auto" })} aria-hidden="true">
          <rect x="30" y="40" width="320" height="200" rx="4" fill="#FBF9F4" stroke="#CFC7B8" transform="rotate(-3 190 140)" />
          <path class="thread-path sew-in" d="M60 220 C 120 120, 200 260, 260 150 S 320 60, 350 90" />
          <path d="M350 90 q 18 6 22 26 M350 90 q 24 -2 36 12 M350 90 q 10 18 4 40" fill="none" stroke="#D2402A" stroke-width="1.4" stroke-linecap="round" />
          <g transform="translate(64 214) rotate(-48)">
            <line x1="0" y1="0" x2="70" y2="0" stroke="#1C1B19" stroke-width="3" stroke-linecap="round" />
            <ellipse cx="62" cy="0" rx="5" ry="1.6" fill="#FBF9F4" stroke="#1C1B19" stroke-width="1.2" />
          </g>
          <text x="210" y="285" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="12" fill="#2F55A4">— thread ends here —</text>
        </svg>
      </main>
      <Footer />
    </>
  );
});

export const head: DocumentHead = { title: "Unpicked — Baste" };
