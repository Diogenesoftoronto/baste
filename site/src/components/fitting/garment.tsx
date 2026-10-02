import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import type { DesignTokens, Persona } from "~/lib/api-types";
import { fittingVars } from "~/lib/fitting";

interface GarmentProps {
  persona: Persona;
  tokens: DesignTokens;
  /** "full" is the hero-size screen; "compact" drops the second column. */
  size?: "full" | "compact";
  class?: string;
}

const cap = (s: string | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

/** Stable small number from a string, for believable counts. */
function seeded(s: string, mod: number, min = 1): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return min + (Math.abs(h) % mod);
}

/**
 * A believable app screen, cut from the persona's own material (obsessions,
 * spaces, music, keywords) and dressed entirely in its generated tokens.
 * Same pattern for every persona — only the fitting changes.
 */
export const Garment = component$<GarmentProps>(({ persona, tokens, size = "full", class: cls }) => {
  const inf = persona.influences;
  const spaces = (inf?.spaces ?? []).slice(0, 3);
  const keywords = (persona.aesthetic?.visualKeywords ?? []).slice(0, 4);
  const heading = cap(inf?.obsessions?.[0] ?? persona.name);
  const eyebrow = persona.culture?.region || cap(persona.aesthetic?.moodKeywords?.[0]) || "Collection";
  const artist = inf?.music?.artists?.[0] ?? "—";
  const genre = inf?.music?.genres?.[0] ?? "";
  const compact = size === "compact";

  return (
    <div
      class={`fitting ${cls ?? ""}`}
      data-texture={tokens.colors && persona.aesthetic?.textureStyle}
      style={{ ...fittingVars(tokens), borderRadius: "var(--f-radius-lg)", overflow: "hidden" }}
    >
      {/* window chrome */}
      <div
        class={css({ display: "flex", alignItems: "center", gap: 2, px: "var(--f-pad)", py: "10px", fontSize: "12px" })}
        style={{ borderBottom: "1px var(--f-border-style) var(--f-border)", color: "var(--f-muted)" }}
      >
        <span class={css({ display: "flex", gap: "5px" })} aria-hidden="true">
          <i class={dot} style={{ background: "var(--f-primary)" }} />
          <i class={dot} style={{ background: "var(--f-secondary)" }} />
          <i class={dot} style={{ background: "var(--f-accent)" }} />
        </span>
        <span class={`f-mono ${css({ minW: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}`} style={{ marginLeft: "8px" }}>
          {persona.id}.app / collections
        </span>
        <span class={css({ ml: "auto", display: { base: "none", sm: "flex" }, gap: 4 })}>
          <span>Library</span>
          <span style={{ color: "var(--f-text)", fontWeight: 600 }}>Collections</span>
          <span>Notes</span>
        </span>
      </div>

      <div
        class={css({ display: "grid", gap: "var(--f-gap)", p: "var(--f-pad)" })}
        style={{ gridTemplateColumns: compact ? "1fr" : undefined }}
      >
        {/* lead */}
        <div class={css({ display: "flex", flexDirection: "column", gap: "calc(var(--f-gap) * 0.6)" })}>
          <span class="f-mono" style={{ fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--f-primary)" }}>
            {eyebrow}
          </span>
          <h3
            class="f-heading"
            style={{
              fontSize: compact ? "24px" : "clamp(26px, 3.2vw, 38px)",
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              textWrap: "balance",
            }}
          >
            {heading}
          </h3>
          {!compact && (
            <p style={{ fontSize: "14px", lineHeight: 1.55, color: "var(--f-muted)", maxWidth: "46ch" }}>
              {persona.summary}
            </p>
          )}
          <div class={css({ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 })}>
            <span class="f-btn" style={{ fontSize: "13px" }}>Start a collection</span>
            <span class="f-btn f-btn--ghost" style={{ fontSize: "13px" }}>Browse</span>
          </div>
        </div>

        {/* cards */}
        <div
          class={css({ display: "grid", gap: "var(--f-gap)" })}
          style={{ gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))" }}
        >
          <div class="f-surface" style={{ padding: "var(--f-pad)" }}>
            <div style={{ fontSize: "12px", color: "var(--f-muted)", marginBottom: "10px" }}>Pinned spaces</div>
            <ul class={css({ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" })}>
              {spaces.map((s, i) => (
                <li key={s} class={css({ display: "flex", alignItems: "center", gap: 2, fontSize: "13px" })}>
                  <i
                    class={css({ w: "8px", h: "8px", flexShrink: 0 })}
                    style={{
                      borderRadius: "var(--f-radius)",
                      background: ["var(--f-primary)", "var(--f-secondary)", "var(--f-accent)"][i],
                    }}
                  />
                  <span class={css({ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>{cap(s)}</span>
                  <span class="f-mono" style={{ color: "var(--f-muted)", fontSize: "12px" }}>{seeded(s, 48, 3)}</span>
                </li>
              ))}
            </ul>
          </div>
          {!compact && (
            <div class="f-surface" style={{ padding: "var(--f-pad)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "12px", color: "var(--f-muted)" }}>Now playing</div>
              <div class="f-heading" style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1.15 }}>{artist}</div>
              <div style={{ fontSize: "12px", color: "var(--f-muted)" }}>{cap(genre)}</div>
              <div
                style={{ height: "4px", borderRadius: "999px", background: "var(--f-border)", marginTop: "auto", overflow: "hidden" }}
              >
                <div style={{ width: `${seeded(artist, 60, 25)}%`, height: "100%", background: "var(--f-primary)" }} />
              </div>
            </div>
          )}
        </div>

        <div class={css({ display: "flex", gap: "6px", flexWrap: "wrap" })}>
          {keywords.map((k) => (
            <span key={k} class="f-chip">{k}</span>
          ))}
        </div>
      </div>
    </div>
  );
});

const dot = css({ display: "block", w: "9px", h: "9px", rounded: "full" });
