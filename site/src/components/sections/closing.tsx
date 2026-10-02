import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";

export const ClosingSection = component$(() => {
  return (
    <section class={css({ maxW: "1240px", mx: "auto", px: { base: 4, md: 8 }, pt: { base: 8, md: 12 }, pb: { base: 4, md: 8 } })}>
      <div
        class={css({
          position: "relative",
          bg: "card",
          border: "1px solid token(colors.rule)",
          rounded: "sm",
          boxShadow: "lift",
          px: { base: 6, md: 14 },
          py: { base: 12, md: 16 },
          display: "grid",
          gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1.3fr 0.7fr" },
          gap: 8,
          alignItems: "center",
          overflow: "hidden",
        })}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 1200 300"
          preserveAspectRatio="none"
          class={css({ position: "absolute", inset: 0, w: "100%", h: "100%", pointerEvents: "none", opacity: 0.9 })}
        >
          <path class="thread-path" d="M-20 250 C 200 180, 340 300, 560 230 S 900 120, 1220 170" />
        </svg>
        <div class={css({ position: "relative", display: "flex", flexDirection: "column", gap: 4 })}>
          <h2 class="display" style={{ fontSize: "clamp(36px, 5vw, 68px)" }}>
            Design for the person, <em style={{ color: "#A9311E" }}>not the persona document.</em>
          </h2>
        </div>
        <div class={css({ position: "relative", display: "flex", flexDirection: "column", gap: 3, alignItems: { base: "start", md: "end" } })}>
          <a
            href="/gui"
            data-juice="snip"
            class={css({
              display: "inline-flex", alignItems: "center", gap: 2, px: 6, h: "50px", rounded: "base",
              bg: "ink", color: "paper", fontWeight: 600, textDecoration: "none", transition: "background 0.2s",
              _hover: { bg: "thread-ink" },
            })}
          >
            Start a fitting <span aria-hidden="true">→</span>
          </a>
          <span class={css({ fontSize: "13px", color: "ink-muted" })}>Runs in demo mode, or wired to <code>baste gui</code>.</span>
        </div>
      </div>
    </section>
  );
});
