/** Dependency-free OKLCH conversion and hue-preserving sRGB gamut mapping. */
export interface Oklch { l: number; c: number; h: number }
export interface Oklab { l: number; a: number; b: number }

export function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

export function hueDistance(a: number, b: number): number {
  const distance = Math.abs(normalizeHue(a) - normalizeHue(b));
  return Math.min(distance, 360 - distance);
}

export function toOklab({ l, c, h }: Oklch): Oklab {
  const radians = h * Math.PI / 180;
  return { l, a: c * Math.cos(radians), b: c * Math.sin(radians) };
}

export function toOklch({ l, a, b }: Oklab): Oklch {
  return { l, c: Math.hypot(a, b), h: normalizeHue(Math.atan2(b, a) * 180 / Math.PI) };
}

function linearRgb(color: Oklch): number[] {
  const { l, a, b } = toOklab(color);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S,
  ];
}

/** Reduce chroma, retaining lightness and hue, instead of clipping RGB channels. */
export function oklchToHex(color: Oklch): string {
  const mapped = { l: Math.max(0, Math.min(1, color.l)), c: Math.max(0, color.c), h: color.h };
  const inGamut = (rgb: number[]) => rgb.every((channel) => channel >= -1e-7 && channel <= 1 + 1e-7);
  let rgb = linearRgb(mapped);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = mapped.c;
    for (let i = 0; i < 30; i++) {
      const c = (low + high) / 2;
      if (inGamut(linearRgb({ ...mapped, c }))) low = c;
      else high = c;
    }
    rgb = linearRgb({ ...mapped, c: low });
  }
  return "#" + rgb.map((channel) => {
    const linear = Math.max(0, Math.min(1, channel));
    const srgb = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255).toString(16).padStart(2, "0");
  }).join("");
}
