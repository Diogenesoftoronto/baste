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
          bg: { value: "#0A0A0F" },
          surface: { value: "#14141F" },
          "surface-hover": { value: "#1E1E2E" },
          text: { value: "#E8E8F0" },
          "text-muted": { value: "#8A8FA8" },
          border: { value: "#2A2A3D" },
          accent: { value: "#7B68EE" },
          "accent-hover": { value: "#9B8AF5" },
          danger: { value: "#E74C3C" },
          success: { value: "#2ECC71" },
          orange: {
            400: { value: "#FB923C" },
            500: { value: "#F97316" },
            600: { value: "#EA580C" },
          },
          amber: {
            400: { value: "#FBBF24" },
            500: { value: "#F59E0B" },
            600: { value: "#D97706" },
          },
        },
        fonts: {
          heading: { value: "'Space Grotesk', system-ui, sans-serif" },
          body: { value: "'Inter', system-ui, sans-serif" },
          mono: { value: "'JetBrains Mono', monospace" },
        },
        radii: {
          sm: { value: "4px" },
          base: { value: "8px" },
          lg: { value: "12px" },
          xl: { value: "16px" },
          "2xl": { value: "24px" },
        },
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
});
