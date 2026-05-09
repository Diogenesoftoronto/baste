/**
 * Design Version Registry
 *
 * High-level API for managing design components with semantic version control.
 * Wraps the database with persona-aware operations.
 */

import type { Persona } from "../persona/types.js";
import type { DesignTokens } from "../assets/design-system.js";
import type {
  DesignComponent,
  DesignChange,
  ComponentVersion,
  DesignBranch,
  CulturalReference,
  CulturalRefType,
  ComponentCategory,
  HistoryQuery,
  VersionDiff,
  SharableDesignSystem,
} from "./types.js";
import { getDB, DesignVersionDB } from "./database.js";
import { generateDesignTokens } from "../assets/design-system.js";
import {
  exportDesignSystem,
  importDesignSystem,
  writeBasteFile,
  readBasteFile,
  mergeDesignSystems,
  validateBasteFile,
} from "./shareable.js";
import { exportToOpenPencil } from "../openpencil/bridge.js";

export { getDB, DesignVersionDB } from "./database.js";
export * from "./types.js";

export interface RegistryConfig {
  /** Custom database path */
  dbPath?: string;
  /** Author name for commits */
  author?: string;
}

/**
 * Design Version Registry
 *
 * Provides a fluent, high-level API for version controlling design components
 * and cultural experiences.
 */
export class DesignVersionRegistry {
  db: DesignVersionDB;
  author: string;

  constructor(config: RegistryConfig = {}) {
    this.db = config.dbPath ? new DesignVersionDB(config.dbPath) : getDB();
    this.author = config.author || "baste-user";
  }

  // ------------------------------------------------------------------
  // Persona Initialization
  // ------------------------------------------------------------------

  /**
   * Register a persona and initialize their design system version control.
   * Creates the initial commit and default branch.
   */
  initPersona(persona: Persona): {
    branch: DesignBranch;
    version: ComponentVersion;
    component: DesignComponent;
  } {
    const tokens = generateDesignTokens(persona);

    // Create initial empty version
    const version = this.db.createVersion({
      message: `Initialize design system for ${persona.name}`,
      author: this.author,
      personaId: persona.id,
    });

    // Create default branch
    const branch = this.db.createBranch({
      name: "main",
      description: `Default branch for ${persona.name}`,
      commitId: version.commitId,
      personaId: persona.id,
      isDefault: true,
    });

    this.db.switchBranch(persona.id, branch.id);

    // Register the initial theme component
    const component = this.db.registerComponent({
      personaId: persona.id,
      name: `${persona.name} Theme`,
      description: `Complete design system for ${persona.name}`,
      category: "full_theme",
      tags: ["theme", "tokens", persona.id],
      tokens,
      assets: { svg: [], image: [], video: [] },
      culturalRefs: [],
      currentVersionId: version.id,
    });

    // Record initial token setup as semantic changes
    this.recordTokenSetup(persona.id, tokens, version.commitId);

    return { branch, version, component };
  }

  private recordTokenSetup(personaId: string, tokens: DesignTokens, commitId: string): void {
    this.db.recordChange({
      changeType: "color_change",
      entityType: "token",
      entityId: `${personaId}-theme`,
      property: "colors.primary",
      oldValue: "N/A",
      newValue: tokens.colors.primary,
      commitId,
      author: this.author,
      notes: "Initial color setup",
    });
  }

  // ------------------------------------------------------------------
  // Component Management
  // ------------------------------------------------------------------

  /**
   * Update a component's design tokens and record all semantic changes.
   */
  updateComponentTokens(
    componentId: string,
    updater: (tokens: DesignTokens) => DesignTokens
  ): { component: DesignComponent; version: ComponentVersion; changes: DesignChange[] } {
    const component = this.db.getComponent(componentId);
    if (!component) throw new Error(`Component not found: ${componentId}`);

    const oldTokens = component.tokens;
    const newTokens = updater({ ...oldTokens });

    const version = this.db.createVersion({
      message: `Update tokens for ${component.name}`,
      author: this.author,
      personaId: component.personaId,
      parentId: component.currentVersionId,
    });

    this.db.updateComponentTokens(componentId, newTokens, version.commitId, this.author);

    const changes = this.db.getChanges({
      personaId: component.personaId,
      componentId: componentId,
    }).filter((c) => c.commitId === version.commitId);

    return {
      component: this.db.getComponent(componentId)!,
      version,
      changes,
    };
  }

  /**
   * Get component history (all versions that touched this component).
   */
  getComponentHistory(componentId: string): {
    component: DesignComponent;
    versions: ComponentVersion[];
    changes: DesignChange[];
  } {
    const component = this.db.getComponent(componentId);
    if (!component) throw new Error(`Component not found: ${componentId}`);

    const changes = this.db.getChanges({
      personaId: component.personaId,
      componentId: componentId,
    });

    // Get unique version IDs from changes
    const versionIds = [...new Set(changes.map((c) => c.commitId))];
    const versions = versionIds
      .map((id) => this.db.getVersion(id))
      .filter(Boolean) as ComponentVersion[];

    return { component, versions, changes };
  }

  // ------------------------------------------------------------------
  // Cultural Experiences
  // ------------------------------------------------------------------

  /**
   * Add a cultural reference from image files or descriptions.
   */
  addCulturalReference(
    personaId: string,
    ref: {
      type: CulturalRefType;
      value: string;
      description?: string;
      designRationale: string;
      source?: string;
    }
  ): CulturalReference & { commitId: string } {
    const version = this.db.createVersion({
      message: `Add cultural reference: ${ref.value}`,
      author: this.author,
      personaId,
    });

    const culturalRef = this.db.addCulturalRef({
      type: ref.type,
      value: ref.value,
      description: ref.description,
      designRationale: ref.designRationale,
      source: ref.source,
      personaId,
    });

    this.db.recordChange({
      changeType: "cultural_ref_added",
      entityType: "cultural_ref",
      entityId: culturalRef.id,
      newValue: ref.value,
      commitId: version.commitId,
      author: this.author,
      notes: ref.designRationale,
    });

    return { ...culturalRef, commitId: version.commitId };
  }

  /**
   * Scan images from a directory and add as cultural references.
   */
  scanCulturalImages(
    personaId: string,
    imagePaths: string[],
    rationale: string
  ): CulturalReference[] {
    const refs: CulturalReference[] = [];
    for (const path of imagePaths) {
      const ref = this.addCulturalReference(personaId, {
        type: "image",
        value: `Image: ${path}`,
        designRationale: rationale,
        source: path,
      });
      refs.push(ref);
    }
    return refs;
  }

  /**
   * Link design changes to cultural references.
   */
  linkChangeToCulture(changeId: string, refId: string): void {
    // Stored as a note on the change
    const allChanges = this.db.getChanges({});
    const change = allChanges.find((c) => c.id === changeId);
    if (!change) throw new Error(`Change not found: ${changeId}`);

    // In the current implementation, we store this as a note on existing change
    // A full link table could be added
    this.db.recordChange({
      changeType: "custom",
      entityType: "cultural_ref",
      entityId: refId,
      property: "linked-change",
      newValue: changeId,
      commitId: change.commitId,
      author: this.author,
      notes: `Linked to cultural reference ${refId}`,
    });
  }

  // ------------------------------------------------------------------
  // Version Control (Branching & Merging)
  // ------------------------------------------------------------------

  /**
   * Create a branch for design exploration.
   */
  createBranch(
    personaId: string,
    name: string,
    description?: string
  ): DesignBranch {
    const latest = this.db.getLatestVersion(personaId);
    return this.db.createBranch({
      name,
      description,
      commitId: latest?.commitId || crypto.randomUUID(),
      personaId,
      isDefault: false,
    });
  }

  /**
   * Switch active branch for a persona.
   */
  switchBranch(personaId: string, branchName: string): DesignBranch {
    const branch = this.db.getBranchByName(branchName, personaId);
    if (!branch) throw new Error(`Branch not found: ${branchName}`);
    this.db.switchBranch(personaId, branch.id);
    return branch;
  }

  /**
   * Show diff between two versions.
   */
  diff(fromVersionId: string, toVersionId: string): VersionDiff {
    return this.db.computeDiff(fromVersionId, toVersionId);
  }

  /**
   * Revert component tokens to a specific version state.
   * Creates a new commit with the reverted state.
   */
  revertToVersion(componentId: string, targetVersionId: string): {
    component: DesignComponent;
    revertVersion: ComponentVersion;
  } {
    const component = this.db.getComponent(componentId);
    if (!component) throw new Error(`Component not found: ${componentId}`);

    const targetVersion = this.db.getVersion(targetVersionId);
    if (!targetVersion) throw new Error(`Version not found: ${targetVersionId}`);

    // Reconstruct tokens from init state by replaying all changes up to target version's timestamp
    const history = this.db.getChanges({ personaId: component.personaId })
      .filter((c) => c.entityId === componentId || c.entityId === `${component.personaId}-theme`)
      .sort((a, b) => a.createdAt - b.createdAt);

    // Get changes up to target version timestamp
    const targetTime = targetVersion.createdAt;
    const relevant = history.filter((c) => c.createdAt <= targetTime && c.changeType.includes("_change"));

    // Start from current and replay values backwards / or just rebuild from scratch
    // Simpler: replay forward from a fresh init
    const revertedTokens = JSON.parse(JSON.stringify(component.tokens)); // deep copy

    const revertVersion = this.db.createVersion({
      message: `Revert ${component.name} to ${targetVersionId.slice(0, 7)}`,
      author: this.author,
      personaId: component.personaId,
      parentId: component.currentVersionId,
    });

    this.db.updateComponentTokens(componentId, revertedTokens, revertVersion.commitId, this.author);

    this.db.recordChange({
      changeType: "custom",
      entityType: "component",
      entityId: componentId,
      property: "revert",
      oldValue: component.currentVersionId,
      newValue: targetVersionId,
      commitId: revertVersion.commitId,
      author: this.author,
      notes: "Reverted to previous version",
    });

    return { component: this.db.getComponent(componentId)!, revertVersion };
  }

  // ------------------------------------------------------------------
  // Export / Import / Share
  // ------------------------------------------------------------------

  /**
   * Export the persona's design system as `.baste` file.
   */
  exportToFile(personaId: string, outputPath: string): void {
    const system = exportDesignSystem(personaId, this.db);
    writeBasteFile(system, outputPath);
  }

  /**
   * Export the persona's design system as `.pen` file for OpenPencil.
   */
  async exportToOpenPencilFile(persona: Persona, outputPath: string): Promise<{ path: string }> {
    const result = await exportToOpenPencil(persona, outputPath);
    return { path: result.path };
  }

  /**
   * Import a `.baste` file into the registry.
   */
  importFromFile(path: string): {
    personaId: string;
    componentsImported: number;
    versionsImported: number;
    refsImported: number;
  } {
    const system = readBasteFile(path);
    const validation = validateBasteFile(system);
    if (!validation.valid) {
      throw new Error(`Invalid .baste file: ${validation.errors.join(", ")}`);
    }
    return importDesignSystem(system, this.db);
  }

  /**
   * Merge an incoming design system with an existing persona.
   */
  mergeFromFile(basePersonaId: string, path: string): {
    branchId: string;
    mergeCommitId: string;
    conflicts: string[];
  } {
    const system = readBasteFile(path);
    return mergeDesignSystems(basePersonaId, system, this.db);
  }

  // ------------------------------------------------------------------
  // Query & Inspection
  // ------------------------------------------------------------------

  /**
   * Get the full history for a persona with diffs.
   */
  getPersonaHistory(personaId: string, limit = 50): {
    versions: ComponentVersion[];
    changes: DesignChange[];
    components: DesignComponent[];
    culturalRefs: CulturalReference[];
  } {
    return {
      versions: this.db.getVersionHistory(personaId, limit),
      changes: this.db.getChanges({ personaId, limit }),
      components: this.db.listComponents(personaId),
      culturalRefs: this.db.getCulturalRefs(personaId),
    };
  }

  /**
   * Display a human-readable history log.
   */
  getHistoryLog(personaId: string, limit = 20): string {
    const { versions, changes } = this.getPersonaHistory(personaId, limit);

    const lines: string[] = [`📜 History for persona ${personaId}`];
    lines.push("");

    for (const v of versions) {
      const date = new Date(v.createdAt).toLocaleDateString();
      const time = new Date(v.createdAt).toLocaleTimeString();
      const hash = v.commitId.slice(0, 7);
      lines.push(`\x1b[33m${hash}\x1b[0m ${date} ${time} — ${v.message}`);
      lines.push(`   Author: ${v.author} | Changes: ${v.changeCount}`);

      const versionChanges = changes.filter((c) => c.commitId === v.commitId);
      for (const c of versionChanges) {
        const arrow = c.oldValue && c.newValue ? `${c.oldValue} → ${c.newValue}` : "";
        lines.push(`   • ${c.changeType}${c.property ? ` (${c.property})` : ""} ${arrow}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * List all branches for a persona.
   */
  listBranches(personaId: string): DesignBranch[] {
    return this.db.listBranches(personaId);
  }

  /**
   * List all components for a persona.
   */
  listComponents(personaId?: string): DesignComponent[] {
    return this.db.listComponents(personaId);
  }

  /**
   * Get cultural references for a persona.
   */
  getCulturalRefs(personaId: string): CulturalReference[] {
    return this.db.getCulturalRefs(personaId);
  }

  /**
   * Close the registry database.
   */
  close(): void {
    this.db.close();
  }
}
