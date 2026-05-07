/**
 * Prompt Engineering Engine
 * 
 * Transform persona + asset type into optimized prompts for:
 * - SVG generation (QuiverAI)
 * - Image generation (DALL-E 3 / ChatGPT Image)
 * - Video generation (Veo 3)
 */

import type { Persona, AestheticProfile } from "../persona/types.js";

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
  const baseStyle = buildStyleDescription(aesthetic);
  const influence = selectRandomInfluence(persona.influences);

  const prompt = `${asset.purpose === "hero" ? "Stunning hero image" : "Detailed illustration"}: ${asset.description}

Style: ${baseStyle}

Channeling ${persona.name}'s aesthetic universe:
- Visual influences: ${influence}
- Emotional tone: ${aesthetic.moodKeywords.slice(0, 3).join(", ")}
- Core visual elements: ${aesthetic.visualKeywords.slice(0, 5).join(", ")}
- Subculture notes: ${persona.culture.subcultures.slice(0, 2).join(", ")}

Technical specs:
- ${aesthetic.colorTemperature} color temperature
- ${aesthetic.density} visual density
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

  const prompt = `Short cinematic loop (5 seconds): ${asset.description}

Motion style: ${aesthetic.motionStyle === "liquid" ? "Flowing, organic movement with smooth transitions" : aesthetic.motionStyle === "snappy" ? "Sharp, staccato movements with quick cuts" : "Smooth, gradual transitions"}

${persona.name}'s motion language:
- Rhythm: ${persona.influences.music.genres.slice(0, 2).join("-inspired, ")}-inspired pacing
- Texture: ${aesthetic.textureStyle} surface treatments in motion
- Energy: ${aesthetic.moodKeywords.slice(0, 2).join(" and ")}

Visual treatment:
- ${aesthetic.colorTemperature} palette in motion
- ${aesthetic.density === "maximalist" ? "Dense, layered visual complexity" : "Focused, intentional movement"}
- Atmospheric elements: ${influence}
- Camera feel: ${aesthetic.edgeStyle === "soft" ? "Soft focus, ethereal" : "Sharp, deliberate framing"}

Looped seamlessly. No text, no characters, pure visual atmosphere.
`;

  return {
    prompt,
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
function buildStyleDescription(aesthetic: AestheticProfile): string {
  const descriptors: string[] = [];

  // Color temperature
  const colorMap: Record<string, string> = {
    warm: "warm earth tones with amber and ochre highlights",
    cool: "cool steel blues with cyan and deep violet accents",
    neutral: "balanced neutral palette with subtle warm undertones",
    "high-contrast": "bold high-contrast with deep blacks and pure whites",
    muted: "soft muted pastels with desaturated elegance",
  };
  descriptors.push(colorMap[aesthetic.colorTemperature] || "balanced color palette");

  // Density
  if (aesthetic.density === "minimal") descriptors.push("generous negative space and breathing room");
  if (aesthetic.density === "maximalist") descriptors.push("rich visual density with layered elements");
  if (aesthetic.density === "dense") descriptors.push("information-dense with clear hierarchy");

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
export function mutatePrompt(
  basePrompt: string,
  persona: Persona,
  mutationRate: number
): string {
  let mutated = basePrompt;

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
    mutated = mutated.replace(
      /Inspired by .+\n/,
      `Inspired by ${newInfluence}\n`
    );
  }

  return mutated;
}
