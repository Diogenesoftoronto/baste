import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";

interface BasteLogoProps {
  size?: number;
  withWord?: boolean;
  /** Colour of the word + needle. Thread stays red. */
  tone?: "ink" | "paper";
}

/**
 * The mark: a tailor's needle trailing a basting stitch. The stitch is the
 * product — loose, provisional, fitted to one person before the final cut.
 */
export const BasteMark = component$<{ size?: number; tone?: "ink" | "paper" }>(
  ({ size = 28, tone = "ink" }) => {
    const ink = tone === "ink" ? "#1C1B19" : "#F1ECE2";
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        {/* needle */}
        <path d="M6 26 L25.5 6.5" stroke={ink} stroke-width="2.2" stroke-linecap="round" />
        <ellipse cx="24" cy="8" rx="1.1" ry="2.6" transform="rotate(45 24 8)" fill={tone === "ink" ? "#F1ECE2" : "#1C1B19"} stroke={ink} stroke-width="1.2" />
        {/* thread through the eye, trailing as basting stitches */}
        <path
          d="M24.4 7.6 C 29 12, 25 18, 18 19 S 7 22, 5 29"
          stroke="#D2402A"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="3.4 2.6"
        />
      </svg>
    );
  },
);

export const BasteLogo = component$<BasteLogoProps>(({ size = 28, withWord = true, tone = "ink" }) => {
  return (
    <span class={css({ display: "inline-flex", alignItems: "center", gap: "10px" })}>
      <BasteMark size={size} tone={tone} />
      {withWord && (
        <span
          class={css({
            fontFamily: "display",
            fontStyle: "italic",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          })}
          style={{ fontSize: `${Math.round(size * 0.86)}px`, color: tone === "ink" ? "#1C1B19" : "#F1ECE2" }}
        >
          Baste
        </span>
      )}
    </span>
  );
});
