/**
 * Moodboards: the reference images pinned to a persona in the Studio.
 * Stored as [key, board] pairs in .baste/moodboards.json; hosted accounts key
 * boards by a hash of their identity so one account never reads another's.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { accountKey } from "../notorganic/scope.js";

export interface MoodboardReference { id: string; src: string; tags: string[]; pinned: boolean; addedAt: number }

export interface Moodboard {
  personaId: string;
  references: MoodboardReference[];
  notes: string;
  vibe: string[];
}

export const MOODBOARD_FILE = ".baste/moodboards.json";

export function boardKey(id: string): string { return accountKey() ? `${accountKey()}:${id}` : id; }

/** Every saved board by key; older files stored bare boards keyed by persona. */
export function readMoodboards(): Map<string, Moodboard> {
  const boards = new Map<string, Moodboard>();
  if (!existsSync(resolve(MOODBOARD_FILE))) return boards;
  const data = JSON.parse(readFileSync(resolve(MOODBOARD_FILE), "utf-8")) as Array<Moodboard | [string, Moodboard]>;
  data.forEach((m) => Array.isArray(m) ? boards.set(m[0], m[1]) : boards.set(m.personaId, m));
  return boards;
}

/** The saved board for a persona in the current account scope, read fresh from disk. */
export function readMoodboard(personaId: string): Moodboard | undefined {
  try {
    return readMoodboards().get(boardKey(personaId));
  } catch {
    return undefined;
  }
}
