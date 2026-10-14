import { useLocale } from "~/i18n/provider";
import { text, personaText } from "~/i18n/runtime";
import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import type { AestheticProfile, Persona } from "~/lib/api-types";
import { AESTHETIC_AXES } from "~/lib/fitting";

/** One aesthetic axis drawn as a tape-measure with the chosen value pinned. */
export const AxisTape = component$<{ label: string; options: string[]; value: string; compact?: boolean }>(
  ({ label, options, value, compact }) => {
  const locale = useLocale();
    const idx = Math.max(0, options.indexOf(value));
    const pos = options.length > 1 ? (idx / (options.length - 1)) * 100 : 50;
    return (
      <div class={css({ display: "grid", alignItems: "center", gap: 3 })} style={{ gridTemplateColumns: compact ? "96px 1fr" : "128px 1fr" }}>
        <span class={css({ fontSize: "12px", color: "ink-muted" })}>{text(locale.value, label)}</span>
        <div class={css({ position: "relative", h: "30px" })} role="img" aria-label={`${text(locale.value, label)}: ${text(locale.value, value)}`}>
          {/* tape */}
          <div
            class={css({ position: "absolute", left: 0, right: 0, top: "6px", h: "10px", rounded: "xs", bg: "tape" })}
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(28,27,25,0.55) 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, rgba(28,27,25,0.8) 0 1px, transparent 1px 30px)",
              backgroundSize: "auto 4px, auto 7px",
              backgroundRepeat: "repeat-x",
              backgroundPosition: "0 0, 0 0",
            }}
          />
          {/* pin */}
          <span
            aria-hidden="true"
            class={css({ position: "absolute", top: "0", w: "2px", h: "22px", bg: "thread", transform: "translateX(-1px)", transition: "left 0.6s token(easings.thread)" })}
            style={{ left: `${pos}%` }}
          >
            <i class={css({ position: "absolute", top: "-4px", left: "-3px", w: "8px", h: "8px", rounded: "full", bg: "thread" })} />
          </span>
          <span
            class={css({ position: "absolute", top: "17px", fontFamily: "mono", fontSize: "11px", color: "ink", whiteSpace: "nowrap", transition: "left 0.6s token(easings.thread)" })}
            style={{ left: `${pos}%`, transform: pos > 70 ? "translateX(-100%)" : pos > 30 ? "translateX(-50%)" : "none" }}
          >
            {text(locale.value, value)}
          </span>
        </div>
      </div>
    );
  },
);

/** A tailor's order slip: cultural measurements on the left, the cut on the right. */
export const MeasurementSheet = component$<{ persona: Persona; number?: string }>(({ persona, number = "001" }) => {
  const locale = useLocale();
  const inf = persona.influences;
  const rows: Array<[string, string[]]> = [
    ["Films & anime", [...(inf.films ?? []), ...(inf.anime ?? [])].slice(0, 4)],
    ["Music", [...(inf.music?.genres ?? []).slice(0, 2), ...(inf.music?.artists ?? []).slice(0, 2)]],
    ["Spaces", (inf.spaces ?? []).slice(0, 3)],
    ["Tools", (inf.tools ?? []).slice(0, 4)],
    ["Obsessions", (inf.obsessions ?? []).slice(0, 2)],
    ["Can't stand", (persona.behaviors?.petPeeves ?? []).slice(0, 3)],
  ];
  return (
    <article
      aria-label={text(locale.value, "Measurement sheet for {name}", { name: personaText(locale.value, persona, persona.name) })}
      class={css({ bg: "card", border: "1px solid token(colors.rule)", rounded: "sm", boxShadow: "lift", overflow: "hidden" })}
    >
      <header class={css({ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4, px: { base: 5, md: 7 }, pt: 6, pb: 4 })}>
        <div>
          <span class="label" style={{ color: "#6E6A61" }}>{text(locale.value, "Measurement sheet · No.")} {number}</span>
          <h3 class="display" style={{ fontSize: "30px", marginTop: "6px" }}>{personaText(locale.value, persona, persona.name)}</h3>
        </div>
        <span class={css({ fontFamily: "mono", fontSize: "11px", color: "ink-muted", textAlign: "right", display: { base: "none", sm: "block" } })}>
          {personaText(locale.value, persona, persona.culture?.region ?? "")}
          <br />
          {(persona.culture?.subcultures ?? []).slice(0, 2).join(" · ")}
        </span>
      </header>
      <div class="stitch-rule" aria-hidden="true" />
      <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" } })}>
        <dl class={css({ px: { base: 5, md: 7 }, py: 5, display: "flex", flexDirection: "column" })}>
          {rows.map(([k, v]) => (
            <div key={k} class={css({ display: "grid", gridTemplateColumns: "104px 1fr", gap: 3, py: "9px", borderBottom: "1px solid token(colors.rule)", _last: { borderBottom: 0 } })}>
              <dt class={css({ fontFamily: "mono", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "ink-muted", pt: "2px" })}>{text(locale.value, k)}</dt>
              <dd class={css({ fontSize: "14px", color: "ink", lineHeight: 1.45 })}>{v.map(value => personaText(locale.value, persona, value)).join(", ")}</dd>
            </div>
          ))}
        </dl>
        <div class={css({ px: { base: 5, md: 7 }, py: 5, bg: "paper", borderLeft: { md: "1px solid token(colors.rule)" }, borderTop: { base: "1px solid token(colors.rule)", md: 0 }, display: "flex", flexDirection: "column", gap: 2 })}>
          <span class="label" style={{ color: "#2F55A4", marginBottom: "6px" }}>{text(locale.value, "The cut — aesthetic profile")}</span>
          {AESTHETIC_AXES.map((ax) => (
            <AxisTape key={ax.key} label={ax.label} options={ax.options} value={String(persona.aesthetic[ax.key as keyof AestheticProfile])} compact />
          ))}
        </div>
      </div>
    </article>
  );
});
