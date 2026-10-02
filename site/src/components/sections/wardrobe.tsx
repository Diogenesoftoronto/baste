import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { PersonaCard } from "~/components/fitting/persona-card";
import { Section, SectionHead } from "~/components/ui/section";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";

export const WardrobeSection = component$(() => {
  return (
    <Section id="wardrobe" tone="deep">
      <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 8, flexWrap: "wrap" })}>
        <SectionHead
          kicker="03 — The wardrobe"
          title="Three people, three fittings."
          lede="Baste ships with three base personas. Each card is set in that persona's generated design system, not ours."
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
          <span class="label" style={{ color: "#6E6A61" }}>Bespoke</span>
          <h3 class="display" style={{ fontSize: "30px" }}>Measure your own.</h3>
          <p class={css({ fontSize: "14px", color: "ink-soft" })}>
            Write a persona from scratch, extend a base one, cross two together, or start from a
            website you admire. Baste decomposes its palette, type and imagery into a draft persona.
          </p>
          <div class={css({ display: "flex", flexDirection: "column", gap: 2, mt: "auto" })}>
            <a href="/gui?new=1" class={ghostLink}>New persona <span aria-hidden="true">→</span></a>
            <a href="/gui?flow=decompose" class={ghostLink}>Decompose a website <span aria-hidden="true">→</span></a>
            <a href="/gui?flow=remix" class={ghostLink}>Remix two personas <span aria-hidden="true">→</span></a>
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
