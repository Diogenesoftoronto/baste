/**
 * Persona Builder - Programmatically construct personas with sensible defaults
 *
 * Creates a Persona by filling in required fields with defaults that can be
 * overridden. Essential for `baste create` and external integrations.
 */

import type { Persona, CulturalIdentity, Influences, Behaviors, AestheticProfile } from "./types.js";

export interface PersonaDraft {
  id: string;
  name: string;
  summary?: string;
  culture?: Partial<CulturalIdentity>;
  influences?: Partial<Influences>;
  behaviors?: Partial<Behaviors>;
  aesthetic?: Partial<AestheticProfile>;
}

const EMPTY_INFLUENCES: Influences = {
  films: [],
  shows: [],
  anime: [],
  music: { genres: [], artists: [] },
  games: [],
  visualArtists: [],
  fashion: [],
  spaces: [],
  tools: [],
  obsessions: [],
};

const EMPTY_BEHAVIORS: Behaviors = {
  discovery: [],
  interfaceValues: [],
  platforms: [],
  expression: [],
  petPeeves: [],
};

const DEFAULT_AESTHETIC: AestheticProfile = {
  colorTemperature: "neutral",
  density: "rich",
  edgeStyle: "soft",
  motionStyle: "smooth",
  typographyStyle: "expressive",
  textureStyle: "textured",
  iconStyle: "line",
  layoutStyle: "organic",
  visualKeywords: [],
  moodKeywords: [],
};

/**
 * Build a complete Persona from a draft, filling missing parts with defaults.
 */
export function buildPersona(draft: PersonaDraft): Persona {
  const influences: Influences = {
    ...EMPTY_INFLUENCES,
    ...draft.influences,
    music: {
      ...EMPTY_INFLUENCES.music,
      ...draft.influences?.music,
    },
  };

  const culture: CulturalIdentity = {
    subcultures: [],
    values: [],
    ...draft.culture,
  };

  const behaviors: Behaviors = {
    ...EMPTY_BEHAVIORS,
    ...draft.behaviors,
  };

  const aesthetic: AestheticProfile = {
    ...DEFAULT_AESTHETIC,
    ...draft.aesthetic,
    visualKeywords: draft.aesthetic?.visualKeywords ?? [],
    moodKeywords: draft.aesthetic?.moodKeywords ?? [],
  };

  return {
    id: draft.id,
    name: draft.name,
    summary: draft.summary ?? `A persona for ${draft.name}.`,
    culture,
    influences,
    behaviors,
    aesthetic,
  };
}

/**
 * Merge arrays without duplicates. Useful for extending a base persona.
 */
export function mergeUnique<T>(base: T[], extra: T[]): T[] {
  return [...new Set([...base, ...extra])];
}

/**
 * Create a new persona by extending a base persona.
 * The new persona inherits all fields and overlays customizations.
 */
export function extendPersona(base: Persona, overrides: PersonaDraft): Persona {
  const draft: PersonaDraft = {
    id: overrides.id,
    name: overrides.name,
    summary: overrides.summary ?? base.summary,
    culture: {
      region: overrides.culture?.region ?? base.culture.region,
      subcultures: mergeUnique(base.culture.subcultures, overrides.culture?.subcultures ?? []),
      values: mergeUnique(base.culture.values, overrides.culture?.values ?? []),
      language: overrides.culture?.language ?? base.culture.language,
    },
    influences: {
      films: mergeUnique(base.influences.films, overrides.influences?.films ?? []),
      shows: mergeUnique(base.influences.shows, overrides.influences?.shows ?? []),
      anime: mergeUnique(base.influences.anime, overrides.influences?.anime ?? []),
      music: {
        genres: mergeUnique(base.influences.music.genres, overrides.influences?.music?.genres ?? []),
        artists: mergeUnique(base.influences.music.artists, overrides.influences?.music?.artists ?? []),
      },
      games: mergeUnique(base.influences.games, overrides.influences?.games ?? []),
      visualArtists: mergeUnique(base.influences.visualArtists, overrides.influences?.visualArtists ?? []),
      fashion: mergeUnique(base.influences.fashion, overrides.influences?.fashion ?? []),
      spaces: mergeUnique(base.influences.spaces, overrides.influences?.spaces ?? []),
      tools: mergeUnique(base.influences.tools, overrides.influences?.tools ?? []),
      obsessions: mergeUnique(base.influences.obsessions, overrides.influences?.obsessions ?? []),
    },
    behaviors: {
      discovery: mergeUnique(base.behaviors.discovery, overrides.behaviors?.discovery ?? []),
      interfaceValues: mergeUnique(base.behaviors.interfaceValues, overrides.behaviors?.interfaceValues ?? []),
      platforms: mergeUnique(base.behaviors.platforms, overrides.behaviors?.platforms ?? []),
      expression: mergeUnique(base.behaviors.expression, overrides.behaviors?.expression ?? []),
      petPeeves: mergeUnique(base.behaviors.petPeeves, overrides.behaviors?.petPeeves ?? []),
    },
    aesthetic: {
      ...base.aesthetic,
      ...overrides.aesthetic,
      visualKeywords: mergeUnique(base.aesthetic.visualKeywords, overrides.aesthetic?.visualKeywords ?? []),
      moodKeywords: mergeUnique(base.aesthetic.moodKeywords, overrides.aesthetic?.moodKeywords ?? []),
    },
  };

  return buildPersona(draft);
}
