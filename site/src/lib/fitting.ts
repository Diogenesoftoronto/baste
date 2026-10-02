import type { AestheticProfile, DesignTokens } from "./api-types";

/**
 * A "fitting" dresses a block of UI entirely in one persona's tokens.
 * fittingVars() turns DesignTokens into the --f-* custom properties that
 * global.css's `.fitting` scope consumes.
 */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Ink or paper — whichever reads better on the given fill. */
export function onColor(fill: string, dark = "#141310", light = "#FFFFFF"): string {
  return contrastRatio(fill, dark) >= contrastRatio(fill, light) ? dark : light;
}

export function isDarkGround(tokens: DesignTokens): boolean {
  return luminance(tokens.colors.background) < 0.18;
}

const PAD_BY_DENSITY: Record<string, [string, string]> = {
  minimal: ["14px", "28px"],
  rich: ["14px", "22px"],
  dense: ["10px", "14px"],
  maximalist: ["8px", "12px"],
};

export function fittingVars(tokens: DesignTokens): Record<string, string> {
  const c = tokens.colors;
  const t = tokens.typography.fontFamily;
  const r = tokens.borders.radius;
  const [gap, pad] = PAD_BY_DENSITY[tokens.spacing.density] ?? PAD_BY_DENSITY.rich;
  return {
    "--f-bg": c.background,
    "--f-surface": c.surface,
    "--f-text": c.text,
    "--f-muted": c.textMuted,
    "--f-border": c.border,
    "--f-primary": c.primary,
    "--f-on-primary": onColor(c.primary),
    "--f-secondary": c.secondary,
    "--f-accent": c.accent,
    "--f-warm": c.warm,
    "--f-cool": c.cool,
    "--f-radius": r.base,
    "--f-radius-lg": r.xl,
    "--f-gap": gap,
    "--f-pad": pad,
    "--f-heading": t.heading,
    "--f-body": t.body,
    "--f-mono": t.mono,
    "--f-ease": tokens.motion.easing.default,
    "--f-dur": tokens.motion.duration.base,
    "--f-border-style": tokens.borders.style,
  };
}

/** The ordered swatches that best summarise a palette. */
export function paletteSwatches(tokens: DesignTokens): Array<{ role: string; hex: string }> {
  const c = tokens.colors;
  return [
    { role: "primary", hex: c.primary },
    { role: "secondary", hex: c.secondary },
    { role: "accent", hex: c.accent },
    { role: "warm", hex: c.warm },
    { role: "cool", hex: c.cool },
    { role: "background", hex: c.background },
    { role: "surface", hex: c.surface },
    { role: "text", hex: c.text },
  ];
}

/** Human labels for each aesthetic axis, in display order. */
export const AESTHETIC_AXES: Array<{ key: keyof AestheticProfile; label: string; options: string[] }> = [
  { key: "colorTemperature", label: "Colour temperature", options: ["warm", "cool", "neutral", "high-contrast", "muted"] },
  { key: "density", label: "Density", options: ["minimal", "rich", "dense", "maximalist"] },
  { key: "edgeStyle", label: "Edges", options: ["sharp", "soft", "organic", "geometric", "brutalist"] },
  { key: "motionStyle", label: "Motion", options: ["smooth", "snappy", "liquid", "mechanical"] },
  { key: "typographyStyle", label: "Typography", options: ["clean", "expressive", "retro", "futuristic", "handcrafted"] },
  { key: "textureStyle", label: "Texture", options: ["flat", "clean", "textured", "grainy", "noisy"] },
  { key: "iconStyle", label: "Iconography", options: ["line", "filled", "hand-drawn", "geometric", "abstract"] },
  { key: "layoutStyle", label: "Layout", options: ["grid", "organic", "asymmetric", "editorial", "brutalist"] },
];
