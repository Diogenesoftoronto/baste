/**
 * Sharable Design System Format
 *
 * The `.baste` format: a portable, self-contained package for sharing
 * personas and their complete design systems across teams and tools.
 *
 * Structure:
 *   my-design.baste (json file) :
 *     { persona, components, versions, changes, culturalRefs, metadata }
 *
 * Can be:
 *   - Imported into another Baste instance
 *   - Published to a registry
 *   - Edited by OpenPencil (converted to .pen first)
 *   - Rendered by any tool that understands the tokens
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import crypto from "node:crypto";
import type {
  SharableDesignSystem,
  DesignComponent,
  ComponentVersion,
  DesignChange,
  CulturalReference,
} from "./types.js";
import type { Persona } from "../persona/types.js";
import { generateDesignTokens } from "../assets/design-system.js";
import { getDB, DesignVersionDB } from "./database.js";
import { getPersona } from "../persona/store.js";

export const BASTE_FORMAT_VERSION = "0.2.0";
export const BASTE_SCHEMA = "baste-design-v1";

/**
 * Export a persona's complete design system as a `.baste` file.
 */
export function exportDesignSystem(personaId: string, db?: DesignVersionDB): SharableDesignSystem {
  const persona = getPersona(personaId);
  if (!persona) throw new Error(`Persona not found: ${personaId}`);

  const database = db ?? getDB();
  const data = database.exportData(personaId);
  const tokens = generateDesignTokens(persona);

  const fullSystem: SharableDesignSystem = {
    version: BASTE_FORMAT_VERSION,
    schema: BASTE_SCHEMA,
    exportedAt: Date.now(),
    persona,
    components: data.components,
    versions: data.versions,
    changes: data.changes,
    culturalRefs: data.refs,
    embeddedAssets: {},
    metadata: {
      name: persona.name,
      description: persona.summary,
      author: "baste",
      exportFormat: "baste",
      compatibility: ["open-pencil", "baste-cli", "lix-v1"],
    },
  };

  // Include base-64 encoded assets if they are small local files
  for (const comp of data.components) {
    for (const type of (["svg", "image", "video"] as const)) {
      for (const assetPath of (comp.assets?.[type] ?? [])) {
        if (existsSync(assetPath)) {
          try {
            const buf = readFileSync(assetPath);
            if (buf.length < 500_000) {
              const b64 = buf.toString("base64");
              const ext = assetPath.split(".").pop() || "bin";
              fullSystem.embeddedAssets![assetPath] = `data:${mimeFromExt(ext)};base64,${b64}`;
            }
          } catch { /* skip unreadable */ }
        }
      }
    }
  }

  return fullSystem;
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

/**
 * Write a `.baste` file to disk.
 */
export function writeBasteFile(system: SharableDesignSystem, outputPath: string): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(system, null, 2));
}

/**
 * Read a `.baste` file from disk.
 */
export function readBasteFile(path: string): SharableDesignSystem {
  const content = readFileSync(resolve(path), "utf-8");
  return JSON.parse(content) as SharableDesignSystem;
}

/**
 * Import a `.baste` file into the current database.
 * If persona already exists, creates a new branch.
 */
export function importDesignSystem(
  system: SharableDesignSystem,
  db?: DesignVersionDB
): {
  personaId: string;
  componentsImported: number;
  versionsImported: number;
  refsImported: number;
} {
  const database = db ?? getDB();
  const persona = system.persona;

  // Check if persona exists, if so branch
  const existingPersona = getPersona(persona.id);
  let targetPersonaId = persona.id;

  if (existingPersona) {
    targetPersonaId = `${persona.id}-imported-${Date.now()}`;
    system.persona = { ...persona, id: targetPersonaId };
  }

  // Create default branch
  const latestVersion = system.versions[0];
  const branchName = latestVersion
    ? `import-${latestVersion.message.replace(/\s+/g, "-")}-${Date.now()}`
    : `import-${Date.now()}`;

  const branch = database.createBranch({
    name: branchName,
    description: `Imported from ${system.metadata.author} at ${new Date(system.exportedAt).toISOString()}`,
    commitId: latestVersion?.commitId || crypto.randomUUID(),
    personaId: targetPersonaId,
    isDefault: true,
  });

  // Import versions
  for (const v of system.versions) {
    database.createVersion({
      message: v.message,
      author: v.author,
      personaId: targetPersonaId,
      suiteId: v.suiteId,
      parentId: v.parentId,
    });
  }

  // Import components
  let componentsImported = 0;
  for (const c of system.components) {
    database.registerComponent({
      personaId: targetPersonaId,
      name: c.name,
      description: c.description,
      category: c.category,
      tags: c.tags,
      tokens: c.tokens,
      assets: c.assets,
      culturalRefs: c.culturalRefs || [],
      currentVersionId: c.currentVersionId,
    });
    componentsImported++;
  }

  // Import cultural references
  let refsImported = 0;
  for (const ref of system.culturalRefs) {
    database.addCulturalRef({
      type: ref.type,
      value: ref.value,
      description: ref.description,
      designRationale: ref.designRationale,
      source: ref.source,
      personaId: targetPersonaId,
      componentId: ref.componentId,
    });
    refsImported++;
  }

  return {
    personaId: targetPersonaId,
    componentsImported,
    versionsImported: system.versions.length,
    refsImported,
  };
}

/**
 * Merge two design systems.
 * Imports the new system as a branch of the existing persona.
 */
export function mergeDesignSystems(
  basePersonaId: string,
  incomingSystem: SharableDesignSystem,
  db?: DesignVersionDB
): { branchId: string; mergeCommitId: string; conflicts: string[] } {
  const database = db ?? getDB();
  const basePersona = getPersona(basePersonaId);
  if (!basePersona) throw new Error(`Base persona not found: ${basePersonaId}`);

  const branch = database.createBranch({
    name: `merge-${incomingSystem.metadata.name.replace(/\s+/g, "-")}-${Date.now()}`,
    description: `Merged from ${incomingSystem.metadata.author}`,
    commitId: crypto.randomUUID(),
    personaId: basePersonaId,
    isDefault: false,
  });

  const conflicts: string[] = [];

  // Check for token conflicts
  const baseComponents = database.listComponents(basePersonaId);
  const incomingTokens = incomingSystem.components.map((c) => c.tokens);

  for (const baseComp of baseComponents) {
    for (const incoming of incomingTokens) {
      if (baseComp.tokens.colors.primary !== incoming.colors.primary) {
        conflicts.push(`Color primary differs: ${baseComp.tokens.colors.primary} vs ${incoming.colors.primary}`);
      }
    }
  }

  const mergeCommit = database.createVersion({
    message: `Merge: ${incomingSystem.metadata.name}`,
    author: "baste-merge",
    personaId: basePersonaId,
  });

  // Record merge changes
  for (const c of conflicts) {
    database.recordChange({
      changeType: "merge",
      entityType: "component",
      entityId: basePersonaId,
      property: "merge-conflict",
      newValue: c,
      commitId: mergeCommit.commitId,
      notes: `Merged from ${incomingSystem.metadata.author}`,
    });
  }

  return { branchId: branch.id, mergeCommitId: mergeCommit.commitId, conflicts };
}

/**
 * Create a minimal design system export (lightweight, for quick sharing).
 */
export function exportDesignSystemLight(personaId: string): SharableDesignSystem {
  const persona = getPersona(personaId);
  if (!persona) throw new Error(`Persona not found: ${personaId}`);

  const tokens = generateDesignTokens(persona);
  const component: DesignComponent = {
    id: crypto.randomUUID(),
    personaId,
    name: `${persona.name} Theme`,
    description: `Complete theme for ${persona.name}`,
    category: "full_theme",
    tags: ["theme", "tokens", persona.id],
    tokens,
    assets: { svg: [], image: [], video: [] },
    culturalRefs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentVersionId: "v1",
  };

  return {
    version: BASTE_FORMAT_VERSION,
    schema: BASTE_SCHEMA,
    exportedAt: Date.now(),
    persona,
    components: [component],
    versions: [],
    changes: [],
    culturalRefs: [],
    metadata: {
      name: persona.name,
      description: persona.summary,
      author: "baste",
      exportFormat: "baste",
      compatibility: ["open-pencil", "baste-cli"],
    },
  };
}

/**
 * Validate a `.baste` file before importing.
 */
export function validateBasteFile(system: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!system || typeof system !== "object") {
    errors.push("Not a valid object");
    return { valid: false, errors };
  }

  const s = system as Partial<SharableDesignSystem>;

  if (!s.version) errors.push("Missing version");
  if (!s.schema) errors.push("Missing schema");
  if (!s.persona) errors.push("Missing persona");
  if (!s.metadata) errors.push("Missing metadata");

  if (s.persona && typeof s.persona === "object") {
    if (!(s.persona as Persona).id) errors.push("Persona missing id");
    if (!(s.persona as Persona).name) errors.push("Persona missing name");
  }

  if (s.components && !Array.isArray(s.components)) {
    errors.push("Components must be array");
  }

  return { valid: errors.length === 0, errors };
}
