import { component$, useContext, useSignal } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx } from "../context";
import { kicker, panel, panelTitle } from "../ui";
import { Garment } from "~/components/fitting/garment";
import { AxisTape } from "~/components/fitting/measurement-sheet";
import { AESTHETIC_AXES, contrastRatio, onColor, paletteSwatches } from "~/lib/fitting";
import { primaryFamily } from "~/lib/fonts";
import type { AestheticProfile } from "~/lib/api-types";

/** The persona wearing its own design, with every measurement on show. */
export const FittingTab = component$(() => {
  const s = useContext(StudioCtx);
  const frame = useSignal<"desktop" | "mobile">("desktop");
  const persona = s.personas.find((p) => p.id === s.selectedId)!;
  const t = s.tokens[persona.id];

  if (!t) {
    return <div aria-busy="true" class={css({ h: "420px", rounded: "lg", bg: "paper-deep", opacity: 0.5 })} />;
  }

  const c = t.colors;
  const pairs: Array<[string, string, string]> = [
    ["Text on ground", c.text, c.background],
    ["Muted on ground", c.textMuted, c.background],
    ["Text on surface", c.text, c.surface],
    ["Label on primary", onColor(c.primary), c.primary],
  ];
  const inf = persona.influences;
  const sources: Array<[string, string[] | undefined]> = [
    ["Films", inf.films],
    ["Anime", inf.anime],
    ["Music", [...(inf.music?.genres ?? []), ...(inf.music?.artists ?? [])]],
    ["Games", inf.games],
    ["Artists", inf.visualArtists],
    ["Spaces", inf.spaces],
    ["Tools", inf.tools],
    ["Obsessions", inf.obsessions],
  ];

  return (
    <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "minmax(0, 1.35fr) minmax(320px, 0.65fr)" }, gap: 6, alignItems: "start" })}>
      <div class={css({ display: "flex", flexDirection: "column", gap: 6, minW: 0 })}>
        {/* Live preview */}
        <section class={panel} aria-labelledby="fit-preview">
          <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 3, mb: 4, flexWrap: "wrap" })}>
            <div>
              <span class={kicker}>Try-on</span>
              <h2 id="fit-preview" class={panelTitle}>The garment, cut from {persona.name.replace(/^The /, "")}'s tokens</h2>
            </div>
            <div role="radiogroup" aria-label="Preview size" class={css({ display: "flex", p: "3px", rounded: "base", bg: "paper-deep" })}>
              {(["desktop", "mobile"] as const).map((f) => (
                <button
                  key={f}
                  role="radio"
                  aria-checked={frame.value === f}
                  onClick$={() => (frame.value = f)}
                  class={css({ h: "28px", px: 3, rounded: "sm", fontSize: "13px", border: 0, bg: "transparent", color: "ink-muted", "&[aria-checked=true]": { bg: "card", color: "ink", boxShadow: "sheet" } })}
                >
                  {f === "desktop" ? "Wide" : "Narrow"}
                </button>
              ))}
            </div>
          </div>
          <div class={css({ display: "flex", justifyContent: "center", p: { base: 2, md: 6 }, rounded: "base", bg: "paper-deep" })}>
            <div class={css({ w: "100%", transition: "max-width 0.6s token(easings.thread)" })} style={{ maxWidth: frame.value === "mobile" ? "380px" : "100%" }}>
              <Garment persona={persona} tokens={t} size={frame.value === "mobile" ? "compact" : "full"} />
            </div>
          </div>
        </section>

        {/* Palette */}
        <section class={panel} aria-labelledby="fit-palette">
          <span class={kicker}>Cloth</span>
          <h2 id="fit-palette" class={panelTitle}>Palette</h2>
          <ul class={css({ listStyle: "none", display: "grid", gridTemplateColumns: { base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }, gap: 3, mt: 4 })}>
            {paletteSwatches(t).map((sw) => (
              <li key={sw.role} class={css({ display: "flex", flexDirection: "column", gap: 2 })}>
                <button
                  type="button"
                  title={`Copy ${sw.hex}`}
                  onClick$={() => navigator.clipboard?.writeText(sw.hex)}
                  class={css({ h: "64px", rounded: "base", border: "1px solid rgba(28,27,25,0.12)", display: "flex", alignItems: "flex-end", p: 2, fontFamily: "mono", fontSize: "11px" })}
                  style={{ background: sw.hex, color: onColor(sw.hex) }}
                >
                  {sw.hex.toUpperCase()}
                </button>
                <span class={css({ fontSize: "12.5px", color: "ink-muted" })}>{sw.role}</span>
              </li>
            ))}
          </ul>
          <h3 class={css({ fontSize: "13px", fontWeight: 600, mt: 6, mb: 2 })}>Contrast check</h3>
          <ul class={css({ listStyle: "none", display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", sm: "1fr 1fr" }, gap: 2 })}>
            {pairs.map(([label, fg, bg]) => {
              const r = contrastRatio(fg, bg);
              const grade = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large" : "Fail";
              return (
                <li key={label} class={css({ display: "flex", alignItems: "center", gap: 3, p: 2, rounded: "base", border: "1px solid token(colors.rule)" })}>
                  <span class={css({ w: "38px", h: "30px", rounded: "sm", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0 })} style={{ background: bg, color: fg }}>
                    Aa
                  </span>
                  <span class={css({ flex: 1, fontSize: "13px" })}>{label}</span>
                  <span class={css({ fontFamily: "mono", fontSize: "12px" })}>{r.toFixed(1)}:1</span>
                  <span
                    class={css({ fontFamily: "mono", fontSize: "10.5px", px: 2, py: "2px", rounded: "full" })}
                    style={{ background: grade === "Fail" ? "#F6D9D3" : "#DCEBDF", color: grade === "Fail" ? "#8E2615" : "#215A41" }}
                  >
                    {grade}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Type */}
        <section class={panel} aria-labelledby="fit-type">
          <span class={kicker}>Hand</span>
          <h2 id="fit-type" class={panelTitle}>Typography</h2>
          <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1.2fr 1fr 0.8fr" }, gap: 5, mt: 4 })}>
            {([
              ["Display", t.typography.fontFamily.heading, "Aa", "48px"],
              ["Text", t.typography.fontFamily.body, "Aa", "40px"],
              ["Mono", t.typography.fontFamily.mono, "{ }", "34px"],
            ] as const).map(([role, stack, glyph, size]) => (
              <div key={role} class={css({ display: "flex", flexDirection: "column", gap: 1, p: 4, rounded: "base", bg: "paper" })}>
                <span class={css({ fontSize: "12px", color: "ink-muted" })}>{role}</span>
                <span style={{ fontFamily: stack, fontSize: size, lineHeight: 1.1 }}>{glyph}</span>
                <span style={{ fontFamily: stack, fontSize: "15px" }}>{primaryFamily(stack)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside class={css({ display: "flex", flexDirection: "column", gap: 6 })}>
        <section class={panel} aria-labelledby="fit-cut">
          <span class={kicker}>The cut</span>
          <h2 id="fit-cut" class={panelTitle}>Aesthetic profile</h2>
          <div class={css({ display: "flex", flexDirection: "column", gap: 2, mt: 4 })}>
            {AESTHETIC_AXES.map((ax) => (
              <AxisTape key={ax.key} label={ax.label} options={ax.options} value={String(persona.aesthetic[ax.key as keyof AestheticProfile])} compact />
            ))}
          </div>
          <div class={css({ display: "flex", flexWrap: "wrap", gap: "6px", mt: 4 })}>
            {persona.aesthetic.moodKeywords.map((k) => (
              <span key={k} class={css({ fontSize: "12.5px", fontStyle: "italic", color: "chalk" })}>#{k.replace(/\s+/g, "-")}</span>
            ))}
          </div>
        </section>

        <section class={panel} aria-labelledby="fit-sources">
          <span class={kicker}>Measurements</span>
          <h2 id="fit-sources" class={panelTitle}>Influences</h2>
          <dl class={css({ mt: 3 })}>
            {sources
              .filter(([, v]) => v && v.length)
              .map(([k, v]) => (
                <div key={k} class={css({ display: "grid", gridTemplateColumns: "84px 1fr", gap: 3, py: 2, borderBottom: "1px solid token(colors.rule)", _last: { borderBottom: 0 } })}>
                  <dt class={css({ fontFamily: "mono", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "ink-muted", pt: "2px" })}>{k}</dt>
                  <dd class={css({ fontSize: "13.5px" })}>{v!.join(", ")}</dd>
                </div>
              ))}
          </dl>
          {persona.behaviors?.petPeeves?.length ? (
            <div class={css({ mt: 4, p: 3, rounded: "base", bg: "rgba(210,64,42,0.07)", border: "1px dashed token(colors.thread)" })}>
              <span class={css({ fontSize: "12px", fontWeight: 600, color: "thread-ink" })}>Won't wear</span>
              <ul class={css({ listStyle: "none", fontSize: "13px", mt: 1, display: "flex", flexDirection: "column", gap: 1 })}>
                {persona.behaviors.petPeeves.map((p) => (
                  <li key={p}>— {p}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
});
