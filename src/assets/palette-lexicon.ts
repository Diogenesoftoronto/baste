import type { Persona } from "../persona/types.js";
import type { Oklch } from "./oklch.js";

interface ColorEntry { triggers: string[]; anchors: Oklch[]; night: number }
const entry = (triggers: string[], anchors: number[][], night = 0): ColorEntry => ({
  triggers, anchors: anchors.map(([l, c, h]) => ({ l, c, h })), night,
});

export const COLOR_LEXICON: ColorEntry[] = [
  entry(["bioluminesc"], [[0.86, 0.17, 165], [0.78, 0.14, 200]], 1),
  entry(["mycel", "fung", "mushroom", "mushishi"], [[0.74, 0.07, 80], [0.55, 0.06, 60]]),
  entry(["haeckel", "radiolaria", "deep sea"], [[0.55, 0.10, 195], [0.70, 0.15, 30]]),
  entry(["solarpunk", "solar"], [[0.62, 0.16, 140], [0.82, 0.16, 90]], -1),
  entry(["herbari", "natural dye", "botan"], [[0.58, 0.09, 125], [0.62, 0.12, 45]], -1),
  entry(["generative growth", "moss", "forest"], [[0.52, 0.11, 145]]),
  entry(["night market", "lantern"], [[0.60, 0.21, 28], [0.80, 0.16, 75]], 2),
  entry(["neon"], [[0.66, 0.27, 350], [0.85, 0.17, 195]], 2),
  entry(["city pop"], [[0.72, 0.15, 40], [0.70, 0.12, 215]], 1),
  entry(["chungking", "wong kar"], [[0.70, 0.17, 140], [0.60, 0.20, 25]], 1),
  entry(["yakuza", "kabukicho"], [[0.55, 0.22, 15], [0.80, 0.14, 85]], 1),
  entry(["akira", "otomo"], [[0.58, 0.23, 27]], 1),
  entry(["street food", "chili"], [[0.66, 0.19, 45]]),
  entry(["vintage sportswear"], [[0.50, 0.13, 260], [0.78, 0.15, 95]]),
  entry(["vaporwave"], [[0.75, 0.17, 340], [0.80, 0.11, 195]], 1),
  entry(["lain", "serial experiments"], [[0.45, 0.10, 300], [0.85, 0.05, 110]], 2),
  entry(["liminal", "abandoned mall", "backrooms"], [[0.88, 0.10, 100], [0.55, 0.07, 200]], 1),
  entry(["yume nikki"], [[0.55, 0.16, 320]], 1),
  entry(["glitch"], [[0.70, 0.25, 330], [0.85, 0.15, 190]], 1),
  entry(["vhs"], [[0.62, 0.09, 250]], 1),
  entry(["old internet", "geocities", "web 1.0"], [[0.45, 0.25, 265], [0.60, 0.24, 330]]),
  entry(["wabi-sabi", "decay", "rust"], [[0.58, 0.08, 55]], -1),
  entry(["cyberpunk", "blade runner"], [[0.65, 0.22, 330], [0.78, 0.14, 210]], 2),
  entry(["ghibli", "pastoral"], [[0.72, 0.11, 130], [0.80, 0.09, 230]], -1),
  entry(["brutalis", "concrete"], [[0.60, 0.01, 250]]),
  entry(["synthwave", "outrun"], [[0.62, 0.25, 320], [0.80, 0.15, 60]], 2),
  entry(["ocean", "surf", "coastal"], [[0.62, 0.11, 220]], -1),
  entry(["desert", "terracotta"], [[0.62, 0.13, 45]], -1),
];

export const FONT_BASES = {
  clean: { heading: "Inter Tight", body: "Inter", mono: "JetBrains Mono" },
  expressive: { heading: "Bricolage Grotesque", body: "Instrument Sans", mono: "Fira Code" },
  retro: { heading: "Space Mono", body: "IBM Plex Sans", mono: "VT323" },
  futuristic: { heading: "Chakra Petch", body: "Inter", mono: "JetBrains Mono" },
  handcrafted: { heading: "Fraunces", body: "Source Serif 4", mono: "Fira Code" },
};

export const FONT_OVERRIDES = [
  { triggers: ["night market", "kabukicho", "yakuza", "chungking", "tokyo", "akira"], heading: "Dela Gothic One" },
  { triggers: ["lain", "glitch", "vhs", "old internet"], heading: "VT323" },
  { triggers: ["vaporwave", "synthwave", "outrun"], heading: "Monoton" },
  { triggers: ["haeckel", "herbari", "botan"], heading: "Fraunces" },
  { triggers: ["brutalis"], heading: "Archivo Black" },
];

export interface CorpusTerm { text: string; weight: number }

export function culturalCorpus(persona: Persona): CorpusTerm[] {
  const { aesthetic, influences, culture } = persona;
  const terms = (texts: string[], weight: number) => texts.map((text) => ({ text: text.toLowerCase(), weight }));
  return [
    ...terms(aesthetic.visualKeywords, 3),
    ...terms([...influences.spaces, ...culture.subcultures, ...influences.obsessions], 2),
    ...terms([
      ...influences.films, ...influences.anime, ...influences.shows, ...influences.games,
      ...influences.visualArtists, ...influences.music.genres, ...influences.fashion, ...aesthetic.moodKeywords,
    ], 1),
  ];
}

/** Each matching trigger contributes the weight of its corpus term once. */
export function scoreTriggers(corpus: CorpusTerm[], triggers: string[]): number {
  return corpus.reduce((score, term) => score + triggers.filter((trigger) => term.text.includes(trigger)).length * term.weight, 0);
}
