import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  jsxFramework: "qwik",
  theme: {
    extend: {
      tokens: {
        colors: {
          // Core surfaces — deep ink with a violet undertone
          bg: { value: "#0A0A12" },
          surface: { value: "#15101F" },
          "surface-hover": { value: "#1F1830" },
          text: { value: "#F5F5F2" },
          "text-muted": { value: "#9A8FB5" },
          border: { value: "#2A1F45" },

          // BASTE brand kit
          "acid-lime": { value: "#C6FF00" },
          "toxic-green": { value: "#7BFF36" },
          "radioactive": { value: "#00E676" },
          "melt-orange": { value: "#FF9B21" },
          "electric-purple": { value: "#8A00FF" },
          "neon-fuchsia": { value: "#FF00B8" },
          "cyan-burst": { value: "#00F0FF" },
          "ink-black": { value: "#0A0A0A" },
          "off-white": { value: "#F5F5F2" },

          // Aliases used by older code
          accent: { value: "#C6FF00" },
          "accent-hover": { value: "#7BFF36" },
          danger: { value: "#FF00B8" },
          success: { value: "#00E676" },
          orange: {
            400: { value: "#FFB347" },
            500: { value: "#FF9B21" },
            600: { value: "#EA7800" },
          },
          amber: {
            400: { value: "#FBBF24" },
            500: { value: "#F59E0B" },
            600: { value: "#D97706" },
          },
        },
        fonts: {
          heading: { value: "'Bowlby One', 'Space Grotesk', system-ui, sans-serif" },
          body: { value: "'Inter', system-ui, sans-serif" },
          mono: { value: "'JetBrains Mono', monospace" },
          graffiti: { value: "'Bowlby One', 'Space Grotesk', sans-serif" },
        },
        radii: {
          sm: { value: "4px" },
          base: { value: "8px" },
          lg: { value: "12px" },
          xl: { value: "18px" },
          "2xl": { value: "28px" },
        },
        shadows: {
          glow: { value: "0 0 24px rgba(198,255,0,0.45), 0 0 48px rgba(138,0,255,0.35)" },
          neon: { value: "0 0 12px rgba(255,0,184,0.65)" },
          drip: { value: "4px 6px 0 rgba(10,10,10,0.95)" },
        },
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", filter: "drop-shadow(0 0 8px rgba(198,255,0,0.6))" },
          "50%": { opacity: "1", filter: "drop-shadow(0 0 24px rgba(198,255,0,0.95))" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(-1deg)" },
          "50%": { transform: "translateY(-8px) rotate(1deg)" },
        },
        drip: {
          "0%": { transform: "translateY(-6px) scaleY(0.6)", opacity: "0" },
          "60%": { transform: "translateY(0) scaleY(1)", opacity: "1" },
          "100%": { transform: "translateY(4px) scaleY(0.85)", opacity: "0.85" },
        },
        "shake-tiny": {
          "0%, 100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(1deg)" },
        },
      },
    },
  },
});
