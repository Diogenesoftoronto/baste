import { createHash } from "node:crypto";
import { lstatSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { getPersona, isBasePersona } from "../notorganic/personas.js";
import { accountKey, accountPath, accountScope } from "../notorganic/scope.js";
import type { DesignProject, ProjectDetail, ProjectRevision, ProjectSummary } from "./contracts.js";
import { ProjectError } from "./errors.js";
import { createProjectSchema, personaSchema, projectCommandSchema, projectIdSchema, type ProjectRecord } from "./schemas.js";
import { listRecords, projectDirectory, readRecord, withProjectLock, writeRecord } from "./store.js";

export { ProjectError } from "./errors.js";

function validProjectId(id: string): void {
  if (!projectIdSchema.safeParse(id).success) throw new ProjectError(404, "Project not found.");
}

function fingerprint(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

/** A namespaced version-8 UUID makes a retried create resolve to the same account-owned record. */
function creationId(commandId: string): string {
  const bytes = createHash("sha256").update(JSON.stringify(["baste-project-v1", accountKey() ?? "local", commandId])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function detail(record: ProjectRecord, revision = record.snapshots.length): ProjectDetail {
  return structuredClone({ project: record.snapshots[revision - 1].project, revisions: record.snapshots.slice(0, revision).map(snapshot => snapshot.entry) });
}

function replay(record: ProjectRecord, commandId: string, hash: string): ProjectDetail | undefined {
  const receipt = record.receipts.find(item => item.commandId === commandId);
  if (!receipt) return undefined;
  if (receipt.fingerprint !== hash) throw new ProjectError(409, "This command identifier has already been used for different changes.");
  return detail(record, receipt.revision);
}

function audienceSnapshot(personaId?: string | null): DesignProject["audience"] {
  if (!personaId) return null;
  // The existing persona adapter resolves ownership; reject linked source files
  // before asking it for a hosted custom persona's project-owned snapshot.
  if (accountScope.getStore() && !isBasePersona(personaId)) {
    const root = resolve(process.cwd());
    const source = join(accountPath("personas", "personas"), `${personaId}.json`);
    let current = root;
    try {
      for (const segment of relative(root, source).split(sep)) {
        current = join(current, segment);
        const stat = lstatSync(current);
        if (stat.isSymbolicLink() || (current === source ? !stat.isFile() || stat.size > 1024 * 1024 : !stat.isDirectory())) throw new ProjectError(500, "The selected audience must use a regular account-owned file.");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ProjectError(404, "Audience persona not found.");
      if (error instanceof ProjectError) throw error;
      throw new ProjectError(500, "The selected audience could not be read.");
    }
  }
  let persona;
  try { persona = getPersona(personaId); }
  catch { throw new ProjectError(500, "The selected audience could not be read."); }
  if (!persona) throw new ProjectError(404, "Audience persona not found.");
  const parsed = personaSchema.safeParse(persona);
  if (!parsed.success || parsed.data.id !== personaId) throw new ProjectError(500, "The selected audience is invalid.");
  return structuredClone(parsed.data);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const directory = projectDirectory();
  if (!directory) return [];
  return listRecords(directory).map(record => {
    const project = record.snapshots.at(-1)!.project;
    return { id: project.id, name: project.name, brief: project.brief, audienceName: project.audience?.name ?? null, revision: project.revision, updatedAt: project.updatedAt };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

export async function getProject(id: string): Promise<ProjectDetail> {
  validProjectId(id);
  const directory = projectDirectory();
  const record = directory ? readRecord(directory, id) : undefined;
  if (!record) throw new ProjectError(404, "Project not found.");
  return detail(record);
}

export async function createProject(input: unknown): Promise<ProjectDetail> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) throw new ProjectError(400, "Provide a command identifier, a project name of 1–120 characters, and a brief of at most 12,000 characters. Unknown fields are not accepted.");
  const request = parsed.data;
  const id = creationId(request.commandId);
  const hash = fingerprint({ kind: "create_project", ...request });
  const directory = projectDirectory(true)!;
  return withProjectLock(directory, id, () => {
    const existing = readRecord(directory, id);
    if (existing) {
      const result = replay(existing, request.commandId, hash);
      if (result) return result;
      throw new ProjectError(409, "This project creation identifier is already in use.");
    }
    const now = new Date().toISOString();
    const project: DesignProject = { schemaVersion: 1, id, name: request.name, brief: request.brief, audience: audienceSnapshot(request.personaId), partner: null, revision: 1, createdAt: now, updatedAt: now };
    const record: ProjectRecord = {
      schemaVersion: 1,
      snapshots: [{ project, entry: { revision: 1, kind: "created", summary: "Project created", createdAt: now } }],
      receipts: [{ commandId: request.commandId, fingerprint: hash, revision: 1 }],
    };
    writeRecord(directory, id, record);
    return detail(record);
  });
}

export async function applyProjectCommand(id: string, input: unknown): Promise<ProjectDetail> {
  validProjectId(id);
  const parsed = projectCommandSchema.safeParse(input);
  if (!parsed.success) throw new ProjectError(400, "Project command is invalid. Include its command identifier and current revision, and only the fields needed for that command.");
  const command = parsed.data;
  const hash = fingerprint(command);
  const directory = projectDirectory();
  if (!directory) throw new ProjectError(404, "Project not found.");
  return withProjectLock(directory, id, () => {
    const record = readRecord(directory, id);
    if (!record) throw new ProjectError(404, "Project not found.");
    const replayed = replay(record, command.commandId, hash);
    if (replayed) return replayed;
    const current = record.snapshots.at(-1)!.project;
    if (current.revision !== command.baseRevision) throw new ProjectError(409, "This project has changed. Reload its latest revision before saving.");
    if (current.revision === Number.MAX_SAFE_INTEGER) throw new ProjectError(409, "This project has reached its revision limit.");
    let project = structuredClone(current);
    let kind: ProjectRevision["kind"];
    let summary: string;
    if (command.kind === "update_details") {
      project.name = command.name; project.brief = command.brief;
      kind = "details_updated"; summary = "Project details updated";
    } else if (command.kind === "select_audience") {
      project.audience = audienceSnapshot(command.personaId);
      kind = "audience_selected"; summary = project.audience ? "Audience selected" : "Audience cleared";
    } else {
      const snapshot = record.snapshots[command.targetRevision - 1];
      if (!snapshot) throw new ProjectError(404, "Project revision not found.");
      project = structuredClone(snapshot.project);
      kind = "revision_restored"; summary = `Restored revision ${command.targetRevision}`;
    }
    project.revision = current.revision + 1;
    project.updatedAt = new Date().toISOString();
    const entry: ProjectRevision = { revision: project.revision, kind, summary, createdAt: project.updatedAt, ...(command.kind === "restore_revision" ? { restoredFrom: command.targetRevision } : {}) };
    record.snapshots.push({ project, entry });
    record.receipts.push({ commandId: command.commandId, fingerprint: hash, revision: project.revision });
    writeRecord(directory, id, record);
    return detail(record);
  });
}
