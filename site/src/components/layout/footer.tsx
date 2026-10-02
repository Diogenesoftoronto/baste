import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { BasteLogo } from "./baste-logo";
import { GITHUB_URL } from "./nav";

export const Footer = component$(() => {
  return (
    <footer class={css({ mt: 24, bg: "night", color: "night-text" })}>
      <div class="stitch-rule" aria-hidden="true" />
      <div
        class={css({
          maxW: "1240px",
          mx: "auto",
          px: { base: 4, md: 8 },
          py: 14,
          display: "grid",
          gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1.4fr 1fr 1fr" },
          gap: 10,
        })}
      >
        <div class={css({ display: "flex", flexDirection: "column", gap: 4, maxW: "360px" })}>
          <BasteLogo size={28} tone="paper" />
          <p class={css({ color: "night-muted", fontSize: "14px" })}>
            Baste (v.) — to tack a garment together with long, loose stitches so it can be
            fitted to one person before the final cut.
          </p>
        </div>
        <div class={css({ display: "flex", flexDirection: "column", gap: 2, fontSize: "14px" })}>
          <span class="label" style={{ color: "#A8A193" }}>Make</span>
          <a href="/gui" class={footLink}>Studio</a>
          <a href="/materials/" class={footLink}>Material room</a>
          <a href="/#method" class={footLink}>Method</a>
          <a href="/#install" class={footLink}>Install the CLI</a>
        </div>
        <div class={css({ display: "flex", flexDirection: "column", gap: 2, fontSize: "14px" })}>
          <span class="label" style={{ color: "#A8A193" }}>Read</span>
          <a href="/specimen" class={footLink}>Pattern book</a>
          <a href="/docs/" class={footLink}>Documentation</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener" class={footLink}>GitHub</a>
          <a href={`${GITHUB_URL}/tree/main#readme`} target="_blank" rel="noopener" class={footLink}>README</a>
        </div>
      </div>
      <div
        class={css({
          maxW: "1240px",
          mx: "auto",
          px: { base: 4, md: 8 },
          pb: 8,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 3,
          fontFamily: "mono",
          fontSize: "12px",
          color: "night-muted",
        })}
      >
        <span>v0.2.0 · MIT</span>
        <span>Fitted, not templated.</span>
      </div>
    </footer>
  );
});

const footLink = css({
  color: "night-text",
  textDecoration: "none",
  width: "fit-content",
  _hover: { color: "#F0C534" },
});
