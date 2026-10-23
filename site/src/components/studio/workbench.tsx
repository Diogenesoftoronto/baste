import { $, Slot, component$, noSerialize, sync$, useContext, useContextProvider, useStore, useTask$, useVisibleTask$, type NoSerialize, type QRL } from "@builder.io/qwik";
import { css, cx } from "styled-system/css";
import type { ReactiveAssign } from "@openuidev/lang-core";
import type { Persona } from "~/lib/api-types";
import { CATALOG_VERSION, READ_TOOLS, WRITE_TOOLS, library } from "~/lib/openui/catalog";
import { draftProgram, requestSurface, type PartnerTurn } from "~/lib/openui/partner";
import { SurfaceRuntime, type RuntimeSnapshot } from "~/lib/openui/runtime";
import { starterProgram } from "~/lib/openui/starter";
import { getProjectDesign, runProjectCommand, type DesignChanges, type ProjectDesign, type ProjectDetail, type ProjectRevision } from "~/lib/projects";
import { SurfaceCtx, SurfaceNode, type SurfaceContext } from "~/components/openui/surface";
import { StudioCtx, errMsg, toast } from "./context";
import { act, btnSm, emptyBox, fieldLabel, hint, kicker, panel, panelTitle, textarea } from "./ui";

interface WorkbenchProps {
  projectId: string;
  revision: number;
  latest: ProjectRevision;
  audience: Persona;
  /** Disabled while the project panel saves or has unsaved edits of its own. */
  locked: boolean;
  onSaved$: QRL<(detail: ProjectDetail) => void>;
}

interface Saved {
  origin: "starter" | "partner";
  program: string;
  turns: PartnerTurn[];
  state: Record<string, unknown>;
}

interface WorkbenchState {
  design: ProjectDesign | null;
  /** Set once the first design arrives; tasks track this rather than each new design object. */
  ready: boolean;
  designError: string;
  designAttempt: number;
  revision: number;
  origin: Saved["origin"];
  program: string;
  /** The partner's surface while it streams in; null otherwise. */
  draft: string | null;
  turns: PartnerTurn[];
  initialState: Record<string, unknown>;
  generation: number;
  view: RuntimeSnapshot | null;
  partner: "checking" | "available" | "unavailable";
  message: string;
  pending: boolean;
  streamed: string;
  error: string;
  notice: string;
  undoing: boolean;
}

const MAX_TURNS = 24;

/**
 * The project's design workbench: an OpenUI surface over the saved design,
 * and a partner who revises that surface on request. Baste's own surface
 * works without a model. Controls only stage values; a save is always the
 * person pressing a button that runs update_design, which becomes a
 * project version like any other edit.
 */
export const DesignWorkbench = component$<WorkbenchProps>((props) => {
  const s = useContext(StudioCtx);
  const w = useStore<WorkbenchState>({
    design: null, ready: false, designError: "", designAttempt: 0, revision: props.revision,
    origin: "starter", program: "", draft: null, turns: [], initialState: {}, generation: 0, view: null,
    partner: "checking", message: "", pending: false, streamed: "", error: "", notice: "", undoing: false,
  });
  const runtime = useStore<{ current: NoSerialize<SurfaceRuntime>; abort: NoSerialize<AbortController> }>({ current: undefined, abort: undefined });
  const storageKey = `baste.workbench.v${CATALOG_VERSION}.${s.account.status?.profile?.did ?? "local"}.${props.projectId}`;

  const persist = $(() => {
    try {
      const saved: Saved = { origin: w.origin, program: w.origin === "partner" ? w.program : "", turns: w.turns.slice(-MAX_TURNS), state: w.view?.state ?? {} };
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch { /* storage full or disabled: the workbench still works for this visit */ }
  });

  const send = $(async (message: string, context?: unknown) => {
    const text = message.trim().slice(0, 600);
    if (!text || w.pending || w.partner !== "available" || !w.design) return;
    const base = w.program;
    const controller = new AbortController();
    runtime.abort = noSerialize(controller);
    w.pending = true; w.error = ""; w.notice = ""; w.streamed = ""; w.message = "";
    const history = w.turns.slice(-12);
    w.turns = [...w.turns, { from: "you", text }];
    try {
      for await (const event of requestSurface(s.apiBase, props.projectId, { message: text, program: base, turns: history, state: w.view?.state ?? {}, context }, s.account.status?.csrfToken, controller.signal)) {
        if (event.type === "delta") {
          w.streamed += event.text;
          w.draft = draftProgram(base, w.streamed);
        } else if (event.type === "done") {
          w.turns = [...w.turns, { from: "partner", text: event.reply }];
          if (event.program) { w.program = event.program; w.origin = "partner"; }
          else if (event.issues.length) w.notice = "The partner’s surface had problems, so the current one stays. Ask again or rephrase.";
        } else {
          w.error = event.message;
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) w.error = errMsg(error);
    } finally {
      w.pending = false; w.draft = null; w.streamed = "";
      runtime.abort = undefined;
      await persist();
    }
  });

  // Saved workbench and partner availability, once per project.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    const controller = new AbortController();
    cleanup(() => { controller.abort(); runtime.abort?.abort(); });
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Saved | null;
      if (saved && typeof saved.program === "string" && Array.isArray(saved.turns)) {
        w.origin = saved.origin === "partner" && saved.program ? "partner" : "starter";
        if (w.origin === "partner") w.program = saved.program;
        w.turns = saved.turns.filter((turn) => turn && (turn.from === "you" || turn.from === "partner") && typeof turn.text === "string").slice(-MAX_TURNS);
        w.initialState = saved.state && typeof saved.state === "object" ? saved.state : {};
      }
    } catch { /* an unreadable saved workbench starts fresh */ }
    try {
      const response = await fetch(`${s.apiBase.replace(/\/+$/, "")}/health`, { signal: controller.signal, cache: "no-store" });
      const health = response.ok ? await response.json() : null;
      w.partner = health?.surface?.available === true && health.surface.catalog === CATALOG_VERSION ? "available" : "unavailable";
    } catch {
      if (!controller.signal.aborted) w.partner = "unavailable";
    }
  });

  // The saved design, again after every new project version.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track, cleanup }) => {
    const revision = track(() => props.revision);
    track(() => w.designAttempt);
    w.revision = revision;
    const controller = new AbortController();
    cleanup(() => controller.abort());
    try {
      const design = await getProjectDesign(s.apiBase, props.projectId, controller.signal);
      if (controller.signal.aborted) return;
      w.design = design; w.designError = "";
      if (design && !w.ready) w.ready = true;
      if (design && w.origin === "starter") w.program = starterProgram(design.reading);
      runtime.current?.invalidate();
    } catch (error) {
      if (!controller.signal.aborted) w.designError = errMsg(error);
    }
  });

  // One runtime per surface generation; reset or a new project starts another.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => w.generation);
    if (!track(() => w.ready)) return;
    let persistTimer: ReturnType<typeof setTimeout> | undefined;
    const instance = new SurfaceRuntime({
      library,
      readTools: READ_TOOLS,
      writeTools: WRITE_TOOLS,
      initialState: w.initialState,
      tools: {
        read_design: async () => (await getProjectDesign(s.apiBase, props.projectId))?.reading ?? null,
        update_design: async (args) => {
          if (props.locked) throw new Error("Save or discard the project’s other edits first.");
          const detail = await runProjectCommand(s.apiBase, props.projectId, {
            commandId: crypto.randomUUID(), baseRevision: w.revision, kind: "update_design",
            changes: (args.changes ?? {}) as DesignChanges, summary: String(args.summary ?? "").slice(0, 160),
          }, s.account.status?.csrfToken);
          await props.onSaved$(detail);
          toast(s, `Design saved as version ${detail.project.revision}`);
          return { revision: detail.project.revision, summary: detail.revisions.at(-1)?.summary ?? "" };
        },
      },
      onAction: (event) => {
        if (event.type === "continue_conversation") {
          if (w.partner === "available") void send(event.humanFriendlyMessage, event.params.context);
          else w.notice = "The design partner isn’t available here, so that answer wasn’t sent.";
        } else w.notice = "Generated surfaces don’t open links.";
      },
      onChange: (snapshot) => {
        w.view = JSON.parse(JSON.stringify(snapshot));
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => void persist(), 400);
      },
    });
    runtime.current = noSerialize(instance);
    instance.setProgram(w.draft ?? w.program, w.draft !== null);
    cleanup(() => { clearTimeout(persistTimer); instance.dispose(); runtime.current = undefined; });
  });

  // Show the program, or the partner's draft while it streams.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const program = track(() => w.program);
    const draft = track(() => w.draft);
    track(() => w.generation);
    runtime.current?.setProgram(draft ?? program, draft !== null);
  });

  const assign$ = $((binding: ReactiveAssign, value: unknown) => runtime.current?.assign(binding, value));
  const run$ = $((action: unknown, label: string) => runtime.current?.run(action as never, label));

  const startOver = $(async () => {
    runtime.abort?.abort();
    w.origin = "starter"; w.turns = []; w.initialState = {}; w.error = ""; w.notice = "";
    if (w.design) w.program = starterProgram(w.design.reading);
    w.generation++;
    await persist();
  });

  const undo = $(async () => {
    if (w.undoing || props.locked) return;
    w.undoing = true; w.error = "";
    try {
      const detail = await runProjectCommand(s.apiBase, props.projectId, { commandId: crypto.randomUUID(), baseRevision: props.revision, kind: "restore_design", targetRevision: props.latest.revision - 1 }, s.account.status?.csrfToken);
      await props.onSaved$(detail);
      toast(s, `Design returned to version ${props.latest.revision - 1}`);
    } catch (error) {
      w.error = errMsg(error);
    } finally {
      w.undoing = false;
    }
  });

  const v = w.view;
  const streaming = w.draft !== null;
  const broken = !!v && !v.streaming && !v.root;
  const issues = v && !v.streaming ? v.errors : [];
  const lastDesignChange = props.latest.kind === "design_updated" || props.latest.kind === "design_restored";

  return (
    <section class={panel} aria-labelledby="workbench-title" aria-busy={w.pending}>
      <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 3, flexWrap: "wrap" })}>
        <div>
          <span class={kicker}>Working on the design</span>
          <h2 id="workbench-title" class={panelTitle} style={{ marginTop: "8px" }}>Workbench</h2>
          <p class={hint}>Adjust the design on the surface; nothing is saved until you press save. {w.partner === "available" ? "Ask the partner to show options, compare treatments or rearrange the controls." : ""}</p>
        </div>
        <div class={css({ display: "flex", gap: 2, flexWrap: "wrap" })}>
          {lastDesignChange && props.latest.revision > 1 && <button type="button" class={act("unpick", btnSm)} disabled={w.undoing || props.locked || w.pending} onClick$={undo}>{w.undoing ? "Undoing…" : `Undo “${props.latest.summary}”`}</button>}
          {w.origin === "partner" && <button type="button" class={act("baste", btnSm)} disabled={w.pending} onClick$={startOver}>Return to Baste’s surface</button>}
        </div>
      </div>

      <div class={css({ mt: 5 })}>
        {w.designError ? <div class={emptyBox} role="alert">
          <p>{w.designError}</p>
          <button type="button" class={act("baste", css({ mt: 3 }))} onClick$={() => w.designAttempt++}>Try again</button>
        </div>
          : !w.design || !v ? <div class={emptyBox} role="status">Laying out the design…</div>
          : broken ? <div class={emptyBox} role="alert">
            <p>This surface can’t be shown{issues[0] ? `: ${issues[0].message}` : "."}</p>
            <button type="button" class={act("baste", css({ mt: 3 }))} onClick$={startOver}>Return to Baste’s surface</button>
          </div>
          : <SurfaceHost design={w.design} persona={props.audience} locked={streaming || props.locked} assign$={assign$} run$={run$}><SurfaceNode node={v.root} /></SurfaceHost>}
        {issues.length > 0 && !broken && <details class={css({ mt: 3, fontSize: "12.5px", color: "ink-muted" })}>
          <summary>{issues.length === 1 ? "One part of this surface was left out" : `${issues.length} parts of this surface were left out`}</summary>
          <ul class={css({ mt: 2, pl: 4, listStyle: "disc" })}>{issues.slice(0, 8).map((issue, i) => <li key={i} class={css({ overflowWrap: "anywhere" })}>{issue.message}</li>)}</ul>
        </details>}
        {props.locked && <p class={hint}>Save or discard the brief and audience edits above before saving the design.</p>}
      </div>

      <div class={css({ mt: 6, pt: 5, borderTop: "1px solid token(colors.rule)", display: "flex", flexDirection: "column", gap: 3 })}>
        <h3 class={kicker}>With the design partner</h3>
        {w.turns.length > 0 && <ol aria-label="Conversation with the design partner" role="log" aria-live="polite" class={css({ listStyle: "none", display: "flex", flexDirection: "column", gap: 2, maxH: "320px", overflowY: "auto" })} data-lenis-prevent>
          {w.turns.map((turn, i) => <li key={i} data-from={turn.from} class={css({
            maxW: "62ch", fontSize: "14px", lineHeight: 1.5, overflowWrap: "anywhere", whiteSpace: "pre-wrap",
            "&[data-from=you]": { alignSelf: "flex-end", bg: "paper-deep", px: 3, py: 2, rounded: "base" },
          })}><span class={css({ srOnly: true })}>{turn.from === "you" ? "You: " : "Partner: "}</span>{turn.text}</li>)}
        </ol>}
        {w.pending && <p role="status" class={css({ fontSize: "14px", color: "ink-soft", whiteSpace: "pre-wrap", overflowWrap: "anywhere" })}>{proseOf(w.streamed) || "The partner is looking at the design…"}</p>}
        {w.error && <div role="alert" class={css({ fontSize: "13.5px", color: "thread-ink" })}>
          <p>{w.error}</p>
          {w.turns.at(-1)?.from === "you" && <button type="button" class={act("baste", cx(btnSm, css({ mt: 2 })))} disabled={w.pending} onClick$={() => {
            const last = w.turns.at(-1)!;
            w.turns = w.turns.slice(0, -1);
            return send(last.text);
          }}>Ask again</button>}
        </div>}
        {w.notice && <p role="status" class={hint}>{w.notice}</p>}
        {w.partner === "available" ? (
          <form preventdefault:submit onSubmit$={() => send(w.message)} class={css({ display: "flex", flexDirection: "column", gap: 2 })}>
            <label class={fieldLabel} for="workbench-message">Ask for a change</label>
            <textarea id="workbench-message" class={textarea} rows={2} maxLength={600} value={w.message} disabled={w.pending}
              placeholder="Show me a warmer ground, compare two heading faces, put contrast checks first…"
              onInput$={(_, el) => (w.message = el.value)}
              onKeyDown$={sync$((event: KeyboardEvent, el: HTMLTextAreaElement) => {
                if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); el.form?.requestSubmit(); }
              })} />
            <div class={css({ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" })}>
              <button type="submit" class={act("baste")} disabled={w.pending || !w.message.trim() || !w.design}>{w.pending ? "Revising the surface…" : "Ask the partner"}</button>
              {w.pending && <button type="button" class={act("unpick", btnSm)} onClick$={() => runtime.abort?.abort()}>Stop</button>}
              <span class={hint} style={{ marginTop: 0 }}>Shift + Enter for a new line</span>
            </div>
          </form>
        ) : (
          <p class={hint} role="status">{w.partner === "checking" ? "Checking whether the design partner is available…" : "The design partner needs a local Baste server with an OpenAI key. Baste’s own surface above still works."}</p>
        )}
      </div>
    </section>
  );
});

/** The partner's words so far, without the surface code they are writing. */
function proseOf(text: string): string {
  return text.replace(/```[\s\S]*?(```|$)/g, "").trim();
}

const SurfaceHost = component$<{ design: ProjectDesign; persona: Persona; locked: boolean; assign$: SurfaceContext["assign$"]; run$: SurfaceContext["run$"] }>((props) => {
  const ctx = useStore<SurfaceContext>({ design: props.design, persona: props.persona, locked: props.locked, assign$: props.assign$, run$: props.run$ });
  useTask$(({ track }) => {
    ctx.design = track(() => props.design);
    ctx.persona = track(() => props.persona);
    ctx.locked = track(() => props.locked);
  });
  useContextProvider(SurfaceCtx, ctx);
  return <div class={css({ position: "relative" })}><Slot /></div>;
});
