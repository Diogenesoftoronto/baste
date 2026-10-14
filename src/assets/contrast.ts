/**
 * WCAG contrast-ratio helpers.
 *
 * A design tool that ships color palettes should at least *flag* pairs that
 * fall below AA. This module gives the rest of the app a single source of
 * truth for "is this combination readable?" — and a `lintPalette()` function
 * that the brand-kit export can call to surface warnings.
 *
 * Algorithm: WCAG 2.x relative luminance + contrast ratio.
 *   https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

export interface Rgb { r: number; g: number; b: number }

/** Accepts #rgb, #rrggbb, rgb(), or rgba(). Returns 0–255 channels or null. */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase();
  // Hex
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  // rgb()/rgba()
  const fn = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (fn) {
    return { r: +fn[1], g: +fn[2], b: +fn[3] };
  }
  return null;
}

/** Linearize an 8-bit channel per WCAG 2.x. */
function lin(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0..1. */
export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** WCAG contrast ratio between two colors, 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WCAGLevel = "AAA" | "AA" | "AA-large" | "fail";
/** Classify a ratio against WCAG 2.x body/UI thresholds. */
export function wcagLevel(ratio: number): WCAGLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}

export interface ContrastIssue {
  pair: [string, string];
  ratio: number;
  level: WCAGLevel;
  /** Foreground color is unreadable on this background. */
  onBg: string;
}

/**
 * Lint a palette: pick the most likely "background" (lightest), then check
 * every other color as foreground text on it. Returns pairs that fail AA
 * (4.5:1) for body text.
 */
export function lintPalette(
  palette: string[],
  options: { minRatio?: number; against?: string } = {},
): ContrastIssue[] {
  const minRatio = options.minRatio ?? 4.5;
  const parsed = palette.map((c) => ({ c, rgb: parseColor(c) })).filter((x) => x.rgb);
  if (parsed.length < 2) return [];

  // Pick the bg: the lightest (highest luminance). If `against` is given, use that.
  const against = options.against
    ? { c: options.against, rgb: parseColor(options.against)! }
    : parsed.slice().sort((a, b) => relativeLuminance(b.rgb!) - relativeLuminance(a.rgb!))[0];

  const issues: ContrastIssue[] = [];
  for (const fg of parsed) {
    if (fg.c === against.c) continue;
    const ratio = contrastRatio(fg.rgb!, against.rgb!);
    if (ratio < minRatio) {
      issues.push({
        pair: [fg.c, against.c],
        ratio: Math.round(ratio * 100) / 100,
        level: wcagLevel(ratio),
        onBg: against.c,
      });
    }
  }
  return issues;
}
