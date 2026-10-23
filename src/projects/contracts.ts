import type { Persona } from "../persona/types.js";

/** Shared transport types. Keep this module free of server/runtime imports. */
export interface DesignPartner {
  id: string;
  name: string;
  personaRevision: number;
  introduction: string;
  likes: string[];
  dislikes: string[];
  portraitAssetId?: string;
}

export const DESIGN_COLOR_ROLES = ["background", "surface", "primary", "secondary", "accent", "text", "textMuted", "border"] as const;
export type DesignColorRole = (typeof DESIGN_COLOR_ROLES)[number];
export const DESIGN_EDGES = ["sharp", "soft", "organic", "geometric", "brutalist"] as const;
export type DesignEdge = (typeof DESIGN_EDGES)[number];

/** Project-owned adjustments on top of the audience's generated tokens. */
export interface DesignOverrides {
  colors?: Partial<Record<DesignColorRole, string>>;
  headingFont?: string;
  bodyFont?: string;
  edges?: DesignEdge;
}

/** A partial adjustment. `null` clears a value back to the audience's generated one. */
export interface DesignChanges {
  colors?: Partial<Record<DesignColorRole, string | null>>;
  headingFont?: string | null;
  bodyFont?: string | null;
  edges?: DesignEdge | null;
}

export interface DesignProject {
  schemaVersion: 1;
  id: string;
  name: string;
  brief: string;
  /** A project-owned snapshot, independent of later edits to the source persona. */
  audience: Persona | null;
  /** Populated by the character-creation milestone, never a fabricated placeholder. */
  partner: DesignPartner | null;
  /** Absent until the first design adjustment. */
  design?: DesignOverrides;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  brief: string;
  audienceName: string | null;
  revision: number;
  updatedAt: string;
}

export type ProjectRevisionKind = "created" | "details_updated" | "audience_selected" | "revision_restored" | "design_updated" | "design_restored";

export interface ProjectRevision {
  revision: number;
  kind: ProjectRevisionKind;
  summary: string;
  createdAt: string;
  restoredFrom?: number;
}

export interface ProjectDetail {
  project: DesignProject;
  revisions: ProjectRevision[];
}

export interface CreateProjectRequest {
  commandId: string;
  name: string;
  brief: string;
  personaId?: string;
}

interface ProjectCommandBase {
  commandId: string;
  baseRevision: number;
}

export type ProjectCommand = ProjectCommandBase & (
  | { kind: "update_details"; name: string; brief: string }
  | { kind: "select_audience"; personaId: string | null }
  | { kind: "restore_revision"; targetRevision: number }
  | { kind: "update_design"; changes: DesignChanges; summary: string }
  /** Restores only the design adjustments of an earlier revision. */
  | { kind: "restore_design"; targetRevision: number }
);

export const PROJECT_LIMITS = { name: 120, brief: 12000, commandId: 100, designSummary: 160 } as const;
