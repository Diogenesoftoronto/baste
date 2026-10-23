import type { Persona } from "../persona/types.js";
import { clairic, estimateOf, presentText, type ClairicField, type ClairicResult, type Interval } from "./clairic.js";

/**
 * What Clairic says about a page and its samples, and why a sample matters to
 * an audience. "Why" is one calibrated estimate per persona trait ("how
 * strongly this shows: information density"), so every reason is a named
 * trait with an interval rather than generated prose; the person adds their
 * own reason in words when they keep a sample.
 *
 * Reading and judging are separate calls. Words are read with an empty state:
 * with any state, an absent value comes back as a quote of the state rather
 * than null (measured: "A screenshot of an inter" as a button label).
 */

export interface Trait { id: string; label: string; kind: "value" | "look" | "peeve" }
export interface TraitReading extends Trait, Interval {}

export interface PageReading {
  headline: string | null;
  primaryAction: string | null;
  navigation: string[];
  density: Interval | null;
  cornerRadius: Interval | null;
}

export interface Judgement { relevance: Interval; traits: TraitReading[] }

const png = (data: Buffer) => ({ data, contentType: "image/png" as const });
const scale = (instructions: string): ClairicField => ({ type: "estimate", min: 0, max: 10, step: 1, instructions });

/** What the audience cares about, as short phrases Clairic can score: values, looks, then pet peeves. */
export function traitsOf(persona: Persona): Trait[] {
  const clip = (text: string) => text.trim().replace(/\s+/g, " ").slice(0, 80);
  const pick = (items: string[] | undefined, kind: Trait["kind"], n: number) =>
    [...new Set((items ?? []).map(clip).filter(Boolean))].slice(0, n).map((label) => ({ label, kind }));
  return [
    ...pick(persona.behaviors?.interfaceValues, "value", 4),
    ...pick([...(persona.aesthetic?.visualKeywords ?? []), ...(persona.aesthetic?.moodKeywords ?? [])], "look", 3),
    ...pick(persona.behaviors?.petPeeves, "peeve", 3),
  ].map((trait, i) => ({ id: `t${i}`, ...trait }));
}

/** The audience in a few lines, as the state relevance is judged against. */
export function describe(persona: Persona): string {
  const i = persona.influences;
  return [
    `Audience: ${persona.name}. ${persona.summary}`,
    `Spaces: ${i.spaces.slice(0, 5).join("; ")}.`,
    `Obsessions: ${i.obsessions.slice(0, 5).join("; ")}.`,
    `Values in interfaces: ${persona.behaviors.interfaceValues.slice(0, 5).join("; ")}.`,
    `Pet peeves: ${persona.behaviors.petPeeves.slice(0, 5).join("; ")}.`,
    `Mood: ${persona.aesthetic.moodKeywords.slice(0, 6).join("; ")}.`,
  ].join("\n");
}

export interface Reader {
  /** Clairic, or a test double. */
  run: (request: Parameters<typeof clairic>[0]) => Promise<ClairicResult>;
  tokens: number;
}

export function reader(signal?: AbortSignal): Reader {
  const r: Reader = { tokens: 0, run: async (request) => { const result = await clairic(request, { signal }); r.tokens += result.inputTokens; return result; } };
  return r;
}

export async function readPage(r: Reader, screenshot: Buffer): Promise<PageReading> {
  const { answers } = await r.run({
    state: "",
    images: [png(screenshot)],
    fields: {
      headline: { type: "text", instructions: "The main headline written on the screen" },
      primary_action: { type: "text", instructions: "Label of the most prominent call-to-action button" },
      navigation: { type: "list", items: "text", instructions: "Labels of the top navigation links, left to right" },
      density: scale("Visual density from 0 (sparse, lots of space) to 10 (packed)"),
      corner_radius: { type: "estimate", min: 0, max: 32, step: 1, instructions: "Typical button corner radius in pixels" },
    },
  });
  const nav = answers.navigation;
  return {
    headline: presentText(answers.headline),
    primaryAction: presentText(answers.primary_action),
    // Single characters are fragments of text the model could not read whole.
    navigation: nav?.type === "list" && nav.confidence >= 0.5 ? nav.value.map((v) => v.trim()).filter((v) => [...v].length >= 2).slice(0, 12) : [],
    density: estimateOf(answers.density),
    cornerRadius: estimateOf(answers.corner_radius),
  };
}

/** Words written in a crop, or null. */
export async function readText(r: Reader, image: Buffer): Promise<string | null> {
  const { answers } = await r.run({
    state: "",
    images: [png(image)],
    fields: { visible_text: { type: "text", instructions: "Words written inside the image" } },
  });
  return presentText(answers.visible_text, 0.2);
}

/** How much the audience would want this, and how strongly it shows each of their traits. */
export async function judge(r: Reader, image: Buffer, persona: Persona, traits: Trait[], subject: "screen" | "element"): Promise<Judgement | null> {
  const what = subject === "screen" ? "this screen's design" : "this design element";
  const fields: Record<string, ClairicField> = {
    relevance: scale(`How much this audience would want ${what} in their own interface, 0 to 10`),
    ...Object.fromEntries(traits.map((t) => [t.id, scale(`How strongly ${what} shows: ${t.label}. 0 not at all, 10 completely`)])),
  };
  const { answers } = await r.run({ state: describe(persona), images: [png(image)], fields });
  const relevance = estimateOf(answers.relevance);
  if (!relevance) return null;
  return {
    relevance,
    traits: traits.flatMap((t) => { const e = estimateOf(answers[t.id]); return e ? [{ ...t, ...e }] : []; }),
  };
}

/** The traits that explain a judgement: strongest values and looks, and any peeve shown clearly. */
export function reasons(traits: TraitReading[], n = 3): { fits: TraitReading[]; clashes: TraitReading[] } {
  return {
    fits: traits.filter((t) => t.kind !== "peeve" && t.p10 >= 4).sort((a, b) => b.median - a.median || b.p10 - a.p10).slice(0, n),
    clashes: traits.filter((t) => t.kind === "peeve" && t.p10 >= 4).sort((a, b) => b.median - a.median).slice(0, n),
  };
}

/** Run tasks with at most `limit` in flight, keeping their order. */
export async function pool<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await task(items[i], i); }
  }));
  return out;
}
