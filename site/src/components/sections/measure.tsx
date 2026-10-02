import { useLocale } from "~/i18n/provider";
import { text } from "~/i18n/runtime";
import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { MeasurementSheet } from "~/components/fitting/measurement-sheet";
import { DEMO_PERSONAS } from "~/lib/demo-data";
import { Section, SectionHead } from "~/components/ui/section";

export const MeasureSection = component$(() => {
  const locale = useLocale();
  const persona = DEMO_PERSONAS.find((p) => p.id === "cyberbotanist") ?? DEMO_PERSONAS[0];
  return (
    <Section id="measure" tone="deep">
      <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "minmax(0, 0.7fr) minmax(0, 1.3fr)" }, gap: { base: 10, lg: 16 }, alignItems: "start" })}>
        <SectionHead
          kicker={text(locale.value, "01 — Measure")}
          title={text(locale.value, "A persona is not a demographic.")}
          lede={text(locale.value, "“Users aged 25–34” has no taste. A person does. They own a stack of films, a playlist, a room they feel at home in, and a list of things they can't stand in software. Baste takes all of that as measurements.")}
        >
          <ul class={css({ display: "flex", flexDirection: "column", gap: 3, mt: 2, fontSize: "15px", color: "ink-soft" })}>
            {[
              ["Influences", "films, anime, music, games, artists, fashion"],
              ["Habitat", "the spaces, tools and platforms they live in"],
              ["Behaviour", "how they discover, what they value, what annoys them"],
            ].map(([k, v]) => (
              <li key={k} class={css({ display: "grid", gridTemplateColumns: "104px 1fr", gap: 3 })}>
                <span class={css({ fontWeight: 600, color: "ink" })}>{text(locale.value, k)}</span>
                <span>{text(locale.value, v)}</span>
              </li>
            ))}
          </ul>
        </SectionHead>
        <div data-reveal="sheet" style={{ "--rest-rot": "0.6deg" } as Record<string, string>}>
          <div data-depth="0.05">
            <MeasurementSheet persona={persona} />
          </div>
        </div>
      </div>
    </Section>
  );
});
