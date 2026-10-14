import { useLocale } from "~/i18n/provider";
import { text, personaText } from "~/i18n/runtime";
import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import type { DesignTokens, PersonaRecord } from "~/lib/api-types";
import { fittingVars, onColor } from "~/lib/fitting";
import { primaryFamily } from "~/lib/fonts";

/**
 * A persona's swing tag, printed in its own design system: its ground, its
 * type, its radius, its palette.
 */
export const PersonaCard = component$<{ persona: PersonaRecord; tokens: DesignTokens; href?: string }>(
  ({ persona, tokens, href }) => {
  const locale = useLocale();
    const c = tokens.colors;
    const heading = primaryFamily(tokens.typography.fontFamily.heading);
    const body = primaryFamily(tokens.typography.fontFamily.body);
    return (
      <a
        href={href ?? `/gui?persona=${persona.id}`}
        aria-label={text(locale.value, "{name} — open in Studio", { name: personaText(locale.value, persona, persona.name) })}
        class={`fitting ${css({
          display: "flex",
          flexDirection: "column",
          h: "100%",
          textDecoration: "none",
          overflow: "hidden",
          boxShadow: "sheet",
          transition: "transform 0.4s token(easings.thread), box-shadow 0.4s token(easings.thread)",
          _hover: { transform: "translateY(-4px) rotate(-0.3deg)", boxShadow: "lift" },
        })}`}
        data-texture={persona.aesthetic.textureStyle}
        style={{ ...fittingVars(tokens), borderRadius: "var(--f-radius-lg)", border: "1px solid var(--f-border)" }}
      >
        {/* palette band */}
        <div class={css({ display: "flex", h: "56px" })} aria-hidden="true">
          {[c.primary, c.secondary, c.accent, c.warm, c.cool].map((hex, i) => (
            <span key={i} style={{ flex: i === 0 ? 2.2 : 1, background: hex }} />
          ))}
        </div>

        <div class={css({ display: "flex", flexDirection: "column", gap: 3, p: "22px", flex: 1 })}>
          <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 })}>
            <span class="f-mono" style={{ fontSize: "11px", color: "var(--f-muted)" }}>{persona.id}</span>
            <span
              class="f-mono"
              style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: "var(--f-radius)", background: c.primary, color: onColor(c.primary) }}
            >
              {text(locale.value, persona._source === "custom" ? "Custom" : "Base")}
            </span>
          </div>
          <h3 class="f-heading" style={{ fontSize: "30px", lineHeight: 1.04, fontWeight: 700, textWrap: "balance" }}>
            {personaText(locale.value, persona, persona.name.replace(/^The /, ""))}
          </h3>
          <p style={{ fontSize: "14px", lineHeight: 1.55, color: "var(--f-muted)" }}>{personaText(locale.value, persona, persona.summary)}</p>

          <div class={css({ display: "flex", gap: "6px", flexWrap: "wrap" })}>
            {persona.aesthetic.visualKeywords.slice(0, 3).map((k) => (
              <span key={k} class="f-chip">{personaText(locale.value, persona, k)}</span>
            ))}
          </div>

          <dl
            class={css({ mt: "auto", pt: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, fontSize: "12px" })}
            style={{ borderTop: "1px var(--f-border-style) var(--f-border)" }}
          >
            <div>
              <dt style={{ color: "var(--f-muted)" }}>{text(locale.value, "Display")}</dt>
              <dd class="f-heading" style={{ fontSize: "15px", fontWeight: 600 }}>{heading}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--f-muted)" }}>{text(locale.value, "Text")}</dt>
              <dd style={{ fontSize: "15px" }}>{body}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--f-muted)" }}>{text(locale.value, "Edges")}</dt>
              <dd class="f-mono">{text(locale.value, persona.aesthetic.edgeStyle)} · {tokens.borders.radius.base}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--f-muted)" }}>{text(locale.value, "Motion")}</dt>
              <dd class="f-mono">{text(locale.value, persona.aesthetic.motionStyle)} · {tokens.motion.duration.base}</dd>
            </div>
          </dl>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--f-text)", marginTop: "6px" }}>
            {text(locale.value, "Open in Studio →")}
          </span>
        </div>
      </a>
    );
  },
);
