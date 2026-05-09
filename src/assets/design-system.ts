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
 * Generate design tokens from persona
 */
export function generateDesignTokens(persona: Persona): DesignTokens {
  const aesthetic = persona.aesthetic;

  return {
    colors: generateColorPalette(aesthetic),
    typography: generateTypography(aesthetic),
    spacing: generateSpacing(aesthetic),
    borders: generateBorders(aesthetic),
    shadows: generateShadows(aesthetic),
    motion: generateMotion(aesthetic),
  };
}

function generateColorPalette(aesthetic: AestheticProfile): ColorPalette {
  const colorMap: Record<string, ColorPalette> = {
    warm: {
      primary: "#8B6914",
      secondary: "#6B8E6B",
      accent: "#D4A843",
      background: "#F5F0E8",
      surface: "#FFFFFF",
      text: "#2D2926",
      textMuted: "#7A756E",
      border: "#D9D4CC",
      warm: "#D4A843",
      cool: "#7BA3A8",
      density: aesthetic.density,
    },
    cool: {
      primary: "#4A6FA5",
      secondary: "#6B5B95",
      accent: "#88B0C4",
      background: "#1A1F2E",
      surface: "#242B3D",
      text: "#E8E8F0",
      textMuted: "#8A8FA8",
      border: "#3A4055",
      warm: "#C4956A",
      cool: "#88B0C4",
      density: aesthetic.density,
    },
    "high-contrast": {
      primary: "#FF6B35",
      secondary: "#004E89",
      accent: "#1A659E",
      background: "#0A0A0A",
      surface: "#141414",
      text: "#FFFFFF",
      textMuted: "#999999",
      border: "#333333",
      warm: "#FF6B35",
      cool: "#00A8E8",
      density: aesthetic.density,
    },
    muted: {
      primary: "#9B8E7E",
      secondary: "#A8B5A6",
      accent: "#C4B8A8",
      background: "#FAF8F5",
      surface: "#FFFFFF",
      text: "#4A4540",
      textMuted: "#9A948C",
      border: "#E8E4DE",
      warm: "#C4B8A8",
      cool: "#A8B5C4",
      density: aesthetic.density,
    },
    neutral: {
      primary: "#5A5A5A",
      secondary: "#7A7A7A",
      accent: "#3A7CA5",
      background: "#F7F7F7",
      surface: "#FFFFFF",
      text: "#1A1A1A",
      textMuted: "#6A6A6A",
      border: "#E0E0E0",
      warm: "#C4A882",
      cool: "#82A8C4",
      density: aesthetic.density,
    },
  };

  return colorMap[aesthetic.colorTemperature] || colorMap.neutral;
}

function generateTypography(aesthetic: AestheticProfile): TypographyTokens {
  const fontMap: Record<string, { heading: string; body: string; mono: string }> = {
    clean: {
      heading: "'Inter', system-ui, sans-serif",
      body: "'Inter', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    expressive: {
      heading: "'Space Grotesk', 'Helvetica Neue', sans-serif",
      body: "'Source Sans 3', system-ui, sans-serif",
      mono: "'Fira Code', monospace",
    },
    retro: {
      heading: "'Space Grotesk', 'Courier New', serif",
      body: "'Source Sans 3', Georgia, serif",
      mono: "'Courier Prime', monospace",
    },
    futuristic: {
      heading: "'Rajdhani', 'Helvetica Neue', sans-serif",
      body: "'Inter', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    handcrafted: {
      heading: "'Space Grotesk', 'Palatino', serif",
      body: "'Source Sans 3', 'Palatino', serif",
      mono: "'Fira Code', monospace",
    },
  };

  const fonts = fontMap[aesthetic.typographyStyle] || fontMap.clean;

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
export function exportCSS(persona: Persona): string {
  const tokens = generateDesignTokens(persona);

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
export function exportTailwindConfig(persona: Persona): string {
  const tokens = generateDesignTokens(persona);

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
export function exportPandaTheme(persona: Persona): string {
  const t = generateDesignTokens(persona);

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
