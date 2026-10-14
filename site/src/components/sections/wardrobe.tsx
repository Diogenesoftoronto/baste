import { useLocale } from "~/i18n/provider";
import { text, localeHref } from "~/i18n/runtime";
import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { PersonaCard } from "~/components/fitting/persona-card";
import { Section, SectionHead } from "~/components/ui/section";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";

export const WardrobeSection = component$(() => {
  const locale = useLocale();
  return (
    <Section id="wardrobe" tone="deep">
      <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 8, flexWrap: "wrap" })}>
        <SectionHead
          kicker={text(locale.value, "03 — The wardrobe")}
          title={text(locale.value, "Three people, three fittings.")}
          lede={text(locale.value, "Baste ships with three base personas. Each card is set in that persona's generated design system, not ours.")}
        />
      </div>

      <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 6, mt: 12 })}>
        {DEMO_PERSONAS.map((p, i) => (
          <div key={p.id} data-reveal="sheet" data-reveal-delay={String(i * 130)} style={{ "--rest-rot": `${[-0.8, 0.5, -0.3][i] ?? 0}deg` } as Record<string, string>}>
            <div data-depth={String([0.04, 0.08, 0.02][i] ?? 0.04)} class={css({ h: "100%" })}>
              <PersonaCard persona={p} tokens={DEMO_TOKENS[p.id]} />
            </div>
          </div>
        ))}

        {/* Your own */}
        <div
          class={css({
            display: "flex",
            flexDirection: "column",
            gap: 4,
            p: "22px",
            rounded: "lg",
            border: "1.5px dashed token(colors.rule-strong)",
            bg: "rgba(251,249,244,0.5)",
          })}
        >
          <span class="label" style={{ color: "#6E6A61" }}>{text(locale.value, "Bespoke")}</span>
          <h3 class="display" style={{ fontSize: "30px" }}>{text(locale.value, "Measure your own.")}</h3>
          <p class={css({ fontSize: "14px", color: "ink-soft" })}>
            {text(locale.value, "Write a persona from scratch, extend a base one, cross two together, or start from a website you admire. Baste decomposes its palette, type and imagery into a draft persona.")}
          </p>
          <div class={css({ display: "flex", flexDirection: "column", gap: 2, mt: "auto" })}>
            <a href={localeHref("/gui?new=1", locale.value)} class={ghostLink}>{text(locale.value, "New persona")} <span aria-hidden="true">→</span></a>
            <a href={localeHref("/gui?flow=decompose", locale.value)} class={ghostLink}>{text(locale.value, "Decompose a website")} <span aria-hidden="true">→</span></a>
            <a href={localeHref("/gui?flow=remix", locale.value)} class={ghostLink}>{text(locale.value, "Remix two personas")} <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </div>
    </Section>
  );
});

const ghostLink = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  px: 4,
  h: "42px",
  rounded: "base",
  border: "1px solid token(colors.rule-strong)",
  bg: "card",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  transition: "all 0.2s",
  _hover: { bg: "ink", color: "paper", borderColor: "ink" },
});
