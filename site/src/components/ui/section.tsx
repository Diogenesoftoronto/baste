import { component$, Slot } from "@builder.io/qwik";
import { css } from "styled-system/css";

interface SectionProps {
  id?: string;
  tone?: "paper" | "deep" | "night";
  /** Draw a basting stitch across the top edge. */
  stitched?: boolean;
}

const TONE_BG: Record<NonNullable<SectionProps["tone"]>, string> = {
  paper: "transparent",
  deep: "#E7E0D2",
  night: "#191814",
};

export const Section = component$<SectionProps>(({ id, tone = "paper", stitched = true }) => {
  return (
    <section
      id={id}
      class={css({ position: "relative", scrollMarginTop: "60px" })}
      style={{ background: TONE_BG[tone], color: tone === "night" ? "#EDE7DA" : undefined }}
    >
      {stitched && <div class="stitch-rule" aria-hidden="true" />}
      <div class={css({ maxW: "1240px", mx: "auto", px: { base: 4, md: 8 }, py: { base: 16, md: 24 } })}>
        <Slot />
      </div>
    </section>
  );
});

interface SectionHeadProps {
  kicker: string;
  title: string;
  lede?: string;
  tone?: "paper" | "night";
  center?: boolean;
}

export const SectionHead = component$<SectionHeadProps>(({ kicker, title, lede, tone = "paper", center }) => {
  const night = tone === "night";
  return (
    <div
      class={css({ display: "flex", flexDirection: "column", gap: 4, maxW: "640px" })}
      style={center ? { marginInline: "auto", textAlign: "center", alignItems: "center" } : undefined}
    >
      <span class="label" style={{ color: night ? "#F0C534" : "#A9311E" }}>{kicker}</span>
      <h2 class="display" style={{ fontSize: "clamp(36px, 4.6vw, 60px)", textWrap: "balance" }}>{title}</h2>
      {lede && (
        <p class={css({ fontSize: { base: "16px", md: "18px" }, lineHeight: 1.6 })} style={{ color: night ? "#A8A193" : "#45423C" }}>
          {lede}
        </p>
      )}
      <Slot />
    </div>
  );
});
