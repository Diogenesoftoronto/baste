import type { FabricLook } from "~/components/fx/fabric-gl";

export const MATERIAL_KEY = "baste:material:v1";
export const BACKDROP_KEY = "baste:backdrop:v1";
export const BACKDROP_EVENT = "baste:backdrop-change";
export const MATERIAL_MODES = [
  "cloth",
  "flow",
  "moire",
  "contour",
  "marble",
  "radial",
] as const;
export type MaterialMode = (typeof MATERIAL_MODES)[number];
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
