import { useLocale } from "~/i18n/provider";
import { text, personaText } from "~/i18n/runtime";
import { component$, useSignal } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { CodeView } from "~/components/ui/code-view";
import { Section, SectionHead } from "~/components/ui/section";
import { DEMO_PERSONAS, DEMO_TOKEN_EXPORTS } from "~/lib/demo-data";
import type { TokenFormat } from "~/lib/api-types";

const FORMATS: Array<{ id: TokenFormat; label: string }> = [
  { id: "css", label: "CSS variables" },
  { id: "tailwind", label: "Tailwind" },
  { id: "panda", label: "Panda" },
  { id: "json", label: "JSON" },
];

const OUTPUTS = [
  { k: "Icons & illustrations", via: "QuiverAI", f: "svg/", d: "Vector icons, spot illustrations and component art, drawn in the persona's icon style." },
  { k: "Images & textures", via: "GPT Image 2", f: "images/", d: "Hero images, backgrounds and surface textures from persona-specific prompts." },
  { k: "Ambient loops", via: "Veo 3", f: "videos/", d: "Short motion loops and transitions timed to the persona's motion profile." },
  { k: "Design tokens", via: "Baste", f: "tokens", d: "Colour, type, spacing, radii, shadows and easing as CSS, Tailwind, Panda or JSON." },
  { k: "Editable document", via: "OpenPencil", f: ".op", d: "Tokens and components as a design file you can keep editing, watched for changes." },
  { k: "Suite manifest", via: "Baste", f: "-suite.json", d: "Every asset with its purpose, scores, cultural references and relationships." },
];

export const DeliverablesSection = component$(() => {
  const locale = useLocale();
  const persona = useSignal(DEMO_PERSONAS[1]?.id ?? DEMO_PERSONAS[0].id);
  const format = useSignal<TokenFormat>("css");
  const code = DEMO_TOKEN_EXPORTS[persona.value]?.[format.value] ?? "";

  return (
    <Section id="deliverables" tone="night">
      <SectionHead
        tone="night"
        kicker={text(locale.value, "04 — Off the table")}
        title={text(locale.value, "Finished pieces, ready to wear.")}
        lede={text(locale.value, "Generation ends in files you can ship: assets in assets/output/{svg,images,videos}, tokens for whichever stack you use, and a manifest that says why each piece exists.")}
      />

      <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "0.9fr 1.1fr" }, gap: { base: 10, lg: 14 }, mt: 12 })}>
        <ul class={css({ listStyle: "none", display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", sm: "1fr 1fr" }, gap: 0, alignContent: "start" })}>
          {OUTPUTS.map((o) => (
            <li key={o.k} class={css({ py: 5, pr: 5, borderTop: "1px solid #3A372F", display: "flex", flexDirection: "column", gap: 1 })}>
              <span class={css({ display: "flex", justifyContent: "space-between", gap: 2, fontFamily: "mono", fontSize: "11px", color: "night-muted" })}>
                <span>{o.via}</span>
                <span>{o.f}</span>
              </span>
              <span class={css({ fontWeight: 600, fontSize: "16px" })}>{text(locale.value, o.k)}</span>
              <span class={css({ fontSize: "13.5px", color: "night-muted", lineHeight: 1.5 })}>{text(locale.value, o.d)}</span>
            </li>
          ))}
        </ul>

        <div class={css({ display: "flex", flexDirection: "column", gap: 3, minW: 0 })}>
          <div class={css({ display: "flex", justifyContent: "space-between", gap: 3, flexWrap: "wrap" })}>
            <div role="tablist" aria-label={text(locale.value, "Token format")} class={css({ display: "flex", gap: 1, flexWrap: "wrap" })}>
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={format.value === f.id}
                  onClick$={() => (format.value = f.id)}
                  class={css({
                    px: 3, h: "32px", rounded: "sm", fontSize: "13px", cursor: "pointer",
                    color: "night-muted", bg: "transparent", border: "1px solid transparent",
                    _hover: { color: "night-text" },
                    "&[aria-selected=true], &[aria-selected=true]:hover": { color: "night", bg: "night-text" },
                  })}
                >
                  {text(locale.value, f.label)}
                </button>
              ))}
            </div>
            <label class={css({ display: "flex", alignItems: "center", gap: 2, fontSize: "13px", color: "night-muted" })}>
              {text(locale.value, "for")}
              <select
                value={persona.value}
                onChange$={(_, el) => (persona.value = el.value)}
                class={css({ h: "32px", px: 2, rounded: "sm", bg: "night-raised", color: "night-text", border: "1px solid #3A372F", fontSize: "13px" })}
              >
                {DEMO_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>{personaText(locale.value, p, p.name)}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ border: "1px solid #3A372F", borderRadius: "4px" }}>
            <CodeView code={code} label={`${text(locale.value, "Token format")} : ${format.value}`} maxHeight="440px" />
          </div>
          <p class={css({ fontFamily: "mono", fontSize: "12px", color: "night-muted" })}>
            $ baste tokens {persona.value} --format {format.value}
          </p>
        </div>
      </div>
    </Section>
  );
});
