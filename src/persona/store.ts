/**
 * Persona Store - Unified registry for built-in and custom personas
 *
 * Built-in personas ship with the library as templates.
 * Custom personas are loaded from JSON files in a user-defined directory.
 *
 * Priority: Custom personas override built-in personas with the same id.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import type { Persona } from "./types.js";
import { basePersonas } from "./base-personas.js";

const DEFAULT_CUSTOM_DIR = resolve(process.cwd(), "personas");

export interface StoreConfig {
  /** Directory to load/save custom personas */
  customDir?: string;
}

let storeConfig: StoreConfig = { customDir: DEFAULT_CUSTOM_DIR };
let customPersonas: Map<string, Persona> = new Map();
let initialized = false;

/** Ensure custom personas directory exists */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Load all custom persona JSON files from the directory */
function loadCustomPersonas(dir: string): Map<string, Persona> {
  const map = new Map<string, Persona>();
  if (!existsSync(dir)) return map;

  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), "utf-8");
      const persona: Persona = JSON.parse(content);
      if (persona.id) {
        map.set(persona.id, persona);
      }
    } catch {
      // Skip invalid files silently
    }
  }
  return map;
}

/** Initialize or reinitialize the store */
export function initStore(config?: StoreConfig): void {
  storeConfig = {
    customDir: config?.customDir
      ? resolve(config.customDir)
      : storeConfig.customDir,
  };
  ensureDir(storeConfig.customDir!);
  customPersonas = loadCustomPersonas(storeConfig.customDir!);
  initialized = true;
}

/** Get the custom personas directory path */
export function getCustomDir(): string {
  if (!initialized) initStore();
  return storeConfig.customDir!;
}

/** Look up a persona by id. Custom personas take priority over built-in. */
export function getPersona(id: string): Persona | undefined {
  if (!initialized) initStore();
  return customPersonas.get(id) ?? basePersonas[id];
}

/** List all persona ids. */
export function listPersonas(): string[] {
  if (!initialized) initStore();
  const baseIds = Object.keys(basePersonas);
  const customIds = Array.from(customPersonas.keys());
  return [...new Set([...baseIds, ...customIds])];
}

/** Check if a persona is built-in. */
export function isBasePersona(id: string): boolean {
  return id in basePersonas;
}

/** Check if a persona is custom (user-defined). */
export function isCustomPersona(id: string): boolean {
  if (!initialized) initStore();
  return customPersonas.has(id);
}

/** Save a custom persona to disk. Overwrites existing. */
export function savePersona(persona: Persona): void {
  if (!initialized) initStore();
  const dir = storeConfig.customDir!;
  ensureDir(dir);
  const path = join(dir, `${persona.id}.json`);
  writeFileSync(path, JSON.stringify(persona, null, 2));
  customPersonas.set(persona.id, persona);
}

/** Delete a custom persona. Built-in personas cannot be deleted. */
export function deletePersona(id: string): boolean {
  if (!initialized) initStore();
  if (isBasePersona(id)) return false;
  if (!customPersonas.has(id)) return false;

  const path = join(storeConfig.customDir!, `${id}.json`);
  if (existsSync(path)) {
    unlinkSync(path);
  }
  customPersonas.delete(id);
  return true;
}

/** Get all built-in personas. */
export function getBasePersonas(): Record<string, Persona> {
  return { ...basePersonas };
}

/** Get all custom personas. */
export function getCustomPersonas(): Record<string, Persona> {
  if (!initialized) initStore();
  return Object.fromEntries(customPersonas);
}

/** Get the file path for a custom persona. */
export function getPersonaPath(id: string): string | undefined {
  if (!initialized) initStore();
  if (!customPersonas.has(id)) return undefined;
  return join(storeConfig.customDir!, `${id}.json`);
}
