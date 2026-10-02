import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { accountScope } from "../notorganic/scope.js";
import { ProjectError } from "./errors.js";
import { projectIdSchema } from "./schemas.js";
import { projectDirectory } from "./store.js";

/**
 * Operator-only recovery after stopping every Baste writer sharing this storage.
 * This is deliberately absent from the HTTP and agent command catalogs: a web
 * caller cannot establish that the server and every other writer have stopped.
 */
export function repairProjectLock(id: string, options: { serverStopped: boolean }): boolean {
  if (options.serverStopped !== true) throw new ProjectError(400, "Stop every Baste process using this storage, then explicitly pass --server-stopped.");
  if (!projectIdSchema.safeParse(id).success) throw new ProjectError(400, "A valid project identifier is required.");
  const directory = projectDirectory();
  if (!directory) return false;
  const path = join(directory, `.${id}.lock`);
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.size > 4096) throw new ProjectError(409, "The lock is not a regular project lock file.");
    let pid: unknown;
    try { pid = JSON.parse(readFileSync(fd, "utf8")).pid; } catch { /* A crash can precede or interrupt writing the owner record. */ }
    if (typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        throw new ProjectError(409, `Lock owner process ${pid} is still running. Stop all Baste writers before repairing this lock.`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
          if (error instanceof ProjectError) throw error;
          throw new ProjectError(409, "The lock owner could not be confirmed stopped.");
        }
      }
    }
    const current = lstatSync(path);
    if (!current.isFile() || current.dev !== opened.dev || current.ino !== opened.ino || current.size !== opened.size || current.mtimeMs !== opened.mtimeMs) throw new ProjectError(409, "The lock changed during inspection. Stop every writer and try again.");
    unlinkSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    if (error instanceof ProjectError) throw error;
    throw new ProjectError(500, "The interrupted project lock could not be repaired safely.");
  } finally { if (fd !== undefined) closeSync(fd); }
}

function main(): void {
  const args = process.argv.slice(2);
  let id: string | undefined;
  let did: string | undefined;
  let serverStopped = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--project") id = args[++index];
    else if (args[index] === "--account") did = args[++index];
    else if (args[index] === "--server-stopped") serverStopped = true;
    else throw new ProjectError(400, "Usage: node dist/src/projects/repair-lock.js --project <id> [--account <did>] --server-stopped");
  }
  if (!id) throw new ProjectError(400, "Provide --project <id>. Run from the same directory as the stopped Baste server.");
  if (did !== undefined && !/^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/.test(did)) throw new ProjectError(400, "Provide the project owner's valid account DID.");
  const repair = () => repairProjectLock(id!, { serverStopped });
  const repaired = did ? accountScope.run(did, repair) : repair();
  process.stdout.write(repaired ? "Interrupted project lock removed. Project history and command receipts are unchanged. You may restart Baste.\n" : "No project lock needs repair.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Project lock repair failed."}\n`);
    process.exitCode = 1;
  }
}
