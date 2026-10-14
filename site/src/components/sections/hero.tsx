import { useLocale } from "~/i18n/provider";
import { text, localeHref } from "~/i18n/runtime";
import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { FittingRoom } from "~/components/fitting/fitting-room";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";

export const HeroSection = component$(() => {
  const locale = useLocale();
  return (
    <section
      id="fitting"
      aria-labelledby="hero-title"
      class={css({ maxW: "1360px", mx: "auto", px: { base: 4, md: 8 }, pt: { base: 10, md: 16 }, pb: { base: 16, md: 24 } })}
    >
      {/* Headline across the top, so the fitting below gets the full width it needs */}
      <div class={`rise ${css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "minmax(0, 1.2fr) minmax(0, 1fr)" }, gap: { base: 6, lg: 12 }, alignItems: "end", pb: { base: 8, md: 12 } })}`}>
        <div class={css({ display: "flex", flexDirection: "column", gap: 5 })}>
          <span class="label" style={{ color: "#A9311E" }}>{text(locale.value, "Persona-driven design generation")}</span>
          <h1 id="hero-title" class="display" style={{ fontSize: "clamp(48px, 7vw, 104px)" }}>{text(locale.value, "Cut to fit")} <em class={css({ fontStyle: "italic", color: "thread-ink" })}>{text(locale.value, "one")}</em>{text(locale.value, "person.")} </h1>
        </div>
        <div class={css({ display: "flex", flexDirection: "column", gap: 5, pb: { lg: 3 } })}>
          <p class={css({ fontSize: { base: "18px", md: "20px" }, color: "ink-soft", maxW: "38ch", lineHeight: 1.5 })}>{text(locale.value, "Start with their favourite film. The room they feel at home in. The things they can’t stand in an app. Baste turns that particular taste into an interface.")} </p>
          <div class={css({ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" })}>
            <a
              href="#meet"
              data-juice="snip"
              class={css({
                display: "inline-flex", alignItems: "center", gap: 2, px: 5, h: "46px", rounded: "base",
                bg: "ink", color: "paper", fontWeight: 600, textDecoration: "none", transition: "background 0.2s",
                _hover: { bg: "thread-ink" },
              })}
            >{text(locale.value, "Meet a persona")} <span aria-hidden="true">↓</span>
            </a>
            <a
              href="#tour"
              class={css({
                display: "inline-flex", alignItems: "center", gap: 2.5, h: "46px", color: "ink", fontWeight: 600, fontSize: "15px",
                textDecoration: "none", transition: "color 0.2s", _hover: { color: "thread-ink" },
              })}
            >
              <span aria-hidden="true" class={css({ display: "grid", placeItems: "center", w: "32px", h: "32px", pl: "2px", rounded: "full", border: "1.5px solid currentColor" })}>
                <svg width="10" height="12" viewBox="0 0 14 16"><path d="M1.5 1.6 L12.6 8 L1.5 14.4 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
              </span>{text(locale.value, "Watch the tour")} <span class={css({ fontFamily: "mono", fontSize: "12px", fontWeight: 400, color: "ink-muted" })}>1:14</span>
            </a>
            <a href={localeHref("/gui?new=1", locale.value)} class={css({ color: "ink-soft", fontSize: "15px", py: 3, textUnderlineOffset: "4px", _hover: { color: "thread-ink" } })}>{text(locale.value, "Start your own fitting")}</a>
          </div>
        </div>
      </div>

      <div class={`rise ${css({ minW: 0 })}`} style={{ animationDelay: "120ms" }}>
        <FittingRoom personas={DEMO_PERSONAS} tokens={DEMO_TOKENS} autoplay={false} />
        <p class={css({ mt: 4, fontSize: "13px", color: "ink-muted", maxW: "72ch" })}>{text(locale.value, "One screen, three people. Layout, type, colour and motion all come from their measurements; the images and variants are from real Baste runs, with icons refined for the interface.")} </p>
      </div>
    </section>
  );
});
