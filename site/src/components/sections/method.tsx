import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { QDArchive } from "~/components/fitting/qd-archive";
import { Section, SectionHead } from "~/components/ui/section";

const STEPS = [
  { n: "01", t: "Measure", d: "Load or write a persona: influences, habitat, behaviour. Baste infers the aesthetic profile, or you set it by hand." },
  { n: "02", t: "Draft", d: "Each asset type gets its own prompt. An icon is described differently from a hero image or an ambient loop." },
  { n: "03", t: "Baste", d: "Quality-diversity evolution, 5–10 generations. Candidates spread across temperature, density and abstractness; every niche keeps its best." },
  { n: "04", t: "Fit", d: "An LLM judge scores each candidate against the persona, weighted toward whether it feels made for them." },
  { n: "05", t: "Cut", d: "A diverse final set becomes production assets — SVG, images, video loops — packaged with tokens and a suite manifest." },
];

const JUDGE = [
  { k: "Persona alignment", w: 30, c: "#D2402A", q: "Does this feel made for them?" },
  { k: "Visual quality", w: 20, c: "#1C1B19", q: "Is it well executed?" },
  { k: "Uniqueness", w: 20, c: "#2F55A4", q: "Could a stock generator have made it?" },
  { k: "Coherence", w: 15, c: "#2E7D5B", q: "Does it belong with the rest of the suite?" },
  { k: "Usability", w: 15, c: "#C9A21E", q: "Does it survive a real interface?" },
];

export const MethodSection = component$(() => {
  return (
    <Section id="method">
      <SectionHead
        kicker="02 — Method"
        title="Baste first. Cut later."
        lede="Tailors tack a garment together loosely, try it on, and only then sew it for good. Baste does the same with design: it explores many loose options, fits them to the persona, and only then produces the finished assets."
      />

      <ol class={css({ listStyle: "none", display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", sm: "repeat(2, 1fr)", lg: "repeat(5, 1fr)" }, gap: { base: 6, lg: 0 }, mt: 14, position: "relative" })}>
        {STEPS.map((s, i) => (
          <li key={s.n} data-reveal data-reveal-delay={String(i * 110)} class={css({ position: "relative", pr: { lg: 6 }, display: "flex", flexDirection: "column", gap: 3 })}>
            <div class={css({ display: "flex", alignItems: "center", gap: 3 })}>
              <span
                class={css({ display: "grid", placeItems: "center", w: "36px", h: "36px", rounded: "full", border: "1.5px solid token(colors.ink)", fontFamily: "mono", fontSize: "12px", bg: "card", flexShrink: 0 })}
                style={i === 2 ? { background: "#1C1B19", color: "#F1ECE2" } : undefined}
              >
                {s.n}
              </span>
              {i < STEPS.length - 1 && <span class={`stitch-rule ${css({ flex: 1, display: { base: "none", lg: "block" } })}`} aria-hidden="true" />}
            </div>
            <h3 class="display" style={{ fontSize: "28px" }}>{s.t}</h3>
            <p class={css({ fontSize: "14px", color: "ink-soft", lineHeight: 1.55 })}>{s.d}</p>
          </li>
        ))}
      </ol>

      <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "1.15fr 0.85fr" }, gap: { base: 10, lg: 14 }, mt: 20 })}>
        <div data-reveal="sheet" class={css({ bg: "card", border: "1px solid token(colors.rule)", rounded: "sm", p: { base: 5, md: 7 }, boxShadow: "sheet" })}>
          <div class={css({ display: "flex", flexDirection: "column", gap: 1, mb: 5 })}>
            <span class="label" style={{ color: "#A9311E" }}>Step 03 · the archive</span>
            <h3 class="display" style={{ fontSize: "28px" }}>Many fittings, not one answer.</h3>
          </div>
          <QDArchive />
        </div>

        <div class={css({ display: "flex", flexDirection: "column", gap: 5 })}>
          <div class={css({ display: "flex", flexDirection: "column", gap: 1 })}>
            <span class="label" style={{ color: "#A9311E" }}>Step 04 · the judge</span>
            <h3 class="display" style={{ fontSize: "28px" }}>Scored for fit before finish.</h3>
          </div>
          <div class={css({ display: "flex", h: "14px", rounded: "xs", overflow: "hidden" })} role="img" aria-label="Judge weights: persona alignment 30%, visual quality 20%, uniqueness 20%, coherence 15%, usability 15%">
            {JUDGE.map((j) => (
              <span key={j.k} style={{ width: `${j.w}%`, background: j.c }} />
            ))}
          </div>
          <ul class={css({ listStyle: "none", display: "flex", flexDirection: "column" })}>
            {JUDGE.map((j) => (
              <li key={j.k} class={css({ display: "grid", gridTemplateColumns: "14px 1fr auto", gap: 3, alignItems: "baseline", py: 3, borderBottom: "1px solid token(colors.rule)" })}>
                <i class={css({ w: "10px", h: "10px", rounded: "xs" })} style={{ background: j.c }} />
                <span>
                  <span class={css({ fontWeight: 600 })}>{j.k}</span>
                  <span class={css({ display: "block", fontSize: "13px", color: "ink-muted" })}>{j.q}</span>
                </span>
                <span class={css({ fontFamily: "mono", fontSize: "14px" })}>{j.w}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
});
