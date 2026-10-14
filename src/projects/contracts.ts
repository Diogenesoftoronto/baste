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

export interface DesignProject {
  schemaVersion: 1;
  id: string;
  name: string;
  brief: string;
  /** A project-owned snapshot, independent of later edits to the source persona. */
  audience: Persona | null;
  /** Populated by the character-creation milestone, never a fabricated placeholder. */
  partner: DesignPartner | null;
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

export type ProjectRevisionKind = "created" | "details_updated" | "audience_selected" | "revision_restored";

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
);

export const PROJECT_LIMITS = { name: 120, brief: 12000, commandId: 100 } as const;
