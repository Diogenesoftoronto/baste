/**
 * Prompt Engineering Engine
 * 
 * Transform persona + asset type into optimized prompts for:
 * - SVG generation (QuiverAI)
 * - Image generation (DALL-E 3 / ChatGPT Image)
 * - Video generation (Veo 3)
 */

import type { Persona, AestheticProfile } from "../persona/types.js";
import { CAMERA_MOVES, MOTION_LANGUAGE, animationFor } from "../assets/motion.js";

export interface AssetType {
  kind: "svg" | "image" | "video";
  purpose: string; // "icon", "illustration", "background", "hero", "component", "animation"
  description: string;
  constraints?: {
    style?: string;
    aspectRatio?: string;
    size?: string;
    colors?: string[];
  };
}

export interface GeneratedPrompt {
  prompt: string;
  negativePrompt?: string;
  parameters: Record<string, unknown>;
  systemContext: string;
}

/**
 * Generate prompts optimized for each generation service
 */
export function generatePrompts(
  persona: Persona,
  asset: AssetType
): Record<string, GeneratedPrompt> {
  const aesthetic = persona.aesthetic;

  return {
    svg: generateSVGPrompt(persona, aesthetic, asset),
    image: generateImagePrompt(persona, aesthetic, asset),
    video: generateVideoPrompt(persona, aesthetic, asset),
  };
}

function generateSVGPrompt(
  persona: Persona,
  aesthetic: AestheticProfile,
  asset: AssetType
): GeneratedPrompt {
  const baseStyle = buildStyleDescription(aesthetic);
  const influence = selectRandomInfluence(persona.influences);

  const prompt = `Create an ${asset.purpose} SVG in the style of ${baseStyle}.

Visual concept: ${asset.description}

Inspired by ${persona.name}'s world:
- Influences: ${influence}
- Mood: ${aesthetic.moodKeywords.slice(0, 3).join(", ")}
- Visual DNA: ${aesthetic.visualKeywords.slice(0, 4).join(", ")}

Requirements:
- Clean, scalable vector paths
- ${aesthetic.colorTemperature} color palette
- ${aesthetic.density === "minimal" ? "Minimal detail, generous negative space" : "Rich detail, layered elements"}
- ${aesthetic.edgeStyle === "organic" ? "Flowing, organic curves" : "Sharp, defined edges"}
- Style should feel ${aesthetic.textureStyle}
- Must work on both light and dark backgrounds
- No text unless essential to the concept

Output as clean SVG code with proper viewBox.
`;

  return {
    prompt,
    negativePrompt: "raster, pixelated, blurry, text-heavy, gradients, complex shadows",
    parameters: {
      format: "svg",
      style: "flat",
      complexity: aesthetic.density === "minimal" ? "low" : "medium",
    },
    systemContext: `You are an expert SVG designer who creates ${persona.culture.subcultures[0]}-inspired vector graphics. You understand the visual language of ${aesthetic.visualKeywords[0]} and translate cultural influences into scalable icons and illustrations.`,
  };
}

function generateImagePrompt(
  persona: Persona,
  aesthetic: AestheticProfile,
  asset: AssetType
): GeneratedPrompt {
  const baseStyle = buildStyleDescription(aesthetic, { palette: false });
  const influence = selectRandomInfluence(persona.influences);
  const [temperature, density, rendering] = axisStart(aesthetic);

  // The three variation lines come first so they steer the image; QD mutation
  // moves them along the archive's axes (see mutatePrompt).
  const prompt = `${asset.purpose === "hero" ? "Stunning hero image" : "Detailed illustration"}: ${asset.description}

Variation:
- ${temperature} color temperature
- ${density} visual density
- ${rendering} rendering

Style: ${baseStyle}

Channeling ${persona.name}'s aesthetic universe:
- Visual influences: ${influence}
- Emotional tone: ${aesthetic.moodKeywords.slice(0, 3).join(", ")}
- Core visual elements: ${aesthetic.visualKeywords.slice(0, 5).join(", ")}
- Subculture notes: ${persona.culture.subcultures.slice(0, 2).join(", ")}

Technical specs:
- ${aesthetic.edgeStyle} edge treatment
- ${aesthetic.textureStyle} surface quality
- Aspect ratio: ${asset.constraints?.aspectRatio || "16:9"}
- No UI text, no watermarks, no borders

Create something that feels like it belongs in ${persona.influences.films[0] || "a dreamscape"} as interpreted by ${persona.influences.visualArtists[0] || "a visionary designer"}.
`;

  return {
    prompt,
    negativePrompt: "generic, stock photo, corporate, sterile, clip art, watermark, text, UI elements, border, frame",
    parameters: {
      model: "gpt-image-2",
      size: asset.constraints?.size || "1024x1024",
      quality: "high",
      style: "vivid",
    },
    systemContext: `You are a visionary digital artist creating ${persona.culture.subcultures[0]}-inspired imagery. Your work is influenced by ${aesthetic.visualKeywords.slice(0, 3).join(", ")}.`,
  };
}

function generateVideoPrompt(
  persona: Persona,
  aesthetic: AestheticProfile,
  asset: AssetType
): GeneratedPrompt {
  const influence = selectRandomInfluence(persona.influences);
  const animation = animationFor(persona);
  const moves = animation.motifs.length ? `\n- What moves: ${animation.motifs.slice(0, 3).join("; ")}` : "";

  const prompt = `Short cinematic loop (5 seconds): ${asset.description}

Motion style: ${MOTION_LANGUAGE[aesthetic.motionStyle]?.character ?? MOTION_LANGUAGE.smooth.character}

${persona.name}'s motion language:
- Rhythm: ${persona.influences.music.genres.slice(0, 2).join("-inspired, ")}-inspired pacing
- Texture: ${aesthetic.textureStyle} surface treatments in motion
- Energy: ${aesthetic.moodKeywords.slice(0, 2).join(" and ")}${moves}

Visual treatment:
- ${aesthetic.colorTemperature} palette in motion
- ${aesthetic.density === "maximalist" ? "Dense, layered visual complexity" : "Focused, intentional movement"}
- Atmospheric elements: ${influence}
- Camera feel: ${aesthetic.edgeStyle === "soft" ? "Soft focus, ethereal" : "Sharp, deliberate framing"}
- Camera move: ${CAMERA_MOVES[animation.camera]}

Looped seamlessly. No text, no characters, pure visual atmosphere.${animation.avoid.length ? `\nAvoid: ${animation.avoid.join(", ")}.` : ""}
`;

  return {
    prompt,
    ...(animation.avoid.length ? { negativePrompt: animation.avoid.join(", ") } : {}),
    parameters: {
      model: "veo-3",
      duration: 5,
      aspectRatio: asset.constraints?.aspectRatio || "16:9",
      quality: "1080p",
    },
    systemContext: `You are a motion designer creating ${aesthetic.visualKeywords[0]}-inspired ambient video loops. You understand how ${persona.influences.music.genres[0]} music would visually manifest as movement and light.`,
  };
}

/**
 * Build a coherent style description from aesthetic profile
 */
function buildStyleDescription(aesthetic: AestheticProfile, opts: { palette?: boolean } = {}): string {
  const descriptors: string[] = [];
  const palette = opts.palette ?? true;

  // Color temperature
  const colorMap: Record<string, string> = {
    warm: "warm earth tones with amber and ochre highlights",
    cool: "cool steel blues with cyan and deep violet accents",
    neutral: "balanced neutral palette with subtle warm undertones",
    "high-contrast": "bold high-contrast with deep blacks and pure whites",
    muted: "soft muted pastels with desaturated elegance",
  };
  if (palette) descriptors.push(colorMap[aesthetic.colorTemperature] || "balanced color palette");

  // Density
  if (palette && aesthetic.density === "minimal") descriptors.push("generous negative space and breathing room");
  if (palette && aesthetic.density === "maximalist") descriptors.push("rich visual density with layered elements");
  if (palette && aesthetic.density === "dense") descriptors.push("information-dense with clear hierarchy");

  // Texture
  const textureMap: Record<string, string> = {
    flat: "flat graphic design aesthetic",
    textured: "organic textured surfaces with visible grain",
    noisy: "intentional noise and grain texture",
    clean: "pristine clean surfaces",
    grainy: "film grain and analog texture",
  };
  descriptors.push(textureMap[aesthetic.textureStyle] || "clean surfaces");

  // Edge
  if (aesthetic.edgeStyle === "organic") descriptors.push("flowing organic edges");
  if (aesthetic.edgeStyle === "sharp") descriptors.push("sharp geometric precision");
  if (aesthetic.edgeStyle === "brutalist") descriptors.push("raw brutalist edges");

  // Typography influence (for layout context)
  const typeMap: Record<string, string> = {
    clean: "Swiss modernist sensibility",
    expressive: "expressive editorial typography",
    retro: "vintage mid-century influences",
    futuristic: "speculative future aesthetic",
    handcrafted: "artisanal hand-crafted quality",
  };
  descriptors.push(typeMap[aesthetic.typographyStyle] || "clear typographic hierarchy");

  return descriptors.join(", ");
}

/**
 * Select a random influence anchor from persona
 */
function selectRandomInfluence(influences: Persona["influences"]): string {
  const options = [
    ...influences.films.map((f) => `the visual language of "${f}"`),
    ...influences.anime.map((a) => `"${a}" aesthetic`),
    ...influences.visualArtists.map((v) => `${v}'s artistic approach`),
    ...influences.games.map((g) => `the immersive world of "${g}"`),
    ...influences.spaces.map((s) => `the atmosphere of ${s}`),
    ...influences.obsessions.map((o) => `the obsessive detail of ${o}`),
  ];

  return options[Math.floor(Math.random() * options.length)] || "dreamlike visual poetry";
}

/**
 * Mutate a prompt for QD exploration
 * Slightly alter style elements while keeping core concept
 */
/**
 * The QD archive's three axes, each as ordered steps a prompt can move along.
 * The persona's own position is where a fitting starts; mutation explores its
 * neighbours so the archive fills with real alternatives, not one look repeated.
 */
const TEMPERATURE = ["icy blue and violet", "cool teal and slate", "muted, desaturated", "neutral, balanced", "warm amber and terracotta", "deep ember orange and red"];
const DENSITY = ["almost empty, one subject", "sparse, generous negative space", "balanced", "rich, layered", "dense, packed with detail", "maximalist, every surface busy"];
const RENDERING = ["literal, photographic", "cinematic, lightly stylised", "illustrative, painterly", "graphic, flat-shaded", "abstract, pattern-led"];

/** Where a persona's own aesthetic sits on each axis: the centre of its fitting. */
function axisStart(aesthetic: AestheticProfile): [string, string, string] {
  const temperature = { cool: 1, muted: 2, neutral: 3, "high-contrast": 3, warm: 4 }[aesthetic.colorTemperature] ?? 3;
  const density = { minimal: 1, rich: 3, dense: 4, maximalist: 5 }[aesthetic.density] ?? 3;
  const rendering = aesthetic.density === "minimal" ? 2 : 1;
  return [TEMPERATURE[temperature], DENSITY[density], RENDERING[rendering]];
}

/** One step along an archive axis: which axis, from where to where, and the rewritten prompt. */
export interface AxisStep {
  axis: "color temperature" | "visual density" | "rendering";
  from: string;
  to: string;
  prompt: string;
}

const AXES: Array<[RegExp, string[], AxisStep["axis"]]> = [
  [/^- (.+) color temperature$/m, TEMPERATURE, "color temperature"],
  [/^- (.+) visual density$/m, DENSITY, "visual density"],
  [/^- (.+) rendering$/m, RENDERING, "rendering"],
];

/** Move one axis line up or down its scale by one or two steps, bouncing off either end. */
function stepAlong(prompt: string, [line, steps, axis]: (typeof AXES)[number]): AxisStep | undefined {
  const match = line.exec(prompt);
  if (!match) return undefined;
  const found = steps.indexOf(match[1]);
  const from = found >= 0 ? found : Math.floor(steps.length / 2);
  const size = Math.random() < 0.3 ? 2 : 1;
  let to = from + (Math.random() < 0.5 ? -size : size);
  if (to < 0 || to >= steps.length) to = from + (to < 0 ? size : -size);
  return { axis, from: steps[from], to: steps[to], prompt: prompt.replace(line, `- ${steps[to]} ${axis}`) };
}

/**
 * One step along a random archive axis the prompt carries. An edit makes the
 * same move in pixels that the rewritten prompt describes, so they agree.
 */
export function axisStep(prompt: string): AxisStep | undefined {
  const axes = AXES.filter(([line]) => line.test(prompt));
  return axes.length ? stepAlong(prompt, axes[Math.floor(Math.random() * axes.length)]) : undefined;
}

export function mutatePrompt(
  basePrompt: string,
  persona: Persona,
  mutationRate: number
): string {
  let mutated = basePrompt;

  // Explore the archive's feature space: colour temperature, density, abstraction.
  const before = mutated;
  for (const axis of AXES) {
    if (Math.random() < mutationRate) mutated = stepAlong(mutated, axis)?.prompt ?? mutated;
  }
  // Every child moves somewhere in feature space, or the archive cannot grow.
  if (mutated === before) {
    mutated = stepAlong(mutated, AXES[Math.floor(Math.random() * AXES.length)])?.prompt ?? mutated;
  }

  // Swap visual keywords
  if (Math.random() < mutationRate) {
    const keywords = persona.aesthetic.visualKeywords;
    const swap1 = keywords[Math.floor(Math.random() * keywords.length)];
    const swap2 = keywords[Math.floor(Math.random() * keywords.length)];
    mutated = mutated.replace(swap1, swap2);
  }

  // Alter mood keywords
  if (Math.random() < mutationRate) {
    const moods = persona.aesthetic.moodKeywords;
    const newMood = moods[Math.floor(Math.random() * moods.length)];
    mutated = mutated.replace(
      /Emotional tone: .+/,
      `Emotional tone: ${newMood}`
    );
  }

  // Swap influence
  if (Math.random() < mutationRate) {
    const newInfluence = selectRandomInfluence(persona.influences);
    mutated = mutated
      .replace(/Inspired by .+\n/, `Inspired by ${newInfluence}\n`)
      .replace(/- Visual influences: .+/, `- Visual influences: ${newInfluence}`);
  }

  return mutated;
}
