import { component$ } from "@builder.io/qwik";

interface BasteLogoProps {
  size?: number;
  withWord?: boolean;
}

/**
 * Drippy graffiti "B" mark — pure SVG, no external assets.
 * Renders as a circular slime badge with an orange B and lime drips.
 */
export const BasteLogo = component$<BasteLogoProps>(({ size = 44, withWord = false }) => {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Baste"
      >
        <defs>
          <radialGradient id="slime" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#C6FF00" />
            <stop offset="55%" stop-color="#7BFF36" />
            <stop offset="100%" stop-color="#8A00FF" />
          </radialGradient>
          <linearGradient id="bgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFB347" />
            <stop offset="100%" stop-color="#EA7800" />
          </linearGradient>
        </defs>
        {/* outer ring */}
        <circle cx="50" cy="50" r="46" fill="#0A0A0A" />
        <circle cx="50" cy="50" r="42" fill="url(#slime)" />
        {/* drips */}
        <path d="M14 60 Q 16 78 22 82 Q 26 86 28 78 Q 30 70 26 64" fill="#7BFF36" />
        <path d="M70 70 Q 74 88 80 90 Q 86 92 86 82 Q 86 74 80 70" fill="#C6FF00" />
        <path d="M40 84 Q 42 96 48 96 Q 54 96 54 88" fill="#8A00FF" />
        {/* bubbles */}
        <circle cx="22" cy="38" r="3" fill="#00F0FF" />
        <circle cx="78" cy="34" r="2.5" fill="#FF00B8" />
        <circle cx="82" cy="56" r="2" fill="#C6FF00" />
        {/* big B */}
        <text
          x="50"
          y="68"
          text-anchor="middle"
          font-family="'Bowlby One', 'Space Grotesk', sans-serif"
          font-size="58"
          font-weight="900"
          fill="url(#bgrad)"
          stroke="#0A0A0A"
          stroke-width="3"
          style={{ paintOrder: "stroke fill" }}
        >
          B
        </text>
      </svg>
      {withWord && (
        <span
          class="baste-graffiti baste-drip-text"
          style={{
            fontSize: `${Math.round(size * 0.7)}px`,
            lineHeight: 1,
            WebkitTextStroke: "2px #0A0A0A",
          }}
        >
          BASTE
        </span>
      )}
    </span>
  );
});
