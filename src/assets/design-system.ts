/**
 * Design System Exporter
 * 
 * Converts a persona's aesthetic profile into usable design tokens:
 * - CSS custom properties (variables)
 * - Tailwind config extensions
 * - Theme objects for styled-components, emotion, etc.
 * - Color palettes generated from persona keywords
 */

import type { Persona, AestheticProfile } from "../persona/types.js";
import type { BrandKit } from "../decompose/index.js";
import { contrastRatio, parseColor } from "./contrast.js";
import { hueDistance, normalizeHue, oklchToHex, toOklab, toOklch, type Oklch } from "./oklch.js";
import { COLOR_LEXICON, FONT_BASES, FONT_OVERRIDES, culturalCorpus, scoreTriggers } from "./palette-lexicon.js";

/** Built-in font families; externally supplied BrandKit fonts remain caller-owned. */
export const TOKEN_FONT_FAMILIES: string[] = [...new Set([
  ...Object.values(FONT_BASES).flatMap((fonts) => Object.values(fonts)),
  ...FONT_OVERRIDES.map((override) => override.heading),
])];

export interface DesignTokens {
  colors: ColorPalette;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borders: BorderTokens;
  shadows: ShadowTokens;
  motion: MotionTokens;
}

export interface ColorPalette {
  // Generated from persona aesthetic
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  // Temperature-based extras
  warm: string;
  cool: string;
  // Density-based
  density: "minimal" | "dense" | "rich" | "maximalist";
}

export interface TypographyTokens {
  fontFamily: {
    heading: string;
    body: string;
    mono: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
    "4xl": string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface SpacingTokens {
  scale: Record<string, string>;
  density: "minimal" | "dense" | "rich" | "maximalist";
}

export interface BorderTokens {
  radius: {
    none: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    full: string;
  };
  width: {
    thin: string;
    base: string;
    thick: string;
  };
  style: string;
}

export interface ShadowTokens {
  sm: string;
  base: string;
  lg: string;
  xl: string;
  glow: string;
}

export interface MotionTokens {
  duration: {
    fast: string;
    base: string;
    slow: string;
    slower: string;
  };
  easing: {
    default: string;
    smooth: string;
    snappy: string;
    bounce: string;
  };
}

/**
 * Generate design tokens from persona. If a BrandKit is supplied, its
 * extracted palette / fonts override the persona-derived defaults.
 */
export function generateDesignTokens(persona: Persona, brandKit?: BrandKit | null): DesignTokens {
  const aesthetic = persona.aesthetic;

  const baseColors = generateColorPalette(persona);
  const baseTypography = generateTypography(persona);

  return {
    colors: brandKit ? overlayColors(baseColors, brandKit) : baseColors,
    typography: brandKit ? overlayTypography(baseTypography, brandKit) : baseTypography,
    spacing: generateSpacing(aesthetic),
    borders: generateBorders(aesthetic),
    shadows: generateShadows(aesthetic),
    motion: generateMotion(aesthetic),
  };
}

function overlayColors(base: ColorPalette, kit: BrandKit): ColorPalette {
  const r = kit.paletteRoles || {};
  return {
    ...base,
    primary: r.primary ?? base.primary,
    secondary: r.secondary ?? base.secondary,
    accent: r.accent ?? base.accent,
    background: r.background ?? base.background,
    surface: r.surface ?? base.surface,
    text: r.text ?? base.text,
    textMuted: r.textMuted ?? base.textMuted,
    border: r.border ?? base.border,
  };
}

function overlayTypography(base: TypographyTokens, kit: BrandKit): TypographyTokens {
  const fonts = kit.fonts || [];
  if (fonts.length === 0) return base;
  const monoCandidate = fonts.find((f) => /mono|code|courier|fira|jetbrains|consolas|menlo|cascadia/i.test(f));
  const displayCandidate = fonts.find((f) => /grotesk|display|black|condensed|impact|playfair|orbitron/i.test(f)) ?? fonts[0];
  const bodyCandidate =
    fonts.find((f) => f !== displayCandidate && !/mono|code|courier|fira|jetbrains|consolas|menlo|cascadia/i.test(f)) ??
    displayCandidate ??
    fonts[0];

  return {
    ...base,
    fontFamily: {
      heading: `'${displayCandidate}', ${stripQuotedFamily(base.fontFamily.heading)}`,
      body: `'${bodyCandidate}', ${stripQuotedFamily(base.fontFamily.body)}`,
      mono: monoCandidate ? `'${monoCandidate}', ${stripQuotedFamily(base.fontFamily.mono)}` : base.fontFamily.mono,
    },
  };
}

function stripQuotedFamily(stack: string): string {
  return stack.replace(/^['"][^'"]+['"]\s*,\s*/, "");
}

interface ScoredAnchor extends Oklch { score: number }

/** Merge nearest hue neighbours until all cluster centres are at least 20° apart. */
function clusterAnchors(anchors: ScoredAnchor[]): ScoredAnchor[] {
  const clusters = anchors.map((anchor) => ({ ...anchor }));
  while (true) {
    let closest = 20;
    let pair: [number, number] | undefined;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const distance = hueDistance(clusters[i].h, clusters[j].h);
        if (distance < closest) { closest = distance; pair = [i, j]; }
      }
    }
    if (!pair) break;
    const [i, j] = pair;
    const a = toOklab(clusters[i]);
    const b = toOklab(clusters[j]);
    const score = clusters[i].score + clusters[j].score;
    const weight = clusters[i].score / score;
    clusters[i] = {
      ...toOklch({ l: a.l * weight + b.l * (1 - weight), a: a.a * weight + b.a * (1 - weight), b: a.b * weight + b.b * (1 - weight) }),
      score,
    };
    clusters.splice(j, 1);
  }
  return clusters.sort((a, b) => b.score - a.score);
}

function fallbackAnchor(persona: Persona): ScoredAnchor {
  // FNV-1a over UTF-8 gives a stable unsigned 32-bit seed on every Node platform.
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(persona.id + persona.aesthetic.visualKeywords.join(""))) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  const seed = hash / 0x100000000;
  const temperature = persona.aesthetic.colorTemperature;
  const h = temperature === "warm" ? 20 + seed * 60 : temperature === "cool" ? 190 + seed * 70 : seed * 360;
  const c = temperature === "high-contrast" ? 0.2 : temperature === "muted" ? 0.12 * 0.5 : 0.12;
  return { l: 0.62, c, h, score: 1 };
}

/** Check rounded, gamut-mapped hex colours; nudge only OKLCH lightness. */
function contrastedHex(color: Oklch, background: string, minimum: number, darkGround: boolean): string {
  const bg = parseColor(background)!;
  for (let step = 0; step <= 200; step++) {
    const l = Math.max(0, Math.min(1, color.l + (darkGround ? 1 : -1) * step * 0.005));
    const hex = oklchToHex({ ...color, l });
    if (contrastRatio(parseColor(hex)!, bg) >= minimum) return hex;
  }
  throw new Error("Unable to satisfy palette contrast");
}

function generateColorPalette(persona: Persona): ColorPalette {
  const aesthetic = persona.aesthetic;
  const corpus = culturalCorpus(persona);
  const anchors: ScoredAnchor[] = [];
  const temperatureBias = { "high-contrast": 2, cool: 1, neutral: 0, warm: -1, muted: -1 };
  let nightVotes = temperatureBias[aesthetic.colorTemperature];
  for (const entry of COLOR_LEXICON) {
    const score = scoreTriggers(corpus, entry.triggers);
    if (score === 0) continue;
    nightVotes += entry.night * score;
    anchors.push(...entry.anchors.map((anchor) => ({ ...anchor, score })));
  }
  const darkGround = nightVotes > 0;
  const clusters = clusterAnchors(anchors.length ? anchors : [fallbackAnchor(persona)]);
  const primaryCluster = clusters[0];
  const primary = {
    ...primaryCluster,
    l: Math.max(darkGround ? 0.55 : 0.42, Math.min(darkGround ? 0.72 : 0.55, primaryCluster.l)),
    c: Math.max(0.09, primaryCluster.c),
  };
  const secondaryCluster = clusters.find((cluster) => hueDistance(cluster.h, primary.h) >= 40);
  const secondary = secondaryCluster ?? { l: primary.l, c: primary.c * 0.7, h: normalizeHue(primary.h + 150) };
  const accent = clusters.filter((cluster) => cluster !== primaryCluster && cluster !== secondaryCluster)
    .sort((a, b) => b.c - a.c)[0] ?? { l: primary.l, c: 0.18, h: normalizeHue(primary.h - 60) };
  // Choose anchors nearest the centres of the specified warm/cool hue bands.
  const warm = anchors.filter((anchor) => anchor.h >= 20 && anchor.h <= 90)
    .sort((a, b) => hueDistance(a.h, 55) - hueDistance(b.h, 55) || b.score - a.score)[0];
  const cool = anchors.filter((anchor) => anchor.h >= 180 && anchor.h <= 280)
    .sort((a, b) => hueDistance(a.h, 230) - hueDistance(b.h, 230) || b.score - a.score)[0];
  const extras = {
    warm: ["#D4A843", "#7BA3A8"], cool: ["#C4956A", "#88B0C4"],
    "high-contrast": ["#FF6B35", "#00A8E8"], muted: ["#C4B8A8", "#A8B5C4"], neutral: ["#C4A882", "#82A8C4"],
  }[aesthetic.colorTemperature];
  const ground = (l: number, c = 0.015): Oklch => ({ l, c, h: primary.h });
  const background = oklchToHex(ground(darkGround ? 0.17 : 0.965));
  return {
    primary: contrastedHex(primary, background, 3, darkGround),
    secondary: oklchToHex(secondary), accent: oklchToHex(accent), background,
    surface: oklchToHex(ground(darkGround ? 0.22 : 0.99)),
    border: oklchToHex(ground(darkGround ? 0.32 : 0.86)),
    text: contrastedHex(ground(darkGround ? 0.95 : 0.22, darkGround ? 0.01 : 0.015), background, 7, darkGround),
    textMuted: contrastedHex(ground(darkGround ? 0.72 : 0.48, 0.02), background, 4.5, darkGround),
    warm: warm ? oklchToHex(warm) : extras[0], cool: cool ? oklchToHex(cool) : extras[1],
    density: aesthetic.density,
  };
}

function fontStack(family: string): string {
  const fallback = ["Space Mono", "VT323", "JetBrains Mono", "Fira Code"].includes(family) ? "monospace"
    : ["Fraunces", "Source Serif 4"].includes(family) ? "serif" : "sans-serif";
  return `'${family}', ${fallback}`;
}

function generateTypography(persona: Persona): TypographyTokens {
  const base = FONT_BASES[persona.aesthetic.typographyStyle] || FONT_BASES.clean;
  const corpus = culturalCorpus(persona);
  const override = FONT_OVERRIDES.map((entry) => ({ ...entry, score: scoreTriggers(corpus, entry.triggers) }))
    .filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)[0];
  const fonts = {
    heading: fontStack(override?.heading ?? base.heading), body: fontStack(base.body), mono: fontStack(base.mono),
  };

  return {
    fontFamily: fonts,
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "2rem",
      "4xl": "2.5rem",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.7,
    },
  };
}

function generateSpacing(aesthetic: AestheticProfile): SpacingTokens {
  const densityScales: Record<string, Record<string, string>> = {
    minimal: {
      "0": "0",
      "1": "0.25rem",
      "2": "0.5rem",
      "3": "0.75rem",
      "4": "1rem",
      "5": "1.5rem",
      "6": "2rem",
      "7": "3rem",
      "8": "4rem",
      "9": "6rem",
      "10": "8rem",
    },
    dense: {
      "0": "0",
      "1": "0.125rem",
      "2": "0.25rem",
      "3": "0.5rem",
      "4": "0.75rem",
      "5": "1rem",
      "6": "1.25rem",
      "7": "1.5rem",
      "8": "2rem",
      "9": "3rem",
      "10": "4rem",
    },
    rich: {
      "0": "0",
      "1": "0.25rem",
      "2": "0.5rem",
      "3": "0.75rem",
      "4": "1rem",
      "5": "1.5rem",
      "6": "2rem",
      "7": "3rem",
      "8": "4rem",
      "9": "6rem",
      "10": "8rem",
    },
    maximalist: {
      "0": "0",
      "1": "0.5rem",
      "2": "1rem",
      "3": "1.5rem",
      "4": "2rem",
      "5": "3rem",
      "6": "4rem",
      "7": "6rem",
      "8": "8rem",
      "9": "12rem",
      "10": "16rem",
    },
  };

  return {
    scale: densityScales[aesthetic.density] || densityScales.rich,
    density: aesthetic.density,
  };
}

function generateBorders(aesthetic: AestheticProfile): BorderTokens {
  const edgeRadiusMap: Record<string, BorderTokens["radius"]> = {
    sharp: {
      none: "0",
      sm: "0",
      base: "0",
      lg: "0",
      xl: "0",
      full: "9999px",
    },
    soft: {
      none: "0",
      sm: "0.25rem",
      base: "0.5rem",
      lg: "0.75rem",
      xl: "1rem",
      full: "9999px",
    },
    organic: {
      none: "0",
      sm: "0.5rem",
      base: "0.75rem",
      lg: "1.25rem",
      xl: "2rem",
      full: "9999px",
    },
    geometric: {
      none: "0",
      sm: "0.125rem",
      base: "0.25rem",
      lg: "0.5rem",
      xl: "0.75rem",
      full: "9999px",
    },
    brutalist: {
      none: "0",
      sm: "0",
      base: "0",
      lg: "0",
      xl: "0.25rem",
      full: "9999px",
    },
  };

  return {
    radius: edgeRadiusMap[aesthetic.edgeStyle] || edgeRadiusMap.soft,
    width: {
      thin: "1px",
      base: "1.5px",
      thick: "2px",
    },
    style: aesthetic.textureStyle === "grainy" ? "dashed" : "solid",
  };
}

function generateShadows(aesthetic: AestheticProfile): ShadowTokens {
  const base = {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    base: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
    lg: "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
    xl: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)",
    glow: "0 0 20px rgba(0,0,0,0.1)",
  };

  if (aesthetic.colorTemperature === "warm") {
    return {
      ...base,
      glow: "0 0 30px rgba(212, 168, 67, 0.2)",
    };
  }

  if (aesthetic.colorTemperature === "cool") {
    return {
      ...base,
      glow: "0 0 30px rgba(136, 176, 196, 0.2)",
    };
  }

  return base;
}

function generateMotion(aesthetic: AestheticProfile): MotionTokens {
  const easingMap: Record<string, MotionTokens["easing"]> = {
    smooth: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      snappy: "cubic-bezier(0.4, 0, 1, 1)",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    },
    snappy: {
      default: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      snappy: "cubic-bezier(0.25, 0.1, 0, 1)",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    },
    liquid: {
      default: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
      smooth: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
      snappy: "cubic-bezier(0.4, 0, 1, 1)",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    },
    mechanical: {
      default: "linear",
      smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      snappy: "cubic-bezier(0.4, 0, 1, 1)",
      bounce: "steps(5, end)",
    },
  };

  const durationMap: Record<string, MotionTokens["duration"]> = {
    smooth: {
      fast: "150ms",
      base: "300ms",
      slow: "500ms",
      slower: "1000ms",
    },
    snappy: {
      fast: "100ms",
      base: "200ms",
      slow: "400ms",
      slower: "800ms",
    },
    liquid: {
      fast: "200ms",
      base: "400ms",
      slow: "800ms",
      slower: "1500ms",
    },
    mechanical: {
      fast: "50ms",
      base: "150ms",
      slow: "300ms",
      slower: "600ms",
    },
  };

  return {
    duration: durationMap[aesthetic.motionStyle] || durationMap.smooth,
    easing: easingMap[aesthetic.motionStyle] || easingMap.smooth,
  };
}

/**
 * Export tokens as CSS custom properties
 */
export function exportCSS(persona: Persona, brandKit?: BrandKit | null): string {
  const tokens = generateDesignTokens(persona, brandKit);

  return `:root {
  /* ${persona.name} - Generated Design System */
  
  /* Colors */
  --color-primary: ${tokens.colors.primary};
  --color-secondary: ${tokens.colors.secondary};
  --color-accent: ${tokens.colors.accent};
  --color-background: ${tokens.colors.background};
  --color-surface: ${tokens.colors.surface};
  --color-text: ${tokens.colors.text};
  --color-text-muted: ${tokens.colors.textMuted};
  --color-border: ${tokens.colors.border};
  --color-warm: ${tokens.colors.warm};
  --color-cool: ${tokens.colors.cool};

  /* Typography */
  --font-heading: ${tokens.typography.fontFamily.heading};
  --font-body: ${tokens.typography.fontFamily.body};
  --font-mono: ${tokens.typography.fontFamily.mono};

  /* Spacing Scale */
  --space-0: ${tokens.spacing.scale["0"]};
  --space-1: ${tokens.spacing.scale["1"]};
  --space-2: ${tokens.spacing.scale["2"]};
  --space-3: ${tokens.spacing.scale["3"]};
  --space-4: ${tokens.spacing.scale["4"]};
  --space-5: ${tokens.spacing.scale["5"]};
  --space-6: ${tokens.spacing.scale["6"]};
  --space-7: ${tokens.spacing.scale["7"]};
  --space-8: ${tokens.spacing.scale["8"]};

  /* Border Radius */
  --radius-none: ${tokens.borders.radius.none};
  --radius-sm: ${tokens.borders.radius.sm};
  --radius-base: ${tokens.borders.radius.base};
  --radius-lg: ${tokens.borders.radius.lg};
  --radius-xl: ${tokens.borders.radius.xl};
  --radius-full: ${tokens.borders.radius.full};

  /* Motion */
  --duration-fast: ${tokens.motion.duration.fast};
  --duration-base: ${tokens.motion.duration.base};
  --duration-slow: ${tokens.motion.duration.slow};
  --duration-slower: ${tokens.motion.duration.slower};
  --ease-default: ${tokens.motion.easing.default};
  --ease-smooth: ${tokens.motion.easing.smooth};
  --ease-snappy: ${tokens.motion.easing.snappy};
}
`;
}

/**
 * Export tokens as Tailwind config
 */
export function exportTailwindConfig(persona: Persona, brandKit?: BrandKit | null): string {
  const tokens = generateDesignTokens(persona, brandKit);

  return `// tailwind.config.js - ${persona.name} Theme
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '${tokens.colors.primary}',
        secondary: '${tokens.colors.secondary}',
        accent: '${tokens.colors.accent}',
        background: '${tokens.colors.background}',
        surface: '${tokens.colors.surface}',
        text: {
          DEFAULT: '${tokens.colors.text}',
          muted: '${tokens.colors.textMuted}',
        },
        border: '${tokens.colors.border}',
        warm: '${tokens.colors.warm}',
        cool: '${tokens.colors.cool}',
      },
      fontFamily: {
        heading: [${tokens.typography.fontFamily.heading.split(", ").map((f) => `"${f.trim().replace(/['"]/g, "")}"`).join(", ")}],
        body: [${tokens.typography.fontFamily.body.split(", ").map((f) => `"${f.trim().replace(/['"]/g, "")}"`).join(", ")}],
        mono: [${tokens.typography.fontFamily.mono.split(", ").map((f) => `"${f.trim().replace(/['"]/g, "")}"`).join(", ")}],
      },
      borderRadius: {
        'none': '${tokens.borders.radius.none}',
        'sm': '${tokens.borders.radius.sm}',
        'base': '${tokens.borders.radius.base}',
        'lg': '${tokens.borders.radius.lg}',
        'xl': '${tokens.borders.radius.xl}',
      },
      transitionTimingFunction: {
        'default': '${tokens.motion.easing.default}',
        'smooth': '${tokens.motion.easing.smooth}',
        'snappy': '${tokens.motion.easing.snappy}',
      },
      transitionDuration: {
        'fast': '${tokens.motion.duration.fast}',
        'base': '${tokens.motion.duration.base}',
        'slow': '${tokens.motion.duration.slow}',
      },
    },
  },
}`;
}

/**
 * Export tokens as PandaCSS theme config
 */
export function exportPandaTheme(persona: Persona, brandKit?: BrandKit | null): string {
  const t = generateDesignTokens(persona, brandKit);

  return `import { defineConfig } from "@pandacss/dev";

// ${persona.name} — PandaCSS Theme (generated by Baste)
export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  outdir: "styled-system",
  jsxFramework: "qwik",
  theme: {
    extend: {
      tokens: {
        colors: {
          bg: { value: "${t.colors.background}" },
          surface: { value: "${t.colors.surface}" },
          "surface-hover": { value: "${shadeColor(t.colors.surface, 10)}" },
          text: { value: "${t.colors.text}" },
          "text-muted": { value: "${t.colors.textMuted}" },
          border: { value: "${t.colors.border}" },
          primary: { value: "${t.colors.primary}" },
          secondary: { value: "${t.colors.secondary}" },
          accent: { value: "${t.colors.accent}" },
          warm: { value: "${t.colors.warm}" },
          cool: { value: "${t.colors.cool}" },
        },
        fonts: {
          heading: { value: "${t.typography.fontFamily.heading}" },
          body: { value: "${t.typography.fontFamily.body}" },
          mono: { value: "${t.typography.fontFamily.mono}" },
        },
        radii: {
          sm: { value: "${t.borders.radius.sm}" },
          base: { value: "${t.borders.radius.base}" },
          lg: { value: "${t.borders.radius.lg}" },
          xl: { value: "${t.borders.radius.xl}" },
        },
        spacing: {
          ${Object.entries(t.spacing.scale).map(([k, v]) => `${k}: { value: "${v}" },`).join("\n          ")}
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
});
`;
}

function shadeColor(color: string, percent: number): string {
  // Simple hex shade — darken/lighten
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}
