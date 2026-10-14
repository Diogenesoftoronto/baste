/**
 * Feedback Memory
 *
 * Per-persona feedback document that accumulates user upvotes/downvotes
 * with optional commentary. The judge consumes this document when scoring
 * subsequent assets, giving us a prompt-learning style feedback loop.
 *
 * Storage: .baste/feedback/<personaId>.jsonl (append-only)
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { accountPath } from "../notorganic/scope.js";

export interface FeedbackEntry {
  personaId: string;
  /** -1 (downvote) | 0 (neutral) | 1 (upvote) */
  score: number;
  /** Free-text rationale from the user */
  feedback: string;
  /** Asset descriptor at time of feedback */
  assetId?: string;
  assetType?: "svg" | "image" | "video";
  prompt?: string;
  /** Snapshot of the asset's evaluation features when ranked */
  features?: number[];
  /** Tag fragments the judge had labelled the asset with */
  tags?: string[];
  ts: number;
}

const FEEDBACK_DIR = ".baste/feedback";

function ensureDir(): string {
  const dir = accountPath("feedback", FEEDBACK_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function fileFor(personaId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(personaId)) throw new Error("Invalid persona id.");
  return join(ensureDir(), `${personaId}.jsonl`);
}

export function appendFeedback(entry: FeedbackEntry): void {
  const file = fileFor(entry.personaId);
  appendFileSync(file, JSON.stringify(entry) + "\n", "utf-8");
}

export function loadFeedback(personaId: string): FeedbackEntry[] {
  const file = fileFor(personaId);
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf-8").split("\n").filter(Boolean);
  const out: FeedbackEntry[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as FeedbackEntry);
    } catch {
      // Skip malformed line; this is append-only so old corrupted lines stay
    }
  }
  return out;
}

/**
 * Produce a structured document the judge can read.
 * Picks the most recent N entries, separates ups/downs/comments, and
 * surfaces the strongest patterns.
 */
export function buildLearnedPreferencesDocument(personaId: string, limit = 40): string {
  const entries = loadFeedback(personaId).slice(-limit);
  if (entries.length === 0) return "";

  const ups = entries.filter((e) => e.score > 0);
  const downs = entries.filter((e) => e.score < 0);

  const upPrompts = sample(ups.map((e) => e.prompt).filter(Boolean) as string[], 6);
  const downPrompts = sample(downs.map((e) => e.prompt).filter(Boolean) as string[], 6);
  const upComments = ups.map((e) => e.feedback).filter(Boolean).slice(-8);
  const downComments = downs.map((e) => e.feedback).filter(Boolean).slice(-8);

  const upTags = tally(ups.flatMap((e) => e.tags ?? []));
  const downTags = tally(downs.flatMap((e) => e.tags ?? []));

  const upFeatureAvg = averageFeatures(ups);
  const downFeatureAvg = averageFeatures(downs);

  const sections: string[] = [];
  sections.push(`## Learned Preferences (${entries.length} feedback events)`);
  sections.push(`The user has explicitly rated previous assets for this persona. Treat these signals as authoritative — adjust your scoring rubric accordingly.`);
  sections.push("");

  if (ups.length > 0) {
    sections.push(`### What the user upvoted (${ups.length} items)`);
    if (upTags.length) sections.push(`Tags they reward: ${upTags.slice(0, 8).map(([t, n]) => `${t}(${n})`).join(", ")}`);
    if (upFeatureAvg) sections.push(`Average feature position of upvotes: colorTemp=${upFeatureAvg[0].toFixed(2)} density=${upFeatureAvg[1].toFixed(2)} abstractness=${upFeatureAvg[2].toFixed(2)}`);
    if (upPrompts.length) {
      sections.push(`Prompts that worked:`);
      for (const p of upPrompts) sections.push(`  + ${p.slice(0, 140)}`);
    }
    if (upComments.length) {
      sections.push(`What they said they liked:`);
      for (const c of upComments) sections.push(`  + "${c.slice(0, 200)}"`);
    }
    sections.push("");
  }

  if (downs.length > 0) {
    sections.push(`### What the user downvoted (${downs.length} items)`);
    if (downTags.length) sections.push(`Tags they reject: ${downTags.slice(0, 8).map(([t, n]) => `${t}(${n})`).join(", ")}`);
    if (downFeatureAvg) sections.push(`Average feature position of downvotes: colorTemp=${downFeatureAvg[0].toFixed(2)} density=${downFeatureAvg[1].toFixed(2)} abstractness=${downFeatureAvg[2].toFixed(2)}`);
    if (downPrompts.length) {
      sections.push(`Prompts that failed:`);
      for (const p of downPrompts) sections.push(`  − ${p.slice(0, 140)}`);
    }
    if (downComments.length) {
      sections.push(`What they said they disliked:`);
      for (const c of downComments) sections.push(`  − "${c.slice(0, 200)}"`);
    }
    sections.push("");
  }

  sections.push(`### Scoring instructions`);
  sections.push(`When the asset under review resembles an upvoted pattern (matching tags, features, or stylistic cues from the prompts), bias personaAlignment UP by up to 0.1.`);
  sections.push(`When it resembles a downvoted pattern, bias personaAlignment DOWN by up to 0.15 and call this out in 'feedback' so the user sees you noticed.`);
  sections.push(`Do not invent feedback that contradicts these recorded preferences.`);

  return sections.join("\n");
}

function tally(items: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const t of items) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function averageFeatures(entries: FeedbackEntry[]): number[] | null {
  const withFeatures = entries.filter((e) => e.features && e.features.length >= 3);
  if (withFeatures.length === 0) return null;
  const dim = Math.min(...withFeatures.map((e) => e.features!.length));
  const avg = new Array(dim).fill(0);
  for (const e of withFeatures) for (let i = 0; i < dim; i++) avg[i] += e.features![i];
  return avg.map((v) => v / withFeatures.length);
}

function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  const taken = new Set<number>();
  while (out.length < n) {
    const i = Math.floor(Math.random() * arr.length);
    if (taken.has(i)) continue;
    taken.add(i);
    out.push(arr[i]);
  }
  return out;
}

/**
 * Summary used by the GUI feedback tab — totals + signature patterns.
 */
export function summarizeFeedback(personaId: string): {
  total: number;
  positive: number;
  negative: number;
  topUpTags: Array<{ tag: string; count: number }>;
  topDownTags: Array<{ tag: string; count: number }>;
  recent: FeedbackEntry[];
} {
  const entries = loadFeedback(personaId);
  const ups = entries.filter((e) => e.score > 0);
  const downs = entries.filter((e) => e.score < 0);
  return {
    total: entries.length,
    positive: ups.length,
    negative: downs.length,
    topUpTags: tally(ups.flatMap((e) => e.tags ?? [])).slice(0, 6).map(([tag, count]) => ({ tag, count })),
    topDownTags: tally(downs.flatMap((e) => e.tags ?? [])).slice(0, 6).map(([tag, count]) => ({ tag, count })),
    recent: entries.slice(-15).reverse(),
  };
}
