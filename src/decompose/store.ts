import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import type { BrandKit } from "./index.js";
import { defaultConfig } from "../config/baste-config.js";

function resolveBrandKitDir(): string {
  return defaultConfig.personaDir || "./personas";
}

export function brandKitPath(personaId: string, dir?: string): string {
  return resolve(join(dir ?? resolveBrandKitDir(), `${personaId}.brandkit.json`));
}

export function saveBrandKit(personaId: string, kit: BrandKit, dir?: string): string {
  const path = brandKitPath(personaId, dir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(kit, null, 2));
  return path;
}

export function loadBrandKit(personaId: string, dirs?: string[]): BrandKit | null {
  const searchDirs = dirs ?? [resolveBrandKitDir(), "./.baste/brandkits"];
  for (const d of searchDirs) {
    const path = brandKitPath(personaId, d);
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, "utf-8")) as BrandKit;
      } catch (err) {
        console.warn(`[decompose] Failed to parse brand kit at ${path}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    }
  }
  return null;
}
