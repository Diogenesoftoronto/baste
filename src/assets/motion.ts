/**
 * Motion primitives: one vocabulary for how a persona moves.
 *
 * The four motion languages defined here drive the design tokens (durations,
 * curves, a spring, travel distances), the keyframe choreography exported for
 * interfaces, the motion line in video prompts, and the options Jev chooses
 * between when it reads a loop's frames. Keeping them together stops a snappy
 * persona getting snappy buttons and a video full of slow dissolves.
 */
import type { AestheticProfile, Persona, PersonaAnimation } from "../persona/types.js";

export type MotionStyle = AestheticProfile["motionStyle"];
export type MotionMoment = "enter" | "exit" | "hover" | "press" | "emphasis" | "ambient";
export const MOTION_MOMENTS: MotionMoment[] = ["enter", "exit", "hover", "press", "emphasis", "ambient"];

/** One keyframe, Web Animations style: camelCase properties and an optional 0–1 offset. */
export type MotionKeyframe = Record<string, string | number>;

export interface MotionPrimitive {
  /** The @keyframes name in exported CSS. */
  name: string;
  /** What the move is for, in a line. */
  use: string;
  /** What starts it: mounting, unmounting, pointer states, a call for attention, or a loop. */
  trigger: "mount" | "unmount" | "hover" | "press" | "attention" | "loop";
  keyframes: MotionKeyframe[];
  duration: string;
  easing: string;
  iterations: number | "infinite";
  direction: "normal" | "alternate";
  /** The reduced-motion version: an opacity-only fade, or nothing. */
  reduced: MotionKeyframe[] | null;
}

export interface MotionTokens {
  duration: { fast: string; base: string; slow: string; slower: string };
  easing: { default: string; smooth: string; snappy: string; bounce: string };
  /** What this motion language feels like, for people and prompts. */
  character: string;
  /** Semantic curves: arrivals decelerate, departures accelerate, emphasis may overshoot. */
  curves: { standard: string; enter: string; exit: string; emphasis: string };
  /** A physical spring for JS animation libraries, with its CSS linear() curve and settle time. */
  spring: { stiffness: number; damping: number; mass: number; easing: string; duration: string };
  /** How far things travel. Denser interfaces move less. */
  distance: { nudge: string; shift: string; travel: string };
  /** Pressed elements scale to this. */
  pressScale: number;
  /** Delay between items revealed in sequence. */
  stagger: string;
  /** One cycle of an ambient loop. */
  ambient: string;
  /** Ready-made moves built from the tokens above. */
  choreography: Record<MotionMoment, MotionPrimitive>;
}

/**
 * Each language in three registers: for people reading tokens, for video
 * models (kept verbatim from earlier prompts), and for Jev reading a loop's
 * frames, where only change between stills is visible.
 */
export const MOTION_LANGUAGE: Record<MotionStyle, { character: string; video: string; frames: string }> = {
  smooth: {
    character: "Unhurried and continuous: things glide into place and settle without overshoot.",
    video: "Slow, smooth movement with gentle continuous pacing",
    frames: "Slow, continuous drift: consecutive frames change gradually and evenly, and nothing jumps.",
  },
  snappy: {
    character: "Quick and decisive: short moves, crisp stops and readable pauses between them.",
    video: "Crisp, brief motion accents with readable pauses",
    frames: "Holds broken by quick, decisive changes: some consecutive frames are nearly identical, others differ sharply.",
  },
  liquid: {
    character: "Fluid and elastic: forms flow, stretch and settle with a soft overshoot.",
    video: "Flowing organic movement, fluid morphs and soft transitions",
    frames: "Flowing, morphing forms: shapes and light melt into one another from frame to frame.",
  },
  mechanical: {
    character: "Precise and metered: linear travel, stepped timing and rhythmic repetition.",
    video: "Precise, rhythmic mechanical movement",
    frames: "Precise, regular movement: elements shift by rigid, even increments or repeat in a fixed rhythm.",
  },
};

interface StyleSpec {
  duration: MotionTokens["duration"];
  easing: MotionTokens["easing"];
  curves: Omit<MotionTokens["curves"], "emphasis"> & { emphasis: string | "spring" };
  enter: string | "spring";
  spring: { stiffness: number; damping: number; mass: number };
  distance: [nudge: number, shift: number, travel: number];
  pressScale: number;
  stagger: number;
  ambient: number;
}

const SINE = "cubic-bezier(0.37, 0, 0.63, 1)";

const STYLES: Record<MotionStyle, StyleSpec> = {
  smooth: {
    duration: { fast: "150ms", base: "300ms", slow: "500ms", slower: "1000ms" },
    easing: { default: "cubic-bezier(0.4, 0, 0.2, 1)", smooth: "cubic-bezier(0.4, 0, 0.2, 1)", snappy: "cubic-bezier(0.4, 0, 1, 1)", bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)" },
    curves: { standard: "cubic-bezier(0.4, 0, 0.2, 1)", enter: "cubic-bezier(0, 0, 0.2, 1)", exit: "cubic-bezier(0.4, 0, 1, 1)", emphasis: "cubic-bezier(0.4, 0, 0.2, 1)" },
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    // Critically damped: it settles without passing its target.
    spring: { stiffness: 170, damping: 26, mass: 1 },
    distance: [2, 12, 24], pressScale: 0.98, stagger: 60, ambient: 6000,
  },
  snappy: {
    duration: { fast: "100ms", base: "200ms", slow: "400ms", slower: "800ms" },
    easing: { default: "cubic-bezier(0.25, 0.1, 0.25, 1)", smooth: "cubic-bezier(0.4, 0, 0.2, 1)", snappy: "cubic-bezier(0.25, 0.1, 0, 1)", bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)" },
    curves: { standard: "cubic-bezier(0.2, 0, 0, 1)", enter: "cubic-bezier(0.05, 0.7, 0.1, 1)", exit: "cubic-bezier(0.3, 0, 0.8, 0.15)", emphasis: "spring" },
    enter: "cubic-bezier(0.05, 0.7, 0.1, 1)",
    spring: { stiffness: 400, damping: 34, mass: 1 },
    distance: [2, 8, 16], pressScale: 0.96, stagger: 30, ambient: 4000,
  },
  liquid: {
    duration: { fast: "200ms", base: "400ms", slow: "800ms", slower: "1500ms" },
    easing: { default: "cubic-bezier(0.45, 0.05, 0.55, 0.95)", smooth: "cubic-bezier(0.45, 0.05, 0.55, 0.95)", snappy: "cubic-bezier(0.4, 0, 1, 1)", bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)" },
    curves: { standard: "cubic-bezier(0.45, 0.05, 0.55, 0.95)", enter: "cubic-bezier(0.22, 1, 0.36, 1)", exit: "cubic-bezier(0.55, 0, 1, 0.45)", emphasis: "spring" },
    // Arrivals ride the spring, so they overshoot a little and settle.
    enter: "spring",
    spring: { stiffness: 120, damping: 12, mass: 1 },
    distance: [3, 16, 32], pressScale: 0.97, stagger: 80, ambient: 9000,
  },
  mechanical: {
    duration: { fast: "50ms", base: "150ms", slow: "300ms", slower: "600ms" },
    easing: { default: "linear", smooth: "cubic-bezier(0.4, 0, 0.2, 1)", snappy: "cubic-bezier(0.4, 0, 1, 1)", bounce: "steps(5, end)" },
    curves: { standard: "linear", enter: "cubic-bezier(0.65, 0, 0.35, 1)", exit: "linear", emphasis: "steps(1, end)" },
    enter: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: { stiffness: 300, damping: 35, mass: 1 },
    distance: [1, 8, 16], pressScale: 0.98, stagger: 40, ambient: 12000,
  },
};

/** Busy interfaces move less and sequence faster; sparse ones can afford longer travel. */
const DENSITY_SCALE: Record<AestheticProfile["density"], number> = { minimal: 1.25, rich: 1, dense: 0.75, maximalist: 0.75 };

/** Position of a unit spring released from rest at 0 toward 1, after `t` seconds. */
export function springPosition(t: number, stiffness: number, damping: number, mass = 1): number {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (Math.abs(zeta - 1) < 1e-6) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s);
  const r2 = -w0 * (zeta + s);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

const springs = new Map<string, { easing: string; durationMs: number }>();

/**
 * A spring as a CSS linear() curve, over the time it takes to come within 0.5%
 * of rest; the remaining tail is a fraction of a pixel on any UI travel.
 */
export function springEasing(stiffness: number, damping: number, mass = 1): { easing: string; durationMs: number } {
  const key = `${stiffness}/${damping}/${mass}`;
  const cached = springs.get(key);
  if (cached) return cached;
  let last = 0;
  for (let ms = 0; ms <= 5000; ms++) {
    if (Math.abs(1 - springPosition(ms / 1000, stiffness, damping, mass)) >= 0.005) last = ms;
  }
  const durationMs = Math.max(100, Math.ceil((last + 1) / 10) * 10);
  // About one stop per 60 Hz frame keeps the overshoot faithful without bloating the curve.
  const stops = Math.min(60, Math.max(20, Math.round(durationMs / 16)));
  const points = Array.from({ length: stops + 1 }, (_, i) =>
    i === stops ? "1" : String(Math.round(springPosition((durationMs / 1000) * (i / stops), stiffness, damping, mass) * 1000) / 1000));
  const spring = { easing: `linear(${points.join(", ")})`, durationMs };
  springs.set(key, spring);
  return spring;
}

const px = (value: number) => `${value}px`;

/** Motion tokens and choreography for a persona's motion style, scaled by its density. */
export function motionTokens(aesthetic: Pick<AestheticProfile, "motionStyle" | "density">): MotionTokens {
  const style: MotionStyle = STYLES[aesthetic.motionStyle] ? aesthetic.motionStyle : "smooth";
  const spec = STYLES[style];
  const scale = DENSITY_SCALE[aesthetic.density] ?? 1;
  const [nudge, shift, travel] = spec.distance.map((d) => Math.max(1, Math.round(d * scale)));
  const stagger = Math.max(10, Math.round((spec.stagger * scale) / 5) * 5);
  const spring = springEasing(spec.spring.stiffness, spec.spring.damping, spec.spring.mass);
  const springDuration = `${spring.durationMs}ms`;
  const curves = { ...spec.curves, emphasis: spec.curves.emphasis === "spring" ? spring.easing : spec.curves.emphasis };
  const enterEasing = spec.enter === "spring" ? spring.easing : spec.enter;
  const enterDuration = spec.enter === "spring" ? springDuration : spec.duration.base;
  const fade: MotionKeyframe[] = [{ opacity: 0 }, { opacity: 1 }];
  const ambient = `${spec.ambient}ms`;

  const arrive: Record<MotionStyle, string> = {
    smooth: `translateY(${px(shift)})`,
    snappy: `translateY(${px(shift)}) scale(0.98)`,
    liquid: `translateY(${px(shift)}) scale(0.96)`,
    mechanical: `translateX(${px(-shift)})`,
  };
  const leave: Record<MotionStyle, string> = {
    smooth: `translateY(${px(-Math.round(shift / 2))})`,
    snappy: `translateY(${px(-Math.round(shift / 2))}) scale(0.98)`,
    liquid: `translateY(${px(Math.round(shift / 2))}) scale(0.97)`,
    mechanical: `translateX(${px(shift)})`,
  };
  const hover: Record<MotionStyle, string> = {
    smooth: `translateY(${px(-nudge)})`,
    snappy: `translateY(${px(-nudge)})`,
    liquid: "scale(1.03)",
    mechanical: `translateX(${px(nudge * 2)})`,
  };
  // CSS eases each keyframe segment separately, so multi-step emphasis carries its
  // own wobble and uses a plain curve; the emphasis token is for two-state transitions.
  const emphasis: Record<MotionStyle, { keyframes: MotionKeyframe[]; easing: string }> = {
    smooth: { keyframes: [{ transform: "scale(1)" }, { transform: "scale(1.04)", offset: 0.4 }, { transform: "scale(1)" }], easing: curves.standard },
    snappy: { keyframes: [{ transform: "scale(1)" }, { transform: "scale(1.06)", offset: 0.3 }, { transform: "scale(1)" }], easing: curves.standard },
    liquid: { keyframes: [{ transform: "scale(1)" }, { transform: "scale(1.06, 0.95)", offset: 0.3 }, { transform: "scale(0.98, 1.03)", offset: 0.6 }, { transform: "scale(1)" }], easing: SINE },
    mechanical: { keyframes: [{ opacity: 1 }, { opacity: 0.35, offset: 0.25 }, { opacity: 1, offset: 0.5 }, { opacity: 0.35, offset: 0.75 }, { opacity: 1 }], easing: "steps(1, end)" },
  };
  const loops: Record<MotionStyle, Pick<MotionPrimitive, "use" | "keyframes" | "easing" | "direction">> = {
    smooth: {
      use: "Breathe: a slow swell of light and scale for glows and living surfaces.",
      keyframes: [{ opacity: 0.82, transform: "scale(1)" }, { opacity: 1, transform: "scale(1.015)" }],
      easing: SINE, direction: "alternate",
    },
    snappy: {
      use: "Flicker: a sign catching power, then a long readable hold.",
      keyframes: [{ opacity: 1 }, { opacity: 0.55, offset: 0.02 }, { opacity: 1, offset: 0.04 }, { opacity: 0.75, offset: 0.06 }, { opacity: 1, offset: 0.08 }, { opacity: 1 }],
      easing: "steps(1, end)", direction: "normal",
    },
    liquid: {
      use: "Drift: a blob that slowly changes shape and wanders.",
      keyframes: [
        { transform: "translate(0px, 0px) rotate(0deg)", borderRadius: "42% 58% 60% 40% / 45% 45% 55% 55%" },
        { transform: `translate(${px(nudge * 2)}, ${px(-nudge * 2)}) rotate(4deg)`, borderRadius: "58% 42% 40% 60% / 55% 60% 40% 45%" },
      ],
      easing: SINE, direction: "alternate",
    },
    mechanical: {
      use: "Tick: a stepped rotation, one notch a beat, like a clock.",
      keyframes: [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      easing: "steps(12, end)", direction: "normal",
    },
  };

  const move = (moment: MotionMoment, fields: Omit<MotionPrimitive, "name" | "iterations" | "direction"> & Partial<Pick<MotionPrimitive, "iterations" | "direction">>): MotionPrimitive =>
    ({ name: `baste-${moment}`, iterations: 1, direction: "normal", ...fields });

  return {
    duration: { ...spec.duration },
    easing: { ...spec.easing },
    character: MOTION_LANGUAGE[style].character,
    curves,
    spring: { ...spec.spring, easing: spring.easing, duration: springDuration },
    distance: { nudge: px(nudge), shift: px(shift), travel: px(travel) },
    pressScale: spec.pressScale,
    stagger: `${stagger}ms`,
    ambient,
    choreography: {
      enter: move("enter", {
        use: "Arrive: content, cards and panels coming into view.", trigger: "mount",
        keyframes: [{ opacity: 0, transform: arrive[style] }, { opacity: 1, transform: "none" }],
        duration: enterDuration, easing: enterEasing, reduced: fade,
      }),
      exit: move("exit", {
        use: "Leave: dismissals and content making way.", trigger: "unmount",
        keyframes: [{ opacity: 1, transform: "none" }, { opacity: 0, transform: leave[style] }],
        duration: spec.duration.fast, easing: curves.exit, reduced: [{ opacity: 1 }, { opacity: 0 }],
      }),
      hover: move("hover", {
        use: "Answer the pointer: lift, swell or slide toward the cursor.", trigger: "hover",
        keyframes: [{ transform: "none" }, { transform: hover[style] }],
        duration: spec.duration.fast, easing: style === "liquid" ? spring.easing : curves.standard, reduced: null,
      }),
      press: move("press", {
        use: "Confirm a press: the control gives under the finger.", trigger: "press",
        keyframes: [{ transform: "none" }, { transform: `scale(${spec.pressScale})` }],
        duration: spec.duration.fast, easing: curves.standard, reduced: null,
      }),
      emphasis: move("emphasis", {
        use: "Draw the eye once: a new badge, a saved state, a result.", trigger: "attention",
        ...emphasis[style], duration: spec.duration.slow, reduced: null,
      }),
      ambient: move("ambient", {
        ...loops[style], trigger: "loop", duration: ambient, iterations: "infinite", reduced: null,
      }),
    },
  };
}

/** The camera move for each persona camera, as prompts phrase it. */
export const CAMERA_MOVES: Record<PersonaAnimation["camera"], string> = {
  locked: "locked-off camera; only the scene moves",
  drift: "slow sideways camera drift",
  push: "slow push in",
  orbit: "slow orbit around the scene",
};

/** Seedance renders 2–12 s; one loop of the persona's ambient motion, within that. */
const LOOP_SECONDS = { min: 2, max: 12 };

/**
 * The persona's animation with nothing missing. A persona without one gets
 * defaults read off its aesthetic: motion style picks the camera, density the
 * depth, and the ambient loop the length.
 */
export function defaultAnimation(aesthetic: Pick<AestheticProfile, "motionStyle" | "density">): PersonaAnimation {
  const camera = ({ smooth: "drift", snappy: "locked", liquid: "orbit", mechanical: "push" } as const)[aesthetic.motionStyle] ?? "drift";
  const depth = ({ minimal: "deep", rich: "parallax", dense: "parallax", maximalist: "flat" } as const)[aesthetic.density] ?? "parallax";
  const ambient = STYLES[aesthetic.motionStyle]?.ambient ?? STYLES.smooth.ambient;
  return { motifs: [], subjects: [], depth, camera, focus: "background", loopSeconds: ambient / 1000, avoid: [] };
}

/** The persona's animation, completed from its aesthetic and with a renderable loop length. */
export function animationFor(persona: Pick<Persona, "aesthetic" | "animation">): PersonaAnimation {
  const base = defaultAnimation(persona.aesthetic);
  const own = persona.animation ?? {} as Partial<PersonaAnimation>;
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;
  const seconds = Number(own.loopSeconds ?? base.loopSeconds);
  return {
    motifs: Array.isArray(own.motifs) ? own.motifs.filter(Boolean) : [],
    subjects: Array.isArray(own.subjects) ? own.subjects.filter(Boolean) : [],
    depth: pick(own.depth, ["flat", "parallax", "deep"] as const, base.depth),
    camera: pick(own.camera, ["locked", "drift", "push", "orbit"] as const, base.camera),
    focus: pick(own.focus, ["background", "subject", "both"] as const, base.focus),
    loopSeconds: Math.min(LOOP_SECONDS.max, Math.max(LOOP_SECONDS.min, Number.isFinite(seconds) ? Math.round(seconds) : base.loopSeconds!)),
    avoid: Array.isArray(own.avoid) ? own.avoid.filter(Boolean) : [],
  };
}

/** The motion line for video prompts. */
export function videoMotionPhrase(style: MotionStyle): string {
  return (MOTION_LANGUAGE[style] ?? MOTION_LANGUAGE.smooth).video;
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** A primitive's keyframes as a CSS @keyframes block. */
export function keyframesCSS(name: string, keyframes: MotionKeyframe[]): string {
  const last = keyframes.length - 1;
  const blocks = keyframes.map((frame, i) => {
    const offset = typeof frame.offset === "number" ? frame.offset : last === 0 ? 1 : i / last;
    const declarations = Object.entries(frame).filter(([key]) => key !== "offset").map(([key, value]) => `${kebab(key)}: ${value};`).join(" ");
    return `  ${Math.round(offset * 1000) / 10}% { ${declarations} }`;
  });
  return `@keyframes ${name} {\n${blocks.join("\n")}\n}`;
}

/** Keyframes as the percentage-keyed object Tailwind and Panda configs take. */
export function keyframesObject(keyframes: MotionKeyframe[]): Record<string, Record<string, string>> {
  const last = keyframes.length - 1;
  return Object.fromEntries(keyframes.map((frame, i) => {
    const offset = typeof frame.offset === "number" ? frame.offset : last === 0 ? 1 : i / last;
    const props = Object.entries(frame).filter(([key]) => key !== "offset").map(([key, value]) => [key, String(value)]);
    return [`${Math.round(offset * 1000) / 10}%`, Object.fromEntries(props)];
  }));
}

/** The keyframed moves (not the pointer-state transitions), by @keyframes name. */
export function animatedPrimitives(m: MotionTokens): MotionPrimitive[] {
  return [m.choreography.enter, m.choreography.exit, m.choreography.emphasis, m.choreography.ambient];
}

/** CSS custom properties for every motion token, without the surrounding :root. */
export function motionVariables(m: MotionTokens): string[] {
  return [
    `--duration-fast: ${m.duration.fast};`,
    `--duration-base: ${m.duration.base};`,
    `--duration-slow: ${m.duration.slow};`,
    `--duration-slower: ${m.duration.slower};`,
    `--duration-spring: ${m.spring.duration};`,
    `--duration-ambient: ${m.ambient};`,
    `--ease-default: ${m.easing.default};`,
    `--ease-smooth: ${m.easing.smooth};`,
    `--ease-snappy: ${m.easing.snappy};`,
    `--ease-standard: ${m.curves.standard};`,
    `--ease-enter: ${m.curves.enter};`,
    `--ease-exit: ${m.curves.exit};`,
    `--ease-emphasis: ${m.curves.emphasis};`,
    `--ease-spring: ${m.spring.easing};`,
    `--motion-nudge: ${m.distance.nudge};`,
    `--motion-shift: ${m.distance.shift};`,
    `--motion-travel: ${m.distance.travel};`,
    `--motion-press: ${m.pressScale};`,
    `--motion-stagger: ${m.stagger};`,
  ];
}

/** The shorthand that plays a primitive as a CSS animation. */
export function animationShorthand(p: MotionPrimitive, name = p.name): string {
  return [name, p.duration, p.easing, p.iterations === "infinite" ? "infinite" : String(p.iterations), p.direction, "both"].join(" ");
}

/**
 * Keyframes and utility classes for a persona's motion primitives, with a
 * reduced-motion block that keeps fades and drops travel, emphasis and loops.
 */
export function exportMotionCSS(name: string, m: MotionTokens, opts: { variables?: boolean } = {}): string {
  const c = m.choreography;
  const stateRule = (selector: string, p: MotionPrimitive) => {
    const to = p.keyframes[p.keyframes.length - 1];
    const props = Object.keys(to).filter((key) => key !== "offset");
    return [
      `.motion-${p.trigger === "hover" ? "hover" : "press"} { transition-property: ${props.map(kebab).join(", ")}; transition-duration: ${p.duration}; transition-timing-function: ${p.easing}; }`,
      `${selector} { ${props.map((key) => `${kebab(key)}: ${to[key]};`).join(" ")} }`,
    ];
  };
  const stagger = Array.from({ length: 11 }, (_, i) => `.motion-stagger > :nth-child(${i + 2}) { animation-delay: calc(${i + 1} * var(--motion-stagger)); }`);
  const variables = opts.variables === false ? "" : `:root {\n${motionVariables(m).map((line) => `  ${line}`).join("\n")}\n}\n\n`;
  return `/* ${name} — motion primitives (generated by Baste)
 * ${m.character}
 * Classes: .motion-enter .motion-exit .motion-hover .motion-press .motion-emphasis .motion-ambient .motion-stagger
 */
${variables}${keyframesCSS(c.enter.name, c.enter.keyframes)}

${keyframesCSS(c.exit.name, c.exit.keyframes)}

${keyframesCSS(c.emphasis.name, c.emphasis.keyframes)}

${keyframesCSS(c.ambient.name, c.ambient.keyframes)}

/* ${c.enter.use} */
.motion-enter { animation: ${animationShorthand(c.enter)}; }

/* ${c.exit.use} */
.motion-exit { animation: ${animationShorthand(c.exit)}; }

/* ${c.hover.use} */
${stateRule(".motion-hover:hover", c.hover).join("\n")}

/* ${c.press.use} */
${stateRule(".motion-press:active", c.press).join("\n")}

/* ${c.emphasis.use} */
.motion-emphasis { animation: ${animationShorthand(c.emphasis)}; }

/* ${c.ambient.use} */
.motion-ambient { animation: ${animationShorthand(c.ambient)}; }

/* Sequence: the children of .motion-stagger enter one after another. */
.motion-stagger > * { animation: ${animationShorthand(c.enter)}; }
${stagger.join("\n")}

@media (prefers-reduced-motion: reduce) {
${keyframesCSS(`${c.enter.name}-reduced`, c.enter.reduced ?? [{ opacity: 1 }]).replace(/^/gm, "  ")}
${keyframesCSS(`${c.exit.name}-reduced`, c.exit.reduced ?? [{ opacity: 0 }]).replace(/^/gm, "  ")}
  .motion-enter, .motion-stagger > * { animation-name: ${c.enter.name}-reduced; animation-delay: 0s; }
  .motion-exit { animation-name: ${c.exit.name}-reduced; }
  .motion-hover, .motion-hover:hover, .motion-press, .motion-press:active { transform: none; transition: none; }
  .motion-emphasis, .motion-ambient { animation: none; }
}
`;
}
