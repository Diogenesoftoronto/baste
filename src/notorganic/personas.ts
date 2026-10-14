import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as local from "../persona/store.js";
import { basePersonas } from "../persona/base-personas.js";
import type { Persona } from "../persona/types.js";
import { accountScope, accountPath } from "./scope.js";
export { accountScope } from "./scope.js";

/** Hosted identities never inherit the workstation's unowned local persona files. */
export const isBasePersona = local.isBasePersona;
function directory(): string | undefined {
  const did = accountScope.getStore();
  return did ? accountPath("personas", "personas") : undefined;
}
function valid(id: string) { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Persona id must use letters, numbers, underscores or hyphens."); }
export function getPersona(id: string): Persona | undefined {
  const dir = directory(); if (!dir) return local.getPersona(id);
  valid(id);
  if (isBasePersona(id)) return basePersonas[id];
  const path = join(dir, `${id}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}
export function listPersonas(): string[] {
  const dir = directory(); if (!dir) return local.listPersonas();
  return [...Object.keys(basePersonas), ...(existsSync(dir) ? readdirSync(dir).filter(p => /^[a-zA-Z0-9_-]{1,100}\.json$/.test(p)).map(p => p.slice(0, -5)) : [])];
}
export function savePersona(persona: Persona): void {
  valid(persona.id); const dir = directory(); if (!dir) return local.savePersona(persona);
  if (isBasePersona(persona.id)) throw new Error("Built-in personas cannot be changed.");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, `${persona.id}.json`), JSON.stringify(persona, null, 2), { mode: 0o600 });
}
export function deletePersona(id: string): boolean {
  valid(id); const dir = directory(); if (!dir) return local.deletePersona(id);
  if (isBasePersona(id)) return false;
  const path = join(dir, `${id}.json`); if (!existsSync(path)) return false;
  unlinkSync(path); return true;
}
