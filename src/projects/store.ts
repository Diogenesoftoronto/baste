import { constants, closeSync, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { accountPath, accountScope } from "../notorganic/scope.js";
import { ProjectError } from "./errors.js";
import { projectIdSchema, recordSchema, type ProjectRecord } from "./schemas.js";

const MAX_RECORD_BYTES = 32 * 1024 * 1024;
const noFollow = constants.O_NOFOLLOW ?? 0;
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

/** Never follow storage-directory symlinks into another account or outside the workspace. */
export function projectDirectory(create = false): string | undefined {
  if (/^(true|1)$/i.test(process.env.NOTORGANIC_ENABLED ?? "") && !accountScope.getStore()) throw new ProjectError(401, "Sign in before opening projects.");
  const root = resolve(process.cwd());
  const directory = accountPath("projects", ".baste/projects");
  let current = root;
  for (const segment of relative(root, directory).split(sep)) {
    if (!segment || segment === "..") throw new ProjectError(500, "Project storage location is invalid.");
    current = join(current, segment);
    try {
      if (create) {
        try { mkdirSync(current, { mode: 0o700 }); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      }
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new ProjectError(500, "Project storage must use regular directories.");
    } catch (error) {
      if (!create && isMissing(error)) return undefined;
      if (error instanceof ProjectError) throw error;
      throw new ProjectError(500, "Project storage could not be opened.");
    }
  }
  return directory;
}

export function readRecord(directory: string, id: string): ProjectRecord | undefined {
  const path = join(directory, `${id}.json`);
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_RDONLY | noFollow);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_RECORD_BYTES) throw new Error("Invalid record file");
    const record = recordSchema.parse(JSON.parse(readFileSync(fd, "utf8")));
    const initial = record.snapshots[0].project;
    const receiptIds = new Set<string>();
    if (record.snapshots.length !== record.receipts.length) throw new Error("Incomplete history");
    for (let index = 0; index < record.snapshots.length; index++) {
      const { project, entry } = record.snapshots[index];
      const receipt = record.receipts[index];
      if (project.id !== id || project.revision !== index + 1 || entry.revision !== index + 1 || receipt.revision !== index + 1 || project.createdAt !== initial.createdAt || entry.createdAt !== project.updatedAt || receiptIds.has(receipt.commandId)) throw new Error("Invalid history");
      if ((index === 0) !== (entry.kind === "created") || (entry.kind === "revision_restored" ? !entry.restoredFrom || entry.restoredFrom > index : entry.restoredFrom !== undefined)) throw new Error("Invalid revision origin");
      receiptIds.add(receipt.commandId);
    }
    return record;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw new ProjectError(500, "Project data is damaged or unavailable; it has not been reset.");
  } finally { if (fd !== undefined) closeSync(fd); }
}

export function listRecords(directory: string): ProjectRecord[] {
  try {
    return readdirSync(directory).filter(name => name.endsWith(".json") && projectIdSchema.safeParse(name.slice(0, -5)).success)
      .map(name => readRecord(directory, name.slice(0, -5)))
      .filter((record): record is ProjectRecord => record !== undefined);
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError(500, "Projects could not be read.");
  }
}

/** A single rename commits history and its idempotency receipt together. */
export function writeRecord(directory: string, id: string, record: ProjectRecord): void {
  const content = JSON.stringify(record);
  if (Buffer.byteLength(content) > MAX_RECORD_BYTES) throw new ProjectError(413, "This project's history has reached its storage limit.");
  const temporary = join(directory, `.${id}.${randomUUID()}.tmp`);
  let fd: number | undefined;
  try {
    fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow, 0o600);
    writeFileSync(fd, content, "utf8");
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    renameSync(temporary, join(directory, `${id}.json`));
    const directoryFd = openSync(directory, constants.O_RDONLY | noFollow);
    try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
  } catch {
    throw new ProjectError(500, "Project changes could not be saved. Retry with the same command identifier.");
  } finally {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(temporary); } catch (error) { if (!isMissing(error)) throw new ProjectError(500, "Project temporary file could not be cleaned up."); }
  }
}

/** Exclusive files serialize writers across processes; interrupted locks fail closed. */
export async function withProjectLock<T>(directory: string, id: string, operation: () => T): Promise<T> {
  const lockPath = join(directory, `.${id}.lock`);
  const deadline = Date.now() + 3000;
  let lock: number;
  for (;;) {
    try {
      lock = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow, 0o600);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new ProjectError(500, "Project lock could not be acquired.");
      if (Date.now() >= deadline) throw new ProjectError(503, "This project is busy or an earlier save was interrupted. Retry shortly; a stopped server's interrupted lock can be recovered with the project lock repair tool.");
      await delay(20);
    }
  }
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
    return operation();
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}
