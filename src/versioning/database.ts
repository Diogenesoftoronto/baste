/**
 * Semantic Version Control Database
 *
 * SQLite-backed change tracking for design components.
 * Inspired by Lix: change-first, not snapshot-first.
 */

import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import crypto from "node:crypto";
import type {
  DesignChange,
  ComponentVersion,
  DesignBranch,
  DesignComponent,
  CulturalReference,
  CulturalRefType,
  HistoryQuery,
  VersionDiff,
  ChangeProposal,
  ComponentCategory,
  ChangeType,
} from "./types.js";
import type { DesignTokens } from "../assets/design-system.js";
import type { Persona } from "../persona/types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  commit_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  UNIQUE(name, persona_id)
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  commit_id TEXT NOT NULL,
  parent_id TEXT,
  message TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  persona_id TEXT NOT NULL,
  suite_id TEXT,
  change_count INTEGER NOT NULL DEFAULT 0,
  state_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS changes (
  id TEXT PRIMARY KEY,
  change_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  property TEXT,
  old_value TEXT,
  new_value TEXT,
  commit_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  author TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_changes_commit ON changes(commit_id);
CREATE INDEX IF NOT EXISTS idx_changes_entity ON changes(entity_id);
CREATE INDEX IF NOT EXISTS idx_changes_type ON changes(change_type);

CREATE TABLE IF NOT EXISTS components (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags TEXT, -- JSON array
  tokens TEXT, -- JSON DesignTokens
  assets TEXT, -- JSON {svg:[], image:[], video:[]}
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  current_version_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_components_persona ON components(persona_id);

CREATE TABLE IF NOT EXISTS cultural_refs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  design_rationale TEXT NOT NULL,
  source TEXT,
  persona_id TEXT NOT NULL,
  component_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cultural_persona ON cultural_refs(persona_id);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  changes TEXT, -- JSON array of DesignChange
  created_at INTEGER NOT NULL,
  author TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS active_branch (
  persona_id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL
);
`;

export class DesignVersionDB {
  db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath
      ? resolve(dbPath)
      : resolve(process.cwd(), ".baste", "versions.db");
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  // ------------------------------------------------------------------
  // Branches
  // ------------------------------------------------------------------

  createBranch(branch: Omit<DesignBranch, "id" | "createdAt">): DesignBranch {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    this.db.prepare(`
      INSERT INTO branches (id, name, description, commit_id, persona_id, created_at, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, branch.name, branch.description ?? null, branch.commitId, branch.personaId, createdAt, branch.isDefault ? 1 : 0);
    return { id, ...branch, createdAt };
  }

  getBranch(id: string): DesignBranch | undefined {
    const row = this.db.prepare("SELECT * FROM branches WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      commitId: row.commit_id,
      personaId: row.persona_id,
      createdAt: row.created_at,
      isDefault: Boolean(row.is_default),
    };
  }

  getBranchByName(name: string, personaId?: string): DesignBranch | undefined {
    let sql = "SELECT * FROM branches WHERE name = ?";
    let row: any;
    if (personaId) {
      row = this.db.prepare(sql + " AND persona_id = ? LIMIT 1").get(name, personaId) as any;
    } else {
      row = this.db.prepare(sql + " LIMIT 1").get(name) as any;
    }
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      commitId: row.commit_id,
      personaId: row.persona_id,
      createdAt: row.created_at,
      isDefault: Boolean(row.is_default),
    };
  }

  listBranches(personaId?: string): DesignBranch[] {
    let rows: any[];
    if (personaId) {
      rows = this.db.prepare("SELECT * FROM branches WHERE persona_id = ? ORDER BY created_at DESC").all(personaId) as any[];
    } else {
      rows = this.db.prepare("SELECT * FROM branches ORDER BY created_at DESC").all() as any[];
    }
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      commitId: row.commit_id,
      personaId: row.persona_id,
      createdAt: row.created_at,
      isDefault: Boolean(row.is_default),
    }));
  }

  switchBranch(personaId: string, branchId: string): void {
    this.db.prepare(
      "INSERT OR REPLACE INTO active_branch (persona_id, branch_id) VALUES (?, ?)"
    ).run(personaId, branchId);
  }

  getActiveBranch(personaId: string): DesignBranch | undefined {
    const active = this.db.prepare("SELECT branch_id FROM active_branch WHERE persona_id = ?").get(personaId) as any;
    if (!active) {
      const defaultBranch = this.db.prepare(
        "SELECT * FROM branches WHERE persona_id = ? AND is_default = 1 LIMIT 1"
      ).get(personaId) as any;
      if (defaultBranch) return {
        id: defaultBranch.id,
        name: defaultBranch.name,
        description: defaultBranch.description ?? undefined,
        commitId: defaultBranch.commit_id,
        personaId: defaultBranch.persona_id,
        createdAt: defaultBranch.created_at,
        isDefault: Boolean(defaultBranch.is_default),
      };
      return undefined;
    }
    return this.getBranch(active.branch_id);
  }

  // ------------------------------------------------------------------
  // Versions (Commits)
  // ------------------------------------------------------------------

  createVersion(version: {
    message: string;
    author: string;
    personaId: string;
    suiteId?: string;
    parentId?: string | null;
  }): ComponentVersion {
    const id = crypto.randomUUID();
    const commitId = crypto.randomUUID();
    const createdAt = Date.now();
    const parentId = version.parentId ?? null;
    const stateHash = this.computeStateHash(version.personaId, []);

    this.db.prepare(`
      INSERT INTO versions (id, commit_id, parent_id, message, author, created_at, persona_id, suite_id, change_count, state_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, commitId, parentId, version.message, version.author, createdAt, version.personaId, version.suiteId ?? null, 0, stateHash);

    return { id, commitId, parentId, message: version.message, author: version.author, createdAt, personaId: version.personaId, suiteId: version.suiteId, changeCount: 0, stateHash };
  }

  getVersion(id: string): ComponentVersion | undefined {
    const row = this.db.prepare("SELECT * FROM versions WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    const changeCount = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM changes WHERE commit_id = ?"
    ).get(row.commit_id) as any;
    return {
      id: row.id,
      commitId: row.commit_id,
      parentId: row.parent_id,
      message: row.message,
      author: row.author,
      createdAt: row.created_at,
      personaId: row.persona_id,
      suiteId: row.suite_id ?? undefined,
      changeCount: changeCount?.cnt || 0,
      stateHash: row.state_hash,
    };
  }

  getVersionHistory(personaId: string, limit = 50): ComponentVersion[] {
    const rows = this.db.prepare(
      "SELECT * FROM versions WHERE persona_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(personaId, limit) as any[];
    return rows.map((row) => {
      const changeCount = this.db.prepare(
        "SELECT COUNT(*) as cnt FROM changes WHERE commit_id = ?"
      ).get(row.commit_id) as any;
      return {
        id: row.id,
        commitId: row.commit_id,
        parentId: row.parent_id,
        message: row.message,
        author: row.author,
        createdAt: row.created_at,
        personaId: row.persona_id,
        suiteId: row.suite_id ?? undefined,
        changeCount: changeCount?.cnt || 0,
        stateHash: row.state_hash,
      };
    });
  }

  getLatestVersion(personaId: string): ComponentVersion | undefined {
    const row = this.db.prepare(
      "SELECT * FROM versions WHERE persona_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(personaId) as any;
    if (!row) return undefined;
    const changeCount = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM changes WHERE commit_id = ?"
    ).get(row.commit_id) as any;
    return {
      id: row.id,
      commitId: row.commit_id,
      parentId: row.parent_id,
      message: row.message,
      author: row.author,
      createdAt: row.created_at,
      personaId: row.persona_id,
      suiteId: row.suite_id ?? undefined,
      changeCount: changeCount?.cnt || 0,
      stateHash: row.state_hash,
    };
  }

  // ------------------------------------------------------------------
  // Changes
  // ------------------------------------------------------------------

  recordChange(change: {
    changeType: ChangeType;
    entityType: DesignChange["entityType"];
    entityId: string;
    property?: string;
    oldValue?: string;
    newValue?: string;
    commitId: string;
    author?: string;
    notes?: string;
  }): DesignChange {
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    this.db.prepare(`
      INSERT INTO changes (id, change_type, entity_type, entity_id, property, old_value, new_value, commit_id, created_at, author, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, change.changeType, change.entityType, change.entityId, change.property ?? null, change.oldValue ?? null, change.newValue ?? null, change.commitId, createdAt, change.author ?? null, change.notes ?? null);

    return { id, ...change, createdAt };
  }

  getChanges(query: HistoryQuery): DesignChange[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (query.personaId) {
      conditions.push("commit_id IN (SELECT commit_id FROM versions WHERE persona_id = ?)");
      params.push(query.personaId);
    }
    if (query.componentId) {
      conditions.push("entity_id = ?");
      params.push(query.componentId);
    }
    if (query.changeType) {
      conditions.push("change_type = ?");
      params.push(query.changeType);
    }
    if (query.since) {
      conditions.push("created_at >= ?");
      params.push(query.since);
    }
    if (query.until) {
      conditions.push("created_at <= ?");
      params.push(query.until);
    }
    if (query.author) {
      conditions.push("author = ?");
      params.push(query.author);
    }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    const sql = `SELECT * FROM changes ${where} ORDER BY created_at DESC` + (query.limit ? ` LIMIT ${query.limit}` : "");

    const rows = params.length > 0
      ? this.db.prepare(sql).all(...params) as any[]
      : this.db.prepare(sql).all() as any[];
    return rows.map((row) => ({
      id: row.id,
      changeType: row.change_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      property: row.property ?? undefined,
      oldValue: row.old_value ?? undefined,
      newValue: row.new_value ?? undefined,
      commitId: row.commit_id,
      createdAt: row.created_at,
      author: row.author ?? undefined,
      notes: row.notes ?? undefined,
    }));
  }

  getChangesForVersion(versionId: string): DesignChange[] {
    const version = this.getVersion(versionId);
    if (!version) return [];
    return this.getChanges({}).filter((c) => c.commitId === version.commitId);
  }

  // ------------------------------------------------------------------
  // Components
  // ------------------------------------------------------------------

  registerComponent(component: Omit<DesignComponent, "id" | "createdAt" | "updatedAt">): DesignComponent {
    const id = crypto.randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO components (id, persona_id, name, description, category, tags, tokens, assets, created_at, updated_at, current_version_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      component.personaId,
      component.name,
      component.description ?? null,
      component.category,
      JSON.stringify(component.tags),
      JSON.stringify(component.tokens),
      JSON.stringify(component.assets),
      now,
      now,
      component.currentVersionId
    );

    return { id, ...component, createdAt: now, updatedAt: now };
  }

  getComponent(id: string): DesignComponent | undefined {
    const row = this.db.prepare("SELECT * FROM components WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return this.rowToComponent(row);
  }

  listComponents(personaId?: string): DesignComponent[] {
    let rows: any[];
    if (personaId) {
      rows = this.db.prepare("SELECT * FROM components WHERE persona_id = ? ORDER BY updated_at DESC").all(personaId) as any[];
    } else {
      rows = this.db.prepare("SELECT * FROM components ORDER BY updated_at DESC").all() as any[];
    }
    return rows.map((row) => this.rowToComponent(row));
  }

  updateComponentTokens(id: string, tokens: DesignTokens, commitId: string, author?: string): void {
    const now = Date.now();
    const existing = this.getComponent(id);
    if (!existing) return;

    // Record semantic changes for each token category
    const oldTokens = existing.tokens;
    this.recordTokenChanges(id, oldTokens, tokens, commitId, author);

    this.db.prepare("UPDATE components SET tokens = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(tokens), now, id);
  }

  private rowToComponent(row: any): DesignComponent {
    const assetsJson = row.assets ? JSON.parse(row.assets) : { svg: [], image: [], video: [] };
    return {
      id: row.id,
      personaId: row.persona_id,
      name: row.name,
      description: row.description ?? "",
      category: row.category as ComponentCategory,
      tags: row.tags ? JSON.parse(row.tags) : [],
      tokens: JSON.parse(row.tokens) as DesignTokens,
      assets: {
        svg: assetsJson.svg || [],
        image: assetsJson.image || [],
        video: assetsJson.video || [],
      },
      culturalRefs: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currentVersionId: row.current_version_id,
    };
  }

  private recordTokenChanges(
    componentId: string,
    oldTokens: DesignTokens,
    newTokens: DesignTokens,
    commitId: string,
    author?: string
  ): void {
    const check = (path: string, oldV: any, newV: any, changeType: ChangeType) => {
      if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
        this.recordChange({
          changeType,
          entityType: "component",
          entityId: componentId,
          property: path,
          oldValue: JSON.stringify(oldV),
          newValue: JSON.stringify(newV),
          commitId,
          author,
        });
      }
    };

    check("colors.primary", oldTokens.colors.primary, newTokens.colors.primary, "color_change");
    check("colors.secondary", oldTokens.colors.secondary, newTokens.colors.secondary, "color_change");
    check("colors.accent", oldTokens.colors.accent, newTokens.colors.accent, "color_change");
    check("colors.background", oldTokens.colors.background, newTokens.colors.background, "color_change");
    check("colors.surface", oldTokens.colors.surface, newTokens.colors.surface, "color_change");
    check("colors.text", oldTokens.colors.text, newTokens.colors.text, "color_change");

    check("typography.fontFamily", oldTokens.typography.fontFamily, newTokens.typography.fontFamily, "typography_change");
    check("typography.fontSize", oldTokens.typography.fontSize, newTokens.typography.fontSize, "typography_change");

    check("spacing.scale", oldTokens.spacing.scale, newTokens.spacing.scale, "spacing_change");
    check("borders.radius", oldTokens.borders.radius, newTokens.borders.radius, "border_change");
    check("shadows", oldTokens.shadows, newTokens.shadows, "shadow_change");
    check("motion.duration", oldTokens.motion.duration, newTokens.motion.duration, "motion_change");
    check("motion.easing", oldTokens.motion.easing, newTokens.motion.easing, "motion_change");
  }

  // ------------------------------------------------------------------
  // Cultural References
  // ------------------------------------------------------------------

  addCulturalRef(ref: Omit<CulturalReference, "id" | "createdAt">): CulturalReference {
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    this.db.prepare(`
      INSERT INTO cultural_refs (id, type, value, description, design_rationale, source, persona_id, component_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, ref.type, ref.value, ref.description ?? null, ref.designRationale, ref.source ?? null, ref.personaId, ref.componentId ?? null, createdAt);

    return { id, ...ref, createdAt };
  }

  getCulturalRefs(personaId?: string, componentId?: string): CulturalReference[] {
    if (personaId && componentId) {
      const rows = this.db.prepare(
        "SELECT * FROM cultural_refs WHERE persona_id = ? AND component_id = ? ORDER BY created_at DESC"
      ).all(personaId, componentId) as any[];
      return rows.map((row) => this.rowToCulturalRef(row));
    }
    if (personaId) {
      const rows = this.db.prepare(
        "SELECT * FROM cultural_refs WHERE persona_id = ? ORDER BY created_at DESC"
      ).all(personaId) as any[];
      return rows.map((row) => this.rowToCulturalRef(row));
    }
    if (componentId) {
      const rows = this.db.prepare(
        "SELECT * FROM cultural_refs WHERE component_id = ? ORDER BY created_at DESC"
      ).all(componentId) as any[];
      return rows.map((row) => this.rowToCulturalRef(row));
    }
    const rows = this.db.prepare("SELECT * FROM cultural_refs ORDER BY created_at DESC").all() as any[];
    return rows.map((row) => this.rowToCulturalRef(row));
  }

  private rowToCulturalRef(row: any): CulturalReference {
    return {
      id: row.id,
      type: row.type as CulturalRefType,
      value: row.value,
      description: row.description ?? undefined,
      designRationale: row.design_rationale,
      source: row.source ?? undefined,
      personaId: row.persona_id,
      componentId: row.component_id ?? undefined,
      createdAt: row.created_at,
    };
  }

  removeCulturalRef(id: string): boolean {
    const result = this.db.prepare("DELETE FROM cultural_refs WHERE id = ?").run(id);
    return (result as any).changes > 0;
  }

  // ------------------------------------------------------------------
  // Diff
  // ------------------------------------------------------------------

  computeDiff(fromVersionId: string, toVersionId: string): VersionDiff {
    const fromVersion = this.getVersion(fromVersionId);
    const toVersion = this.getVersion(toVersionId);

    if (!fromVersion || !toVersion) {
      return { fromVersionId, toVersionId, changes: [], summary: "Version not found", tokenDiffs: [] };
    }

    const fromCommit = fromVersion.commitId;
    const toCommit = toVersion.commitId;

    const changes = this.db.prepare(`
      SELECT * FROM changes WHERE commit_id = ?
      ORDER BY created_at ASC
    `).all(toCommit) as any[];

    const tokenDiffs: VersionDiff["tokenDiffs"] = [];
    for (const change of changes) {
      if (change.property && change.old_value && change.new_value) {
        tokenDiffs.push({
          tokenPath: change.property,
          oldValue: change.old_value,
          newValue: change.new_value,
          changeType: change.change_type,
        });
      }
    }

    const changeRecords: DesignChange[] = changes.map((row) => ({
      id: row.id,
      changeType: row.change_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      property: row.property ?? undefined,
      oldValue: row.old_value ?? undefined,
      newValue: row.new_value ?? undefined,
      commitId: row.commit_id,
      createdAt: row.created_at,
      author: row.author ?? undefined,
      notes: row.notes ?? undefined,
    }));

    return {
      fromVersionId,
      toVersionId,
      changes: changeRecords,
      summary: `${changeRecords.length} changes between ${fromVersionId.slice(0, 7)} and ${toVersionId.slice(0, 7)}`,
      tokenDiffs,
    };
  }

  // ------------------------------------------------------------------
  // Proposals
  // ------------------------------------------------------------------

  createProposal(proposal: Omit<ChangeProposal, "id" | "createdAt">): ChangeProposal {
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    this.db.prepare(`
      INSERT INTO proposals (id, branch_id, title, description, changes, created_at, author, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, proposal.branchId, proposal.title, proposal.description ?? null, JSON.stringify(proposal.changes), createdAt, proposal.author, proposal.status);

    return { id, ...proposal, createdAt };
  }

  getProposals(status?: string): ChangeProposal[] {
    let rows: any[];
    if (status) {
      rows = this.db.prepare("SELECT * FROM proposals WHERE status = ? ORDER BY created_at DESC").all(status) as any[];
    } else {
      rows = this.db.prepare("SELECT * FROM proposals ORDER BY created_at DESC").all() as any[];
    }
    return rows.map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      title: row.title,
      description: row.description ?? undefined,
      changes: JSON.parse(row.changes || "[]"),
      createdAt: row.created_at,
      author: row.author,
      status: row.status,
    }));
  }

  updateProposalStatus(id: string, status: ChangeProposal["status"]): boolean {
    const result = this.db.prepare("UPDATE proposals SET status = ? WHERE id = ?").run(status, id);
    return (result as any).changes > 0;
  }

  // ------------------------------------------------------------------
  // State hash for integrity
  // ------------------------------------------------------------------

  private computeStateHash(personaId: string, _changes: DesignChange[]): string {
    const components = this.listComponents(personaId);
    const refs = this.getCulturalRefs(personaId);
    const state = JSON.stringify({ components, refs });
    return crypto.createHash("sha256").update(state).digest("hex").slice(0, 16);
  }

  // ------------------------------------------------------------------
  // Export/Import
  // ------------------------------------------------------------------

  exportData(personaId: string): {
    versions: ComponentVersion[];
    changes: DesignChange[];
    components: DesignComponent[];
    refs: CulturalReference[];
    branches: DesignBranch[];
  } {
    const versions = this.getVersionHistory(personaId, 1000);
    const components = this.listComponents(personaId);
    // Get all changes for these versions
    const changes: DesignChange[] = [];
    for (const v of versions) {
      const versionChanges = this.getChangesForVersion(v.id);
      changes.push(...versionChanges);
    }
    const refs = this.getCulturalRefs(personaId);
    const branches = this.listBranches(personaId);
    return { versions, changes, components, refs, branches };
  }
}

let globalDb: DesignVersionDB | null = null;

export function getDB(path?: string): DesignVersionDB {
  if (!globalDb) {
    globalDb = new DesignVersionDB(path);
  }
  return globalDb;
}

export function resetDB(): void {
  if (globalDb) {
    globalDb.close();
    globalDb = null;
  }
}
