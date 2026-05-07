/**
 * Persona Engine - Defines how we capture and model user personas
 *
 * A persona represents the perfect user of an application - their culture,
 * influences, obsessions, aesthetic preferences, and identity.
 *
 * From this persona, we generate design directions that make an app
 * feel uniquely tailored rather than generic.
 */

export interface Persona {
  id: string;
  name: string;
  summary: string;

  // Cultural & Identity anchors
  culture: CulturalIdentity;

  // Media & aesthetic influences
  influences: Influences;

  // Behavioral patterns
  behaviors: Behaviors;

  // Visual language preferences (extracted from above)
  aesthetic: AestheticProfile;
}

export interface CulturalIdentity {
  // Geographic/regional cultural context
  region?: string;
  // Subcultures they identify with
  subcultures: string[];
  // Values that drive their choices
  values: string[];
  // Languages, dialects, vernacular
  language?: {
    primary: string;
    vernacular: string[]; // slang, expressions they use
  };
}

export interface Influences {
  // Movies, TV shows, anime they love
  films: string[];
  shows: string[];
  anime: string[];

  // Music & audio culture
  music: {
    genres: string[];
    artists: string[];
  };

  // Games, interactive experiences
  games: string[];

  // Visual artists, designers, studios
  visualArtists: string[];

  // Fashion, brands, aesthetics
  fashion: string[];

  // Architecture, spaces, environments
  spaces: string[];

  // Tech/tools they love using
  tools: string[];

  // Nerdy obsessions - the deep dives
  obsessions: string[];
}

export interface Behaviors {
  // How they discover things
  discovery: string[];

  // What they value in interfaces
  interfaceValues: string[];

  // Their daily digital habitats
  platforms: string[];

  // How they express themselves
  expression: string[];

  // What annoys them about generic UIs
  petPeeves: string[];
}

export interface AestheticProfile {
  // Color tendencies (will be generated from persona)
  colorTemperature: "warm" | "cool" | "neutral" | "high-contrast" | "muted";
  density: "minimal" | "dense" | "rich" | "maximalist";
  edgeStyle: "sharp" | "soft" | "organic" | "geometric" | "brutalist";
  motionStyle: "smooth" | "snappy" | "liquid" | "mechanical";
  typographyStyle: "clean" | "expressive" | "retro" | "futuristic" | "handcrafted";
  textureStyle: "flat" | "textured" | "noisy" | "clean" | "grainy";
  iconStyle: "line" | "filled" | "hand-drawn" | "geometric" | "abstract";
  layoutStyle: "grid" | "organic" | "asymmetric" | "brutalist" | "editorial";

  // Generated keywords for prompting
  visualKeywords: string[];
  moodKeywords: string[];
}

/**
 * Extract aesthetic profile from full persona using keyword inference.
 */
export function extractAestheticFromPersona(persona: Persona): AestheticProfile {
  const keywords = generateVisualKeywords(persona);

  return {
    colorTemperature: inferColorTemperature(persona),
    density: inferDensity(persona),
    edgeStyle: "soft",
    motionStyle: "smooth",
    typographyStyle: "expressive",
    textureStyle: "textured",
    iconStyle: "line",
    layoutStyle: "organic",
    visualKeywords: keywords.visual,
    moodKeywords: keywords.mood,
  };
}

function generateVisualKeywords(persona: Persona): { visual: string[]; mood: string[] } {
  const influences = persona.influences;
  const keywords: string[] = [];
  const moods: string[] = [];

  // Extract from media influences
  keywords.push(
    ...influences.films.slice(0, 3),
    ...influences.anime.slice(0, 3),
    ...influences.visualArtists.slice(0, 3)
  );

  // Add subculture visual language
  keywords.push(...persona.culture.subcultures.slice(0, 3));

  // Add fashion/space aesthetics
  keywords.push(
    ...influences.fashion.slice(0, 2),
    ...influences.spaces.slice(0, 2)
  );

  // Generate moods from values and behaviors
  moods.push(...persona.culture.values.slice(0, 4));
  moods.push(...persona.behaviors.interfaceValues.slice(0, 3));

  return {
    visual: [...new Set(keywords)].filter(Boolean),
    mood: [...new Set(moods)].filter(Boolean),
  };
}

function inferColorTemperature(persona: Persona): AestheticProfile["colorTemperature"] {
  const allText = JSON.stringify(persona).toLowerCase();

  if (/warm|sun|desert|orange|amber|gold|earth|terracotta/.test(allText)) return "warm";
  if (/cool|ice|blue|cyan|teal|ocean|night/.test(allText)) return "cool";
  if (/contrast|bold|black.*white|monochrome/.test(allText)) return "high-contrast";
  if (/pastel|soft|pink|cream|beige/.test(allText)) return "muted";

  return "neutral";
}

function inferDensity(persona: Persona): AestheticProfile["density"] {
  const allText = JSON.stringify(persona).toLowerCase();

  if (/minimal|clean|simple|space|breathing|white|empty/.test(allText)) return "minimal";
  if (/maximal|clutter|busy|pattern|rich|dense|full/.test(allText)) return "maximalist";
  if (/information|data|dashboard|tool|editor/.test(allText)) return "dense";

  return "rich";
}
