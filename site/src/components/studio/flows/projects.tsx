import { $, component$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, openView, refreshAccount, selectProject, toast, type StudioState } from "../context";
import { btn, chip, emptyBox, fieldLabel, hint, input, kicker, panel, panelTitle, textarea } from "../ui";
import { PROJECT_LIMITS, ProjectRequestError, createProject, getProject, listProjects, runProjectCommand, type ProjectCommand, type ProjectDetail, type ProjectSummary } from "~/lib/projects";

interface Draft {
  name: string;
  brief: string;
  audienceId: string;
  baseRevision: number;
}

interface ProjectFlowState {
  active: boolean;
  list: ProjectSummary[];
  listLoading: boolean;
  listError: string;
  listAttempt: number;
  detail: ProjectDetail | null;
  detailLoading: boolean;
  detailAttempt: number;
  detailSequence: number;
  drafts: Record<string, Draft>;
  createName: string;
  createBrief: string;
  createAudience: string;
  createCommandId: string;
  createPayload: string;
  commandId: string;
  commandPayload: string;
  pending: string;
  error: string;
  conflict: boolean;
  expired: boolean;
  restoreRevision: number | null;
}

function scopeKey(s: StudioState): string {
  const a = s.account.status;
  return `${s.apiBase}:${s.status}:${a?.configured}:${a?.authenticated}:${a?.profile?.did ?? ""}:${a?.csrfToken ?? ""}`;
}

function available(s: StudioState): boolean {
  return s.status === "live" && s.account.status !== null && (!s.account.status.configured || s.account.status.authenticated);
}

function draftFrom(detail: ProjectDetail): Draft {
  const p = detail.project;
  return { name: p.name, brief: p.brief, audienceId: p.audience?.id ?? "", baseRevision: p.revision };
}

function acceptDetail(f: ProjectFlowState, detail: ProjectDetail, fields: "all" | "details" | "audience" = "all") {
  const p = detail.project;
  const oldDraft = f.drafts[p.id];
  const next = draftFrom(detail);
  if (oldDraft && fields === "details") next.audienceId = oldDraft.audienceId;
  if (oldDraft && fields === "audience") { next.name = oldDraft.name; next.brief = oldDraft.brief; }
  f.detail = detail;
  f.drafts = { ...f.drafts, [p.id]: next };
  f.list = [
    { id: p.id, name: p.name, brief: p.brief, audienceName: p.audience?.name ?? null, revision: p.revision, updatedAt: p.updatedAt },
    ...f.list.filter((item) => item.id !== p.id),
  ];
  f.conflict = false;
  f.error = "";
  f.restoreRevision = null;
}

function reportError(f: ProjectFlowState, error: unknown) {
  f.error = errMsg(error);
  f.conflict = error instanceof ProjectRequestError && error.status === 409;
  f.expired = error instanceof ProjectRequestError && (error.status === 401 || error.status === 403);
}

function displayDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const ProjectsFlow = component$(() => {
  const s = useContext(StudioCtx);
  const f = useStore<ProjectFlowState>({
    active: false, list: [], listLoading: true, listError: "", listAttempt: 0,
    detail: null, detailLoading: false, detailAttempt: 0, detailSequence: 0, drafts: {},
    createName: "", createBrief: "", createAudience: "", createCommandId: "", createPayload: "",
    commandId: "", commandPayload: "",
    pending: "", error: "", conflict: false, expired: false, restoreRevision: null,
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    f.active = true;
    cleanup(() => { f.active = false; });
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track, cleanup }) => {
    const scope = track(() => scopeKey(s));
    track(() => f.listAttempt);
    if (!available(s)) { f.listLoading = false; return; }
    const controller = new AbortController();
    cleanup(() => controller.abort());
    f.listLoading = true;
    f.listError = "";
    try {
      const list = await listProjects(s.apiBase, controller.signal);
      if (controller.signal.aborted || scopeKey(s) !== scope) return;
      const merged = new Map(f.list.map((project) => [project.id, project]));
      for (const project of list) {
        if ((merged.get(project.id)?.revision ?? 0) <= project.revision) merged.set(project.id, project);
      }
      f.list = [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (error) {
      if (!controller.signal.aborted && scopeKey(s) === scope) f.listError = errMsg(error);
    } finally {
      if (!controller.signal.aborted && scopeKey(s) === scope) f.listLoading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track, cleanup }) => {
    const id = track(() => s.projectId);
    const scope = track(() => scopeKey(s));
    track(() => f.detailAttempt);
    const sequence = ++f.detailSequence;
    const controller = new AbortController();
    cleanup(() => controller.abort());
    f.error = "";
    f.conflict = false;
    f.expired = false;
    f.restoreRevision = null;
    if (!id || !available(s)) { f.detail = null; f.detailLoading = false; return; }
    if (f.detail?.project.id !== id) f.detail = null;
    f.detailLoading = true;
    const current = () => !controller.signal.aborted && sequence === f.detailSequence && scopeKey(s) === scope && s.projectId === id;
    try {
      const detail = await getProject(s.apiBase, id, controller.signal);
      if (!current()) return;
      f.detail = detail;
      if (!f.drafts[id]) f.drafts = { ...f.drafts, [id]: draftFrom(detail) };
    } catch (error) {
      if (current()) reportError(f, error);
    } finally {
      if (current()) f.detailLoading = false;
    }
  });

  const create = $(async () => {
    if (!available(s) || s.account.loading || f.pending) return;
    const name = f.createName.trim();
    const brief = f.createBrief.trim();
    if (!name || !brief) return;
    const scope = scopeKey(s);
    const selection = s.projectId;
    const payload = JSON.stringify({ name, brief, ...(f.createAudience ? { personaId: f.createAudience } : {}) });
    if (f.createPayload !== payload || !f.createCommandId) {
      f.createPayload = payload;
      f.createCommandId = crypto.randomUUID();
    }
    f.pending = "create";
    f.error = "";
    const current = () => f.active && scopeKey(s) === scope && s.projectId === selection;
    try {
      const detail = await createProject(s.apiBase, { ...JSON.parse(payload), commandId: f.createCommandId }, s.account.status?.csrfToken);
      if (!current()) return;
      acceptDetail(f, detail);
      f.createName = "";
      f.createBrief = "";
      f.createAudience = "";
      f.createCommandId = "";
      f.createPayload = "";
      toast(s, "Project saved");
      selectProject(s, detail.project.id);
    } catch (error) {
      if (current()) reportError(f, error);
    } finally {
      if (f.active && scopeKey(s) === scope) f.pending = "";
    }
  });

  const command = $(async (kind: "update_details" | "select_audience" | "restore_revision", targetRevision?: number) => {
    const id = s.projectId;
    const draft = f.drafts[id];
    if (!available(s) || s.account.loading || f.pending || !draft || !f.detail || draft.baseRevision !== f.detail.project.revision) return;
    const scope = scopeKey(s);
    const base = { commandId: "", baseRevision: draft.baseRevision };
    let body: ProjectCommand;
    if (kind === "update_details") body = { ...base, kind, name: draft.name.trim(), brief: draft.brief.trim() };
    else if (kind === "select_audience") body = { ...base, kind, personaId: draft.audienceId || null };
    else if (targetRevision !== undefined) body = { ...base, kind, targetRevision };
    else return;
    const payload = JSON.stringify({ projectId: id, command: body });
    if (f.commandPayload !== payload || !f.commandId) {
      f.commandPayload = payload;
      f.commandId = crypto.randomUUID();
    }
    body.commandId = f.commandId;
    f.pending = kind;
    f.error = "";
    const current = () => f.active && scopeKey(s) === scope && s.projectId === id;
    try {
      const detail = await runProjectCommand(s.apiBase, id, body, s.account.status?.csrfToken);
      if (!current()) return;
      acceptDetail(f, detail, kind === "update_details" ? "details" : kind === "select_audience" ? "audience" : "all");
      f.commandId = "";
      f.commandPayload = "";
      toast(s, kind === "restore_revision" ? "Earlier version restored" : kind === "select_audience" ? "Audience saved" : "Project saved");
    } catch (error) {
      if (current()) reportError(f, error);
    } finally {
      if (f.active && scopeKey(s) === scope) f.pending = "";
    }
  });

  const detail = f.detail?.project.id === s.projectId ? f.detail : null;
  const p = detail?.project;
  const draft = p ? f.drafts[p.id] : undefined;
  const changedDetails = !!p && !!draft && (draft.name !== p.name || draft.brief !== p.brief);
  const changedAudience = !!p && !!draft && draft.audienceId !== (p.audience?.id ?? "");
  const changed = changedDetails || changedAudience;
  const newerVersion = !!p && !!draft && p.revision !== draft.baseRevision;
  const locked = !!f.pending || f.detailLoading || s.account.loading;
  const ready = available(s);

  return (
    <div class={css({ maxW: "1120px", display: "flex", flexDirection: "column", gap: 6 })}>
      <header>
        <span class={kicker}>A place for the whole design</span>
        <h1 class={`display ${css({ fontSize: { base: "32px", md: "40px" } })}`}>Projects</h1>
        <p class={css({ color: "ink-soft", maxW: "62ch", mt: 2 })}>Keep the purpose, audience and decisions together. Start with a brief; return to it as the application takes shape.</p>
      </header>

      {!ready ? (
        <section class={emptyBox} aria-live="polite">
          <h2 class={panelTitle}>{s.status === "connecting" || s.account.loading ? "Connecting to your workroom…" : s.status !== "live" ? "Connect to save your projects" : s.account.status?.configured ? "Your projects belong to you" : "Your account connection needs attention"}</h2>
          <p>{s.status === "connecting" || s.account.loading ? "Checking the server and your account." : s.status !== "live" ? "Projects need a running Baste server. The demo wardrobe is still available to explore." : s.account.status?.configured ? "Sign in or create a Not Organic profile to save and reopen projects." : s.account.error || "Check the account connection before opening projects."}</p>
          {s.status !== "connecting" && !s.account.loading && <button type="button" class={btn("primary")} onClick$={() => openView(s, "settings")}>{s.account.status?.configured ? "Open account settings" : "Open connection settings"}</button>}
        </section>
      ) : (
        <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "240px minmax(0, 1fr)" }, alignItems: "start", gap: { base: 6, xl: 8 } })}>
          <aside aria-label="Saved projects" class={css({ minW: 0 })}>
            <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2 })}>
              <h2 class={kicker}>Your projects</h2>
              <button type="button" class={btn("ghost", css({ px: 2 }))} disabled={!!f.pending} onClick$={() => selectProject(s, "")}>+ New</button>
            </div>
            {f.listLoading && <p class={hint} role="status">Loading projects…</p>}
            {f.listError && <div role="alert"><p class={hint}>{f.listError}</p><button type="button" class={btn("ghost")} onClick$={() => f.listAttempt++}>Try again</button></div>}
            {!f.listLoading && !f.listError && f.list.length === 0 && <p class={css({ color: "ink-muted", fontSize: "14px", lineHeight: 1.6 })}>Your first project starts with what you’re making and who it’s for.</p>}
            <ul class={css({ listStyle: "none", display: "grid", gridTemplateColumns: { base: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", xl: "minmax(0, 1fr)" }, gap: 2 })}>
              {f.list.map((project) => <li key={project.id}>
                <button type="button" aria-current={s.projectId === project.id ? "true" : undefined} disabled={!!f.pending}
                  onClick$={() => selectProject(s, project.id)}
                  class={css({ w: "100%", textAlign: "left", p: 3, rounded: "base", border: "1px solid token(colors.rule)", bg: "transparent", cursor: "pointer", _hover: { bg: "paper-deep" }, "&[aria-current=true]": { bg: "card", borderColor: "ink", boxShadow: "sheet" }, _disabled: { opacity: 0.6, cursor: "wait" } })}>
                  <span class={css({ display: "block", fontWeight: 600, overflowWrap: "anywhere", fontSize: "15px" })}>{project.name}</span>
                  <span class={css({ display: "block", color: "ink-muted", fontSize: "12px", mt: 1, overflowWrap: "anywhere" })}>{project.audienceName || "Audience still open"}</span>
                  <span class={css({ display: "block", color: "ink-muted", fontFamily: "mono", fontSize: "10px", mt: 3 })}>Version {project.revision}</span>
                </button>
              </li>)}
            </ul>
            <p class={hint} style={{ marginTop: "16px" }}>{s.account.status?.authenticated ? "Saved to your Not Organic account’s Baste workspace." : "Saved on this Baste server."}</p>
          </aside>

          <div class={css({ minW: 0, display: "flex", flexDirection: "column", gap: 5 })}>
            {f.error && <div class={css({ p: 4, border: "1px solid token(colors.rule-strong)", bg: "paper-deep", rounded: "base" })} role="alert">
              <p class={css({ fontWeight: 600, overflowWrap: "anywhere" })}>{f.conflict ? "This project has a newer saved version." : f.error}</p>
              <p class={hint}>{!s.projectId || f.drafts[s.projectId] ? `Your draft is still here.${f.conflict ? " Load the latest version to compare before saving again." : " You can retry without re-entering it."}` : "Try again or choose another project."}</p>
              {f.expired ? <button type="button" class={btn("secondary", css({ mt: 3 }))} onClick$={() => refreshAccount(s)}>Refresh account</button>
                : s.projectId && <button type="button" class={btn("secondary", css({ mt: 3 }))} disabled={locked} onClick$={() => f.detailAttempt++}>{f.conflict ? "Load latest; keep my draft" : "Reload project; keep my draft"}</button>}
            </div>}

            {!s.projectId ? (
              <section class={panel} aria-labelledby="project-new-title">
                <span class={kicker}>First measurements</span>
                <h2 id="project-new-title" class={panelTitle} style={{ marginTop: "8px" }}>What are you making?</h2>
                <form preventdefault:submit onSubmit$={create} class={css({ display: "flex", flexDirection: "column", gap: 5, mt: 5 })}>
                  <div><label class={fieldLabel} for="project-name">Project name</label><input id="project-name" class={input} required maxLength={PROJECT_LIMITS.name} disabled={locked} value={f.createName} onInput$={(_, el) => f.createName = el.value} placeholder="A name for this application" autoComplete="off" /></div>
                  <div><label class={fieldLabel} for="project-brief">The brief</label><textarea id="project-brief" class={textarea} rows={6} required maxLength={PROJECT_LIMITS.brief} disabled={locked} value={f.createBrief} onInput$={(_, el) => f.createBrief = el.value} placeholder="What should this application help people do? What should it feel like?" aria-describedby="project-brief-hint" /><p id="project-brief-hint" class={hint}>A few sentences are enough. You can keep refining this.</p></div>
                  <div><label class={fieldLabel} for="project-audience">Who is it for? <span class={css({ fontWeight: 400, color: "ink-muted" })}>Optional</span></label><select id="project-audience" class={input} disabled={locked || s.loading} value={f.createAudience} onChange$={(_, el) => f.createAudience = el.value}><option value="">Decide as the project develops</option>{s.personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.name}</option>)}</select><p class={hint}>Choose an existing persona as a starting audience. The project keeps its own copy.</p></div>
                  <div><button type="submit" class={btn("primary")} disabled={locked || !f.createName.trim() || !f.createBrief.trim()}>{f.pending === "create" ? "Saving project…" : "Create project"}</button></div>
                </form>
              </section>
            ) : f.detailLoading && !detail ? <div class={emptyBox} role="status">Opening project…</div>
              : !detail && !f.error ? <div class={emptyBox}>Choose a project to continue.</div>
              : p && draft && detail && <>
                <div class={css({ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 3 })}>
                  <span class={chip}>Version {p.revision} · {changed ? "Unsaved changes" : "Saved"}</span>
                  <span class={hint}>Updated <time dateTime={p.updatedAt}>{displayDate(p.updatedAt)}</time></span>
                </div>

                {newerVersion && <section class={panel} aria-labelledby="project-compare-title">
                  <h2 id="project-compare-title" class={panelTitle}>Review the latest version</h2>
                  <p class={hint}>Your draft began at version {draft.baseRevision}. Version {p.revision} is now saved. Choose which details to keep before saving.</p>
                  <div class={css({ mt: 4, border: "1px solid token(colors.rule)", bg: "paper-deep", p: 4, rounded: "base" })}>
                    <p class={css({ fontWeight: 600, overflowWrap: "anywhere" })}>{p.name}</p><p class={css({ mt: 2, color: "ink-soft", fontSize: "14px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" })}>{p.brief}</p><p class={hint}>Audience: {p.audience?.name || "Not selected"}</p>
                  </div>
                  <div class={css({ display: "flex", flexWrap: "wrap", gap: 2, mt: 4 })}>
                    <button type="button" class={btn("secondary")} disabled={locked} onClick$={() => { f.drafts[p.id] = { ...draft, baseRevision: p.revision }; f.error = ""; f.conflict = false; }}>Keep my draft for the next save</button>
                    <button type="button" class={btn("ghost")} disabled={locked} onClick$={() => { f.drafts[p.id] = draftFrom(detail); f.error = ""; f.conflict = false; }}>Replace my draft with saved version</button>
                  </div>
                </section>}

                <section class={panel} aria-labelledby="project-details-title">
                  <h2 id="project-details-title" class={panelTitle}>The brief</h2>
                  <form preventdefault:submit onSubmit$={() => command("update_details")} class={css({ display: "flex", flexDirection: "column", gap: 4, mt: 5 })}>
                    <div><label class={fieldLabel} for="project-edit-name">Project name</label><input id="project-edit-name" class={input} required maxLength={PROJECT_LIMITS.name} value={draft.name} disabled={locked} onInput$={(_, el) => draft.name = el.value} /></div>
                    <div><label class={fieldLabel} for="project-edit-brief">Purpose, priorities and direction</label><textarea id="project-edit-brief" class={textarea} rows={7} required maxLength={PROJECT_LIMITS.brief} value={draft.brief} disabled={locked} onInput$={(_, el) => draft.brief = el.value} /></div>
                    <div class={css({ display: "flex", flexWrap: "wrap", gap: 2 })}><button type="submit" class={btn("primary")} disabled={locked || newerVersion || !changedDetails || !draft.name.trim() || !draft.brief.trim()}>{f.pending === "update_details" ? "Saving…" : "Save brief"}</button>{changedDetails && <button type="button" class={btn("ghost")} disabled={locked} onClick$={() => { draft.name = p.name; draft.brief = p.brief; }}>Discard brief edits</button>}</div>
                  </form>
                </section>

                <section class={panel} aria-labelledby="project-audience-title">
                  <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 3, flexWrap: "wrap" })}>
                    <div><span class={kicker}>The people you’re designing for</span><h2 id="project-audience-title" class={panelTitle} style={{ marginTop: "8px" }}>{p.audience?.name || "Choose an audience"}</h2></div>
                    {p.audience && s.personas.some((persona) => persona.id === p.audience?.id) && <a class={btn("secondary")} href={`/gui/?persona=${encodeURIComponent(p.audience.id)}`} target="_blank" rel="noopener noreferrer">Open source fitting ↗</a>}
                  </div>
                  {p.audience && <><p class={css({ mt: 4, color: "ink-soft", lineHeight: 1.6 })}>{p.audience.summary}</p><div class={css({ display: "flex", flexWrap: "wrap", gap: 2, mt: 3 })}>{p.audience.culture.subcultures.slice(0, 5).map((value, index) => <span key={`${index}-${value}`} class={chip}>{value}</span>)}</div></>}
                  <form preventdefault:submit onSubmit$={() => command("select_audience")} class={css({ mt: 5 })}>
                    <label class={fieldLabel} for="project-edit-audience">Project audience</label>
                    <select id="project-edit-audience" class={input} disabled={locked || s.loading} value={draft.audienceId} onChange$={(_, el) => draft.audienceId = el.value}>
                      <option value="">No audience selected yet</option>
                      {p.audience && !s.personas.some((persona) => persona.id === p.audience?.id) && <option value={p.audience.id}>{`Saved audience · ${p.audience.name}`}</option>}
                      {s.personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.name}</option>)}
                    </select>
                    <p class={hint}>This project keeps a snapshot. Editing the source fitting does not change the saved audience here.</p>
                    <div class={css({ display: "flex", flexWrap: "wrap", gap: 2, mt: 4 })}><button type="submit" class={btn("secondary")} disabled={locked || newerVersion || !changedAudience}>{f.pending === "select_audience" ? "Saving audience…" : "Save audience"}</button>{changedAudience && <button type="button" class={btn("ghost")} disabled={locked} onClick$={() => draft.audienceId = p.audience?.id ?? ""}>Discard audience change</button>}</div>
                  </form>
                </section>

                <section class={panel} aria-labelledby="project-history-title">
                  <h2 id="project-history-title" class={panelTitle}>Project history</h2>
                  <p class={hint}>Return to an earlier brief and audience. Restoring adds a version and keeps the history.</p>
                  {changed && <p class={hint}>Save or discard your edits before restoring a version.</p>}
                  <ol class={css({ listStyle: "none", mt: 4 })}>
                    {[...detail.revisions].sort((a, b) => b.revision - a.revision).map((revision) => <li key={revision.revision} class={css({ py: 4, borderTop: "1px solid token(colors.rule)" })}>
                      <div class={css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 3, flexWrap: "wrap" })}>
                        <div class={css({ minW: 0 })}><p class={css({ fontSize: "14px", fontWeight: 600, overflowWrap: "anywhere" })}>{revision.summary}</p><p class={hint}>Version {revision.revision} · <time dateTime={revision.createdAt}>{displayDate(revision.createdAt)}</time></p></div>
                        {revision.revision === p.revision ? <span class={kicker}>Current</span> : <button type="button" class={btn("ghost")} disabled={locked || changed || newerVersion} onClick$={() => f.restoreRevision = revision.revision}>Restore version {revision.revision}</button>}
                      </div>
                      {f.restoreRevision === revision.revision && <div class={css({ mt: 3, p: 4, bg: "paper-deep", rounded: "base" })}>
                        <p class={css({ fontSize: "14px" })}>Restore the brief and audience from version {revision.revision}?</p>
                        <div class={css({ display: "flex", flexWrap: "wrap", gap: 2, mt: 3 })}><button type="button" class={btn("primary")} disabled={locked || changed} onClick$={() => command("restore_revision", revision.revision)}>{f.pending === "restore_revision" ? "Restoring…" : "Restore this version"}</button><button type="button" class={btn("ghost")} disabled={locked} onClick$={() => f.restoreRevision = null}>Cancel</button></div>
                      </div>}
                    </li>)}
                  </ol>
                </section>
              </>}
          </div>
        </div>
      )}
    </div>
  );
});
