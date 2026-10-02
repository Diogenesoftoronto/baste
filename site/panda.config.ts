import { defineConfig } from "@pandacss/dev";

/**
 * Baste house style — "the atelier".
 *
 * Baste (v.): to tack fabric together with long, loose stitches so a garment
 * can be fitted before the final cut. The house style is a tailor's cutting
 * room: pattern paper, ink, basting thread and tailor's chalk. It is kept
 * deliberately quiet so each persona's own palette reads clearly against it.
 */
export default defineConfig({
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  jsxFramework: "qwik",
  theme: {
    extend: {
      tokens: {
        colors: {
          // Grounds
          paper: { value: "#F1ECE2" },        // pattern paper
          "paper-deep": { value: "#E7E0D2" }, // paper in shadow / wells
          card: { value: "#FBF9F4" },         // fresh sheet
          muslin: { value: "#E9DFCB" },       // toile fabric
          "muslin-deep": { value: "#D9CCB2" },
          // Ink
          ink: { value: "#1C1B19" },
          "ink-soft": { value: "#45423C" },
          "ink-muted": { value: "#6E6A61" },  // ≥ 4.5:1 on paper
          rule: { value: "#CFC7B8" },         // hairlines
          "rule-strong": { value: "#A79E8D" },
          // Thread + chalk
          thread: { value: "#D2402A" },       // basting thread (decorative / large)
          "thread-ink": { value: "#A9311E" }, // thread as text (≥ 4.5:1)
          chalk: { value: "#2F55A4" },        // tailor's chalk: annotation
          "chalk-soft": { value: "#C9D4EC" },
          tape: { value: "#F0C534" },         // tape-measure yellow
          pin: { value: "#2E7D5B" },
          // Night (terminal / inverse panels)
          night: { value: "#191814" },
          "night-raised": { value: "#24221D" },
          "night-text": { value: "#EDE7DA" },
          "night-muted": { value: "#A8A193" },
        },
        fonts: {
          display: { value: "'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif" },
          body: { value: "'Instrument Sans', 'Helvetica Neue', system-ui, sans-serif" },
          mono: { value: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace" },
        },
        radii: {
          xs: { value: "2px" },
          sm: { value: "4px" },
          base: { value: "6px" },
          lg: { value: "10px" },
          xl: { value: "16px" },
        },
        shadows: {
          // Paper lifting off the cutting table — soft, warm, directional
          sheet: { value: "0 1px 0 rgba(28,27,25,0.06), 0 8px 24px -12px rgba(60,45,20,0.28)" },
          lift: { value: "0 1px 0 rgba(28,27,25,0.06), 0 18px 40px -16px rgba(60,45,20,0.38)" },
          pressed: { value: "inset 0 1px 2px rgba(28,27,25,0.18)" },
        },
        easings: {
          // A needle pulling thread taut: quick start, gentle settle
          thread: { value: "cubic-bezier(0.22, 1, 0.36, 1)" },
          snip: { value: "cubic-bezier(0.65, 0, 0.35, 1)" },
        },
      },
      keyframes: {
        sew: {
          from: { strokeDashoffset: "var(--sew-length, 600)" },
          to: { strokeDashoffset: "0" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(210,64,42,0.45)" },
          "50%": { boxShadow: "0 0 0 6px rgba(210,64,42,0)" },
        },
        "shake-hold": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-0.6px) rotate(-0.4deg)" },
          "75%": { transform: "translateX(0.6px) rotate(0.4deg)" },
        },
        "tag-timer": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
    },
  },
});
