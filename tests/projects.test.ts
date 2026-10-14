import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createProject, getProject, listProjects, applyProjectCommand, ProjectError } from "../dist/src/projects/commands.js";
import { accountPath, accountScope } from "../dist/src/notorganic/scope.js";
import { savePersona } from "../dist/src/notorganic/personas.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import { repairProjectLock } from "../dist/src/projects/repair-lock.js";

const exec = promisify(execFile);
const commandsUrl = new URL("../dist/src/projects/commands.js", import.meta.url).href;
const scopeUrl = new URL("../dist/src/notorganic/scope.js", import.meta.url).href;
const alice = "did:plc:project-alice";
const bob = "did:plc:project-bob";
function environment(t: any, hosted = true) {
  const before = process.cwd();
  const enabled = process.env.NOTORGANIC_ENABLED;
  const directory = mkdtempSync(join(tmpdir(), "baste-projects-"));
  process.chdir(directory);
  process.env.NOTORGANIC_ENABLED = String(hosted);
  t.after(() => {
    process.chdir(before);
    if (enabled === undefined) delete process.env.NOTORGANIC_ENABLED; else process.env.NOTORGANIC_ENABLED = enabled;
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}
const isStatus = (status: number) => (error: unknown) => error instanceof ProjectError && error.status === status;
const create = (extra: Record<string, unknown> = {}) => createProject({ commandId: randomUUID(), name: "Field notes", brief: "A quiet place to collect ideas.", ...extra });
async function child(did: string, action: string, payload: unknown) {
  const source = `import * as commands from ${JSON.stringify(commandsUrl)};
    import { accountScope } from ${JSON.stringify(scopeUrl)};
    const [did, action, payload] = JSON.parse(process.argv[1]);
    await accountScope.run(did, async () => {
      try {
        const value = action === "get" ? await commands.getProject(payload) : await commands.applyProjectCommand(payload.id, payload.command);
        process.stdout.write(JSON.stringify({ value }));
      } catch (error) { process.stdout.write(JSON.stringify({ status: error.status, message: error.message })); }
    });`;
  const output = await exec(process.execPath, ["--input-type=module", "--eval", source, JSON.stringify([did, action, payload])], { cwd: process.cwd(), env: process.env });
  return JSON.parse(output.stdout);
}

test("hosted project services require an account and never fall back to local data", async t => {
  environment(t, false);
  const local = await create();
  assert.equal((await listProjects()).length, 1);
  process.env.NOTORGANIC_ENABLED = "true";
  for (const operation of [() => listProjects(), () => getProject(local.project.id), () => create(), () => applyProjectCommand(local.project.id, { commandId: randomUUID(), baseRevision: 1, kind: "update_details", name: "Changed", brief: "" })]) await assert.rejects(operation, isStatus(401));
  await accountScope.run(alice, async () => {
    assert.deepEqual(await listProjects(), []);
    await assert.rejects(() => getProject(local.project.id), isStatus(404));
  });
});

test("projects and persona snapshots are isolated by account and persist across process restarts", async t => {
  environment(t);
  const project = await accountScope.run(alice, async () => {
    savePersona({ ...basePersonas.cyberbotanist, id: "private", name: "Alice's audience" });
    const result = await create({ personaId: "private" });
    savePersona({ ...basePersonas.cyberbotanist, id: "private", name: "Later audience name" });
    assert.equal((await getProject(result.project.id)).project.audience?.name, "Alice's audience");
    return result;
  });
  await accountScope.run(bob, async () => {
    assert.deepEqual(await listProjects(), []);
    await assert.rejects(() => getProject(project.project.id), isStatus(404));
    await assert.rejects(() => create({ personaId: "private" }), isStatus(404));
    const own = await create({ personaId: "cyberbotanist" });
    assert.equal(own.project.audience?.id, "cyberbotanist");
    await assert.rejects(() => applyProjectCommand(project.project.id, { kind: "update_details", commandId: randomUUID(), baseRevision: 1, name: "Intrusion", brief: "" }), isStatus(404));
  });
  const reopened = await child(alice, "get", project.project.id);
  assert.deepEqual(reopened.value, project);
  assert.equal((await child(bob, "get", project.project.id)).status, 404);
});

test("creation retries retain their original result after later edits and reject identifier reuse", async t => {
  environment(t);
  await accountScope.run(alice, async () => {
    const request = { commandId: randomUUID(), name: "First name", brief: "Initial brief" };
    const copies = await Promise.all([createProject(request), createProject(request), createProject(request)]);
    assert.deepEqual(copies[1], copies[0]); assert.deepEqual(copies[2], copies[0]);
    const first = copies[0];
    await applyProjectCommand(first.project.id, { commandId: randomUUID(), baseRevision: 1, kind: "update_details", name: "Later name", brief: "Later brief" });
    assert.deepEqual(await createProject(request), first);
    assert.equal((await listProjects()).length, 1);
    await assert.rejects(() => createProject({ ...request, name: "Another project" }), isStatus(409));
    assert.equal((await getProject(first.project.id)).project.name, "Later name");
  });
});

test("revision checks serialize concurrent writers including writers in separate processes", async t => {
  environment(t);
  const project = await accountScope.run(alice, () => create());
  const command = (name: string) => ({ commandId: randomUUID(), baseRevision: 1, kind: "update_details", name, brief: "Updated" });
  const results = await Promise.all(Array.from({ length: 4 }, (_, index) => child(alice, "apply", { id: project.project.id, command: command(`Writer ${index}`) })));
  assert.equal(results.filter(result => result.value?.project.revision === 2).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 3);
  await accountScope.run(alice, async () => {
    const current = await getProject(project.project.id);
    assert.equal(current.revisions.length, 2);
    const edits = ["A", "B"].map(name => applyProjectCommand(project.project.id, { ...command(name), baseRevision: 2 }));
    const settled = await Promise.allSettled(edits);
    assert.equal(settled.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(settled.filter(result => result.status === "rejected" && result.reason.status === 409).length, 1);
  });
});

test("durable command receipts replay exact prior results and reject altered payloads", async t => {
  environment(t);
  await accountScope.run(alice, async () => {
    const first = await create();
    const command = { commandId: randomUUID(), baseRevision: 1, kind: "update_details", name: "New name", brief: "More precise brief" };
    const edited = await applyProjectCommand(first.project.id, command);
    await applyProjectCommand(first.project.id, { kind: "select_audience", commandId: randomUUID(), baseRevision: 2, personaId: "cyberbotanist" });
    assert.deepEqual(await applyProjectCommand(first.project.id, command), edited);
    assert.deepEqual((await child(alice, "apply", { id: first.project.id, command })).value, edited);
    await assert.rejects(() => applyProjectCommand(first.project.id, { ...command, baseRevision: 3 }), isStatus(409));
    await assert.rejects(() => applyProjectCommand(first.project.id, { ...command, name: "Different" }), isStatus(409));
    assert.equal((await getProject(first.project.id)).project.revision, 3);
  });
});

test("restoring creates a new revision with exact prior content and preserves subsequent history", async t => {
  environment(t);
  await accountScope.run(alice, async () => {
    const first = await create({ personaId: "cyberbotanist" });
    await applyProjectCommand(first.project.id, { kind: "update_details", commandId: randomUUID(), baseRevision: 1, name: "Second", brief: "Second brief" });
    await applyProjectCommand(first.project.id, { kind: "select_audience", commandId: randomUUID(), baseRevision: 2, personaId: null });
    const restored = await applyProjectCommand(first.project.id, { kind: "restore_revision", commandId: randomUUID(), baseRevision: 3, targetRevision: 1 });
    assert.deepEqual(restored.project, { ...first.project, revision: 4, updatedAt: restored.project.updatedAt });
    assert.deepEqual(restored.revisions.map(revision => revision.kind), ["created", "details_updated", "audience_selected", "revision_restored"]);
    assert.equal(restored.revisions[3].restoredFrom, 1);
    const restoredLater = await applyProjectCommand(first.project.id, { kind: "restore_revision", commandId: randomUUID(), baseRevision: 4, targetRevision: 3 });
    assert.equal(restoredLater.project.name, "Second");
    assert.equal(restoredLater.project.audience, null);
    assert.equal(restoredLater.project.revision, 5);
    await assert.rejects(() => applyProjectCommand(first.project.id, { kind: "restore_revision", commandId: randomUUID(), baseRevision: 5, targetRevision: 999 }), isStatus(404));
  });
});

test("commands reject unknown ownership, excessive fields and traversal identifiers without writing", async t => {
  environment(t);
  await accountScope.run(alice, async () => {
    for (const invalid of [{ did: bob }, { owner: bob }, { name: " " }, { name: "x".repeat(121) }, { brief: "x".repeat(12001) }, { commandId: "../../escape" }, { personaId: "../../escape" }, { audience: basePersonas.cyberbotanist }]) await assert.rejects(() => create(invalid), isStatus(400));
    assert.deepEqual(await listProjects(), []);
    const first = await create();
    for (const id of ["../../escape", "%2e%2e%2fescape", first.project.id + "/extra", "constructor"]) await assert.rejects(() => getProject(id), isStatus(404));
    const command = { kind: "update_details", commandId: randomUUID(), baseRevision: 1, name: "Changed", brief: "" };
    for (const invalid of [{ did: bob }, { revision: 20 }, { baseRevision: 0 }, { baseRevision: 1.5 }, { partner: {} }, { kind: "execute_javascript" }]) await assert.rejects(() => applyProjectCommand(first.project.id, { ...command, ...invalid }), isStatus(400));
    assert.deepEqual(await getProject(first.project.id), first);
  });
});

test("damaged records fail visibly and are never overwritten or silently reset", async t => {
  environment(t);
  await accountScope.run(alice, async () => {
    const request = { commandId: randomUUID(), name: "Durable", brief: "" };
    const first = await createProject(request);
    const path = join(accountPath("projects", ".baste/projects"), `${first.project.id}.json`);
    writeFileSync(path, "{damaged");
    await assert.rejects(() => getProject(first.project.id), isStatus(500));
    await assert.rejects(() => listProjects(), isStatus(500));
    await assert.rejects(() => createProject(request), isStatus(500));
    await assert.rejects(() => applyProjectCommand(first.project.id, { kind: "update_details", commandId: randomUUID(), baseRevision: 1, name: "Overwritten", brief: "" }), isStatus(500));
    assert.equal(readFileSync(path, "utf8"), "{damaged");
  });
});

test("project files and storage ancestors cannot escape through symlinks", async t => {
  const directory = environment(t);
  const first = await accountScope.run(alice, () => create());
  const outside = join(directory, "outside.json");
  writeFileSync(outside, "private external contents");
  await accountScope.run(alice, async () => {
    const path = join(accountPath("projects", ".baste/projects"), `${first.project.id}.json`);
    rmSync(path); symlinkSync(outside, path);
    await assert.rejects(() => getProject(first.project.id), isStatus(500));
    await assert.rejects(() => applyProjectCommand(first.project.id, { kind: "update_details", commandId: randomUUID(), baseRevision: 1, name: "Escape", brief: "" }), isStatus(500));
    assert.equal(readFileSync(outside, "utf8"), "private external contents");
  });
  await accountScope.run(bob, async () => {
    const storage = accountPath("projects", ".baste/projects");
    mkdirSync(join(storage, ".."), { recursive: true });
    symlinkSync(directory, storage, "dir");
    await assert.rejects(() => listProjects(), isStatus(500));
    await assert.rejects(() => create(), isStatus(500));
  });
});

test("hosted audience snapshots reject linked persona files from outside their account", async t => {
  const directory = environment(t);
  await accountScope.run(alice, async () => {
    const personas = accountPath("personas", "personas");
    mkdirSync(personas, { recursive: true });
    const outside = join(directory, "other-account-persona.json");
    writeFileSync(outside, JSON.stringify({ ...basePersonas.cyberbotanist, id: "linked", name: "Private external audience" }));
    symlinkSync(outside, join(personas, "linked.json"));
    await assert.rejects(() => create({ personaId: "linked" }), isStatus(500));
    assert.deepEqual(await listProjects(), []);
  });
});

test("operator repair reopens an interrupted project without losing its durable replay receipt", async t => {
  environment(t);
  await accountScope.run(alice, async () => {
    const first = await create();
    const command = { kind: "update_details", commandId: randomUUID(), baseRevision: 1, name: "Saved before interruption", brief: "Retained" };
    const edited = await applyProjectCommand(first.project.id, command);
    const lock = join(accountPath("projects", ".baste/projects"), `.${first.project.id}.lock`);
    // Obtain a real terminated process id instead of guessing an unused process.
    const terminated = await exec(process.execPath, ["--eval", "process.stdout.write(String(process.pid))"]);
    writeFileSync(lock, JSON.stringify({ pid: Number(terminated.stdout), acquiredAt: new Date().toISOString() }));
    assert.throws(() => repairProjectLock(first.project.id, { serverStopped: false }), isStatus(400));
    const repairScript = new URL("../dist/src/projects/repair-lock.js", import.meta.url);
    const repaired = await exec(process.execPath, [repairScript.pathname, "--project", first.project.id, "--account", alice, "--server-stopped"], { cwd: process.cwd(), env: process.env });
    assert.match(repaired.stdout, /lock removed/);
    assert.deepEqual(await applyProjectCommand(first.project.id, command), edited);
    const next = await applyProjectCommand(first.project.id, { ...command, commandId: randomUUID(), baseRevision: 2, name: "Recovered" });
    assert.equal(next.project.revision, 3);
    assert.deepEqual(next.revisions.slice(0, 2), edited.revisions);
    // Recovery also covers a crash before writing any lock-owner metadata.
    writeFileSync(lock, "");
    assert.equal(repairProjectLock(first.project.id, { serverStopped: true }), true);
    assert.equal(repairProjectLock(first.project.id, { serverStopped: true }), false);
    // A mistaken stop assertion must never remove a known active owner's lock.
    writeFileSync(lock, JSON.stringify({ pid: process.pid }));
    assert.throws(() => repairProjectLock(first.project.id, { serverStopped: true }), isStatus(409));
    assert.equal(JSON.parse(readFileSync(lock, "utf8")).pid, process.pid);
    rmSync(lock);
    const external = join(process.cwd(), "external-lock");
    writeFileSync(external, "outside"); symlinkSync(external, lock);
    assert.throws(() => repairProjectLock(first.project.id, { serverStopped: true }), isStatus(500));
    assert.equal(readFileSync(external, "utf8"), "outside");
  });
});
