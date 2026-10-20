import type { FabricLook } from "~/components/fx/fabric-gl";

export const MATERIAL_KEY = "baste:material:v1";
export const BACKDROP_KEY = "baste:backdrop:v1";
export const BACKDROP_EVENT = "baste:backdrop-change";
/** Fired with the storage key whenever a material lab saves a look. */
export const MATERIAL_EVENT = "baste:material-change";
export const MATERIAL_MODES = [
  "cloth",
  "flow",
  "moire",
  "contour",
  "marble",
  "radial",
] as const;
export type MaterialMode = (typeof MATERIAL_MODES)[number];
/** What each technique is called and does, in plain words. */
export const MATERIAL_TECHNIQUES: Record<MaterialMode, { name: string; hint: string }> = {
  cloth: { name: "Shot silk", hint: "Two yarns trade places as the cloth folds." },
  flow: { name: "Thread current", hint: "Parallel threads bend into one current." },
  moire: { name: "Interference", hint: "Two weaves cross and make a slower third." },
  contour: { name: "Chalk contours", hint: "Lines trace a field of shifting heights." },
  marble: { name: "Dye bath", hint: "A colour ramp warps like marbled paper." },
  radial: { name: "Radial pleats", hint: "Folds fan out from a centre you can move." },
};
export interface MaterialLook extends FabricLook {
  pattern: MaterialMode;
  seed: number;
  density: number;
  speed: number;
  motion: boolean;
  interaction: boolean;
  hue: number;
  cycle: boolean;
  colourSpace: "rgb" | "oklab" | "hue";
}

const BASE: MaterialLook = {
  pattern: "flow",
  warp: "#D2402A",
  weft: "#2F55A4",
  ground: "#F1ECE2",
  hue: 0,
  cycle: false,
  colourSpace: "oklab",
  seed: 271,
  density: 0.55,
  speed: 0.55,
  motion: true,
  interaction: true,
  dye: 0.75,
  fold: 0.55,
  weave: 0.65,
  thread: 3,
  scale: 1.4,
  grain: 0.018,
};
export const MATERIAL_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  look: MaterialLook;
}> = [
  {
    id: "thread-current",
    name: "Thread current",
    description: "Parallel yarns bend into a shared current.",
    look: { ...BASE },
  },
  {
    id: "shot-silk",
    name: "Shot silk",
    description: "Two yarn colours trade places as the cloth folds.",
    look: {
      ...BASE,
      pattern: "cloth",
      warp: "#D2402A",
      weft: "#E3A443",
      ground: "#412C38",
      dye: 0.88,
      weave: 0.75,
      thread: 4,
      fold: 0.7,
      seed: 623,
    },
  },
  {
    id: "interference",
    name: "Interference",
    description: "Two woven fields make a third, slower pattern.",
    look: {
      ...BASE,
      pattern: "moire",
      warp: "#2F55A4",
      weft: "#D2402A",
      ground: "#EEE7D7",
      scale: 1.2,
      density: 0.65,
      seed: 83,
      speed: 0.28,
    },
  },
  {
    id: "chalk-islands",
    name: "Chalk islands",
    description: "Contour lines trace a shifting field of heights.",
    look: {
      ...BASE,
      pattern: "contour",
      warp: "#315C8C",
      weft: "#D2402A",
      ground: "#DFE6E0",
      seed: 941,
      density: 0.5,
      dye: 0.75,
    },
  },
  {
    id: "oxide-bath",
    name: "Oxide bath",
    description: "A warped colour ramp moves through ink and dye.",
    look: {
      ...BASE,
      pattern: "marble",
      warp: "#D2402A",
      weft: "#F0C534",
      ground: "#24221D",
      seed: 417,
      scale: 1.8,
      dye: 0.85,
      speed: 0.38,
    },
  },
  {
    id: "radial-pleat",
    name: "Radial pleat",
    description: "Repeated folds fan out from a movable centre.",
    look: {
      ...BASE,
      pattern: "radial",
      warp: "#2F55A4",
      weft: "#A35477",
      ground: "#EEE5DB",
      seed: 115,
      density: 0.45,
      speed: 0.3,
    },
  },
];
export const MATERIAL_PALETTES = [
  { name: "Atelier", warp: "#D2402A", weft: "#2F55A4", ground: "#F1ECE2" },
  { name: "Verdigris", warp: "#237967", weft: "#D99E43", ground: "#E3E8DA" },
  { name: "After hours", warp: "#F07858", weft: "#A8ABF2", ground: "#242638" },
  { name: "Dye bath", warp: "#B4315E", weft: "#F0C534", ground: "#24221D" },
];
export const DEFAULT_MATERIAL: MaterialLook = { ...BASE };
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
const hex = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : fallback;

/** Treat imported recipes and browser storage as untrusted input. */
export function normalizeMaterial(value: unknown): MaterialLook {
  const p =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    hue: bounded(p.hue, BASE.hue, 0, 360),
    cycle: typeof p.cycle === "boolean" ? p.cycle : BASE.cycle,
    colourSpace:
      p.colourSpace === "rgb" ||
      p.colourSpace === "hue" ||
      p.colourSpace === "oklab"
        ? p.colourSpace
        : BASE.colourSpace,
    pattern: MATERIAL_MODES.includes(p.pattern as MaterialMode)
      ? (p.pattern as MaterialMode)
      : BASE.pattern,
    seed: Math.round(bounded(p.seed, BASE.seed, 0, 65535)),
    density: bounded(p.density, BASE.density, 0.05, 1),
    speed: bounded(p.speed, BASE.speed, 0, 2),
    motion: typeof p.motion === "boolean" ? p.motion : BASE.motion,
    interaction:
      typeof p.interaction === "boolean" ? p.interaction : BASE.interaction,
    warp: hex(p.warp, BASE.warp),
    weft: hex(p.weft, BASE.weft),
    ground: hex(p.ground, BASE.ground),
    dye: bounded(p.dye, BASE.dye, 0, 1),
    fold: bounded(p.fold, BASE.fold, 0, 1.6),
    weave: bounded(p.weave, BASE.weave, 0, 1),
    thread: bounded(p.thread, BASE.thread, 1, 8),
    scale: bounded(p.scale, BASE.scale, 0.5, 4),
    grain: bounded(p.grain, BASE.grain, 0, 0.08),
  };
}

/** Stable small number from a string, so a persona always gets the same composition. */
function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 65536;
}

interface PersonaLike {
  id: string;
  aesthetic?: { density?: string; edgeStyle?: string; motionStyle?: string; textureStyle?: string; layoutStyle?: string; colorTemperature?: string };
}
interface TokensLike {
  colors: { primary: string; secondary: string; accent: string; background: string; surface: string };
}

/**
 * The persona's own material: technique from its aesthetic profile, dyes from
 * its generated palette, composition seeded by its id. Organic edges grow
 * contours, liquid motion becomes a dye bath, maximalism interferes, sharp
 * geometry pleats, and quiet personas get plain woven cloth.
 */
export function materialForPersona(p: PersonaLike, t: TokensLike): MaterialLook {
  const a = p.aesthetic ?? {};
  const pattern: MaterialMode =
    a.motionStyle === "liquid" ? "marble"
    : a.density === "maximalist" ? "moire"
    : a.edgeStyle === "organic" || a.layoutStyle === "organic" ? "contour"
    : a.edgeStyle === "geometric" || a.edgeStyle === "brutalist" ? "radial"
    : a.density === "minimal" ? "cloth"
    : "flow";
  const busy = a.density === "maximalist" ? 0.8 : a.density === "dense" ? 0.68 : a.density === "rich" ? 0.56 : 0.4;
  const speed = a.motionStyle === "snappy" ? 0.9 : a.motionStyle === "mechanical" ? 0.7 : a.motionStyle === "liquid" ? 0.45 : 0.35;
  const grain = a.textureStyle === "grainy" || a.textureStyle === "noisy" ? 0.04 : a.textureStyle === "textured" ? 0.026 : 0.012;
  return normalizeMaterial({
    ...BASE,
    pattern,
    ground: t.colors.background,
    warp: t.colors.primary,
    weft: pattern === "cloth" ? t.colors.surface : t.colors.accent,
    seed: seedOf(p.id),
    density: busy,
    speed,
    grain,
    dye: a.colorTemperature === "muted" ? 0.55 : 0.8,
    fold: a.edgeStyle === "sharp" || a.edgeStyle === "brutalist" ? 0.35 : 0.6,
    scale: a.density === "minimal" ? 1.1 : 1.5,
    colourSpace: "oklab",
  });
}

/** Plain words for why a persona got its technique (shown beside the lab). */
export function materialReason(p: PersonaLike): string {
  const a = p.aesthetic ?? {};
  return a.motionStyle === "liquid" ? "Liquid motion, so the dye runs like marbling."
    : a.density === "maximalist" ? "Maximalist density, so two weaves interfere."
    : a.edgeStyle === "organic" || a.layoutStyle === "organic" ? "Organic edges, so the cloth grows contour lines."
    : a.edgeStyle === "geometric" || a.edgeStyle === "brutalist" ? `${a.edgeStyle === "brutalist" ? "Brutalist" : "Geometric"} edges, so it pleats from a hard centre.`
    : a.density === "minimal" ? "Minimal density, so a plain shot weave."
    : "A current of parallel yarns, bent by its motion.";
}

/** Read a saved persona material, if this browser has one. */
export function savedPersonaMaterial(id: string): MaterialLook | null {
  try {
    const saved = localStorage.getItem(personaMaterialKey(id));
    return saved ? parseMaterialRecipe(saved) : null;
  } catch {
    return null;
  }
}

export const personaMaterialKey = (id: string) => `baste:material:persona:${id}`;

/** Ask the open material lab to try on a look, such as a persona's cloth. */
export const MATERIAL_TRY_EVENT = "baste:material-try";
export interface MaterialTry {
  id: string;
  name: string;
  look: MaterialLook;
}

/** Thumbnails rendered from the shader itself (public/materials/swatches), so a swatch shows the real cloth. */
export const presetSwatch = (id: string, wide = false) => `/materials/swatches/${id}${wide ? "-wide" : ""}.avif`;
const PERSONA_SWATCHES = new Set(["cyberbotanist", "nightmarketcoder", "liminalweeb"]);
export const personaSwatch = (id: string, wide = false) =>
  PERSONA_SWATCHES.has(id) ? `/materials/swatches/persona-${id}${wide ? "-wide" : ""}.avif` : undefined;

/** A dye as the shader shows it after hue rotation (fabric-gl's tint()), for previews drawn in CSS. */
export function tintHex(hex: string, degrees: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + degrees) % 360) + 360) % 360;
  const s = max === 0 ? 0 : d / max, v = max;
  const f = (k: number) => {
    const x = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return "#" + [f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function materialRecipe(look: MaterialLook): string {
  return JSON.stringify(
    {
      version: 1,
      kind: "baste-procedural-material",
      look: normalizeMaterial(look),
    },
    null,
    2,
  );
}
export function parseMaterialRecipe(text: string): MaterialLook {
  const value: unknown = JSON.parse(text);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("kind" in value) ||
    value.kind !== "baste-procedural-material" ||
    !("look" in value) ||
    !value.look ||
    typeof value.look !== "object" ||
    Array.isArray(value.look)
  ) {
    throw new Error("Choose a Baste material recipe with version 1.");
  }
  return normalizeMaterial(value.look);
}
