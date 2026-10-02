import { useLocale } from "~/i18n/provider";
import { text, localeHref } from "~/i18n/runtime";
import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { BasteLogo } from "./baste-logo";
import { GITHUB_URL } from "./nav";

export const Footer = component$(() => {
  const locale = useLocale();
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
            {text(locale.value, "Baste (v.) — to tack a garment together with long, loose stitches so it can be fitted to one person before the final cut.")}
          </p>
        </div>
        <div class={css({ display: "flex", flexDirection: "column", gap: 2, fontSize: "14px" })}>
          <span class="label" style={{ color: "#A8A193" }}>{text(locale.value, "Make")}</span>
          <a href={localeHref("/gui", locale.value)} class={footLink}>{text(locale.value, "Studio")}</a>
          <a href={localeHref("/materials/", locale.value)} class={footLink}>{text(locale.value, "Material room")}</a>
          <a href={localeHref("/#method", locale.value)} class={footLink}>{text(locale.value, "Method")}</a>
          <a href={localeHref("/#install", locale.value)} class={footLink}>{text(locale.value, "Install the CLI")}</a>
        </div>
        <div class={css({ display: "flex", flexDirection: "column", gap: 2, fontSize: "14px" })}>
          <span class="label" style={{ color: "#A8A193" }}>{text(locale.value, "Read")}</span>
          <a href={localeHref("/specimen", locale.value)} class={footLink}>{text(locale.value, "Pattern book")}</a>
          <a href={localeHref("/docs/", locale.value)} class={footLink}>{text(locale.value, "Documentation")}</a>
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
        <nav aria-label={locale.value === "fr" ? "Textes juridiques en révision" : "Legal review drafts"} class={css({ display: "flex", flexWrap: "wrap", gap: 4 })}>
          <a href={localeHref("/terms/", locale.value) + (locale.value === "fr" ? "#legal-fr" : "#legal-en")} class={footLink}>{locale.value === "fr" ? "Conditions · projet" : "Terms · draft"}</a>
          <a href={localeHref("/privacy/", locale.value) + (locale.value === "fr" ? "#legal-fr" : "#legal-en")} class={footLink}>{locale.value === "fr" ? "Confidentialité · projet" : "Privacy · draft"}</a>
        </nav>
        <span>{text(locale.value, "Fitted, not templated.")}</span>
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
