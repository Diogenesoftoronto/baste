import { component$, useContext, useSignal, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, openView, toast } from "../context";
import { btn, btnSm, fieldLabel, hint, input, kicker, panel, panelTitle } from "../ui";
import type { Job, JobSummary, PromptPreview, GenerationPlan } from "~/lib/api-types";
import { play, snipBurst } from "~/lib/juice";
import { availableBalance, formatBalance, walletBlocked } from "~/lib/notorganic";

const HOSTED_ASSETS = [
  { kind: "image" as const, purpose: "hero", description: "Hero image fitted to the persona" },
  { kind: "image" as const, purpose: "background", description: "Ambient UI background fitted to the persona" },
];

const STAGES = ["Measure", "Draft prompts", "Baste (QD)", "Fit (judge)", "Cut"];

/** Rough stage from the server's free-text log lines. */
function stageOf(job: Job | null): number {
  if (!job) return -1;
  if (job.status === "completed") return STAGES.length;
  const text = job.logs.join("\n").toLowerCase();
  if (/judge|evaluat|score/.test(text)) return 3;
  if (/iteration|generation \d|archive|evolv|qd/.test(text)) return 2;
  if (/prompt|generating|asset types|ui kit/.test(text)) return 1;
  return 0;
}

export const GenerateTab = component$(() => {
  const s = useContext(StudioCtx);
  const form = useStore({ type: "suite" as "suite" | "ui-kit", dryRun: true, provider: "openai", model: "", maxCostUsd: "1.00", iterations: 5, batchSize: 3, outputCount: 3 });
  const plan = useSignal<GenerationPlan | null>(null);
  const planError = useSignal("");
  const planning = useSignal(false);
  const job = useSignal<Job | null>(null);
  const running = useSignal(false);
  const prompts = useSignal<PromptPreview | null>(null);
  const promptKind = useSignal<"image" | "svg" | "video">("image");
  const jobs = useSignal<JobSummary[]>([]);
  const logEl = useSignal<HTMLElement>();

  const loadJobs = $(async () => {
    try {
      jobs.value = (await s.client!.listJobs()).filter((j) => j.personaId === s.selectedId);
    } catch {
      /* the list is a convenience */
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    track(() => s.selectedId);
    if (!s.client) return;
    loadJobs();
    try {
      prompts.value = await s.client.previewPrompts(s.selectedId);
    } catch {
      prompts.value = null;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    if (!s.client) return;
    try {
      const cfg = await s.client.getConfig();
      form.provider = cfg.generators?.image?.provider ?? "openai";
      form.model = cfg.generators?.image?.model ?? "";
      form.iterations = cfg.qd?.iterations ?? 5;
      form.batchSize = cfg.qd?.batchSize ?? 3;
      form.outputCount = cfg.outputCount ?? 3;
    } catch { /* keep the server defaults */ }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const provider = track(() => form.provider);
    const maxCost = track(() => form.maxCostUsd);
    const iterations = track(() => form.iterations);
    const batchSize = track(() => form.batchSize);
    const outputCount = track(() => form.outputCount);
    const model = track(() => form.model);
    const id = track(() => s.selectedId);
    const authenticated = track(() => s.account.status?.authenticated);
    plan.value = null;
    planError.value = "";
    planning.value = false;
    if (provider !== "notorganic" || !authenticated || !s.client?.planGeneration || !/^\d+(?:\.\d{1,2})?$/.test(maxCost) || Number(maxCost) <= 0) return;
    let active = true;
    planning.value = true;
    const timer = setTimeout(async () => {
      try {
        const result = await s.client!.planGeneration!(id, {
          type: "suite", imageProvider: "notorganic", imageModel: model || undefined,
          assetTypes: HOSTED_ASSETS, maxCostMicrousd: Math.round(Number(maxCost) * 1_000_000),
          qd: { iterations, batchSize }, outputCount,
        });
        if (active) plan.value = result;
      } catch (error) {
        if (active) planError.value = errMsg(error);
      } finally { if (active) planning.value = false; }
    }, 250);
    cleanup(() => { active = false; clearTimeout(timer); });
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => job.value?.logs.length);
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
  });

  const start = $(async (e: MouseEvent) => {
    if (!s.client) return;
    running.value = true;
    job.value = null;
    const persona = s.selectedId;
    try {
      const { jobId } = await s.client.generate(persona, {
        type: form.type,
        dryRun: form.dryRun,
        imageProvider: form.provider,
        ...(form.model ? { imageModel: form.model } : {}),
        ...(form.provider === "notorganic" ? {
          assetTypes: HOSTED_ASSETS,
          ...(!form.dryRun ? { maxCostMicrousd: Math.round(Number(form.maxCostUsd) * 1_000_000),
            qd: { iterations: form.iterations, batchSize: form.batchSize }, outputCount: form.outputCount } : {}),
        } : {}),
      });
      const poll = async () => {
        try {
          const j = await s.client!.getJob(jobId);
          if (s.selectedId === persona) job.value = j;
          if (j.status === "running") {
            setTimeout(poll, 1200);
            return;
          }
          running.value = false;
          loadJobs();
          if (j.status === "completed") {
            play("fanfare");
            snipBurst(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, ["#D2402A", "#F0C534", "#2F55A4", "#2E7D5B"], 26);
            toast(s, form.dryRun ? "Dry run complete — prompts drafted" : "Assets cut and saved");
          } else {
            play("error");
            toast(s, j.error ?? "Generation failed", "error");
          }
        } catch (err) {
          running.value = false;
          toast(s, errMsg(err), "error");
        }
      };
      poll();
    } catch (err) {
      running.value = false;
      play("error");
      toast(s, errMsg(err), "error");
    }
  });

  const stage = stageOf(job.value);
  const result = job.value?.result;
  const p = prompts.value?.[promptKind.value];
  const hosted = form.provider === "notorganic";
  const models = s.account.models.filter((m) => m.kind === "image");
  const judgementAvailable = s.account.models.some((m) => m.kind === "judgement");
  const validBudget = /^\d+(?:\.\d{1,2})?$/.test(form.maxCostUsd) && Number(form.maxCostUsd) > 0 && Number.isSafeInteger(Math.round(Number(form.maxCostUsd) * 1_000_000));
  const hostedUnavailable = hosted && !form.dryRun && (
    !s.account.status?.authenticated || !models.some((m) => m.id === form.model) || !judgementAvailable || !validBudget
    || availableBalance(s.account.wallet) === null || availableBalance(s.account.wallet) === 0 || walletBlocked(s.account.wallet)
    || planning.value || !plan.value?.withinOperatorLimit || !plan.value?.withinRequestedBudget
    || (availableBalance(s.account.wallet) ?? 0) < (plan.value?.minimumBudgetMicrousd ?? Number.POSITIVE_INFINITY)
  );

  return (
    <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "minmax(300px, 0.7fr) minmax(0, 1.3fr)" }, gap: 6, alignItems: "start" })}>
      {/* Order form */}
      <section class={panel} aria-labelledby="gen-title">
        <span class={kicker}>Order</span>
        <h2 id="gen-title" class={panelTitle}>Generate assets</h2>

        <fieldset class={css({ border: 0, p: 0, mt: 5, display: "flex", flexDirection: "column", gap: 2 })}>
            <legend class={fieldLabel}>What to cut</legend>
          {([
            ["suite", "Asset suite", "App icon, hero image and ambient background"],
            ["ui-kit", "Full UI kit", "Icons, illustrations, images and loops for a whole interface"],
          ] as const).map(([v, label, desc]) => (
            <label
              key={v}
              class={css({ display: "grid", gridTemplateColumns: "18px 1fr", gap: 3, p: 3, rounded: "base", border: "1px solid token(colors.rule)", cursor: "pointer", "&:has(input:checked)": { borderColor: "ink", bg: "paper" } })}
            >
              <input type="radio" name="gen-type" value={v} checked={form.type === v} disabled={hosted && v === "ui-kit"} onChange$={() => (form.type = v)} class={css({ accentColor: "#1C1B19", mt: "3px" })} />
              <span>
                <span class={css({ display: "block", fontWeight: 600, fontSize: "14px" })}>{label}</span>
                <span class={css({ display: "block", fontSize: "12.5px", color: "ink-muted" })}>{desc}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, mt: 4 })}>
          <div>
            <label class={fieldLabel} for="gen-provider">Image provider</label>
            <select
              id="gen-provider"
              class={input}
              value={form.provider}
              onChange$={(_, el) => {
                form.provider = el.value;
                form.model = el.value === "notorganic" ? s.account.models.find((m) => m.kind === "image")?.id ?? "" : "";
                if (el.value === "notorganic") form.type = "suite";
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google</option>
              <option value="notorganic">Not Organic</option>
            </select>
          </div>
          <div>
            <label class={fieldLabel} for="gen-model">Model</label>
            {hosted ? <select id="gen-model" class={input} value={form.model} onChange$={(_, el) => (form.model = el.value)}>
              <option value="">Choose an available model</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
            </select> : <input id="gen-model" class={input} value={form.model} placeholder="Use server default" onInput$={(_, el) => (form.model = el.value)} />}
          </div>
        </div>
        <p class={hint}>{hosted ? "Hosted image suite: hero and background only. SVGs and videos require local providers." : "Enter a model ID for your configured provider, or use its server default. SVG and video use their local providers."}</p>
        {hosted && <p class={hint}>
          {!s.account.status?.authenticated ? "Sign in to load your image models and wallet." : s.account.modelError ? `Catalog unavailable: ${s.account.modelError}` : !models.length ? "No image models are currently available." : !judgementAvailable ? "Asset judging is unavailable for this account. You can still draft prompts." : walletBlocked(s.account.wallet) ? "Your wallet is blocked. Review billing before generating." : availableBalance(s.account.wallet) === 0 ? "Add wallet credit before paid generation." : availableBalance(s.account.wallet) === null ? "Refresh your account to verify your balance before generating." : "Generation uses your Not Organic wallet. The provider determines actual cost."}
          {" "}<button class={btn("ghost", btnSm)} onClick$={() => openView(s, "settings")}>Open account</button>
        </p>}

        {hosted && <div class={css({ mt: 4 })}>
          <fieldset class={css({ border: 0, p: 0, mb: 4 })}>
            <legend class={fieldLabel}>Candidates for this run</legend>
            <div class={css({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 3 })}>
              <label class={fieldLabel}>Iterations<input class={input} type="number" min="0" max="10" step="1" value={form.iterations} onInput$={(_, el) => (form.iterations = Number(el.value))} /></label>
              <label class={fieldLabel}>Batch size<input class={input} type="number" min="1" max="10" step="1" value={form.batchSize} onInput$={(_, el) => (form.batchSize = Number(el.value))} /></label>
              <label class={fieldLabel}>Per purpose<input class={input} type="number" min="1" max="10" step="1" value={form.outputCount} onInput$={(_, el) => (form.outputCount = Number(el.value))} /></label>
            </div>
          </fieldset>
          <label class={fieldLabel} for="gen-maxcost">Maximum spend for this run · USD</label>
          <input id="gen-maxcost" class={input} type="number" inputMode="decimal" min="0.01" step="0.01" value={form.maxCostUsd}
            aria-invalid={!validBudget} aria-describedby="gen-maxcost-hint"
            onInput$={(_, el) => (form.maxCostUsd = el.value)} />
          <p id="gen-maxcost-hint" class={hint}>QD generates and judges multiple candidates. Baste checks the conservative request budget before generation and stops at your maximum; actual debits are determined by the provider.</p>
          {!validBudget && <p class={hint}>Enter a positive USD amount with up to two decimal places.</p>}
          <div aria-live="polite" class={css({ mt: 3 })}>
            {planning.value ? <p class={hint}>Checking request budget…</p> : planError.value ? <p class={hint}>Budget plan unavailable: {planError.value}</p> : plan.value && <>
              <p class={hint}>{plan.value.imageCalls} image requests + {plan.value.judgementCalls} judging requests. Required conservative budget: <strong>{formatBalance(plan.value.minimumBudgetMicrousd)}</strong>. Server limit: {formatBalance(plan.value.operatorMaxCostMicrousd)}.</p>
              {!plan.value.withinRequestedBudget && <p class={hint}>Your maximum is too low for this plan. Reduce candidates or explicitly raise the maximum before generating.</p>}
              {!plan.value.withinOperatorLimit && <p class={hint}>Your maximum or this plan exceeds the server limit. Reduce the maximum or candidates, or ask the operator to adjust the limit.</p>}
              {(availableBalance(s.account.wallet) ?? 0) < plan.value.minimumBudgetMicrousd && <p class={hint}>Your available wallet credit cannot cover this plan's request ceilings. Add credit or reduce candidates.</p>}
            </>}
          </div>
        </div>}

        <label class={css({ display: "flex", gap: 3, alignItems: "flex-start", mt: 4, p: 3, rounded: "base", bg: "paper", cursor: "pointer" })}>
          <input type="checkbox" checked={form.dryRun} onChange$={(_, el) => (form.dryRun = el.checked)} class={css({ accentColor: "#1C1B19", mt: "3px" })} />
          <span>
            <span class={css({ display: "block", fontWeight: 600, fontSize: "14px" })}>Dry run</span>
            <span class={css({ display: "block", fontSize: "12.5px", color: "ink-muted" })}>Draft prompts only. No API calls, no cost.</span>
          </span>
        </label>

        <button class={btn("primary", css({ w: "100%", mt: 5, h: "46px" }))} data-juice="snip" disabled={running.value || hostedUnavailable} onClick$={start}>
          {running.value ? "Basting…" : form.dryRun ? "Draft the prompts" : "Cut the assets"}
        </button>
        {s.status === "demo" && !form.dryRun && (
          <p class={hint}>Demo mode simulates the run. Connect `baste gui` for real assets.</p>
        )}
      </section>

      <div class={css({ display: "flex", flexDirection: "column", gap: 6, minW: 0 })}>
        {/* Progress */}
        <section class={panel} aria-labelledby="gen-progress" aria-busy={running.value}>
          <span class={kicker}>On the table</span>
          <h2 id="gen-progress" class={panelTitle}>{job.value ? (job.value.status === "running" ? "In progress" : job.value.status === "completed" ? "Finished" : "Stopped") : "Nothing on the table yet"}</h2>

          <ol class={css({ listStyle: "none", display: "grid", gap: 0, mt: 5 })} style={{ gridTemplateColumns: `repeat(${STAGES.length}, 1fr)` }}>
            {STAGES.map((st, i) => {
              const done = stage > i;
              const active = stage === i && running.value;
              return (
                <li key={st} class={css({ display: "flex", flexDirection: "column", gap: 2, minW: 0 })}>
                  <div class={css({ display: "flex", alignItems: "center" })}>
                    <span
                      class={css({ w: "14px", h: "14px", rounded: "full", border: "2px solid", flexShrink: 0, transition: "all 0.4s token(easings.thread)" })}
                      style={{
                        borderColor: done || active ? "#D2402A" : "#A79E8D",
                        background: done ? "#D2402A" : "transparent",
                        transform: active ? "scale(1.25)" : "none",
                        animation: active ? "pulse 1.2s ease-in-out infinite" : undefined,
                      }}
                    />
                    {i < STAGES.length - 1 && (
                      <span
                        class={css({ flex: 1, h: "2px", mx: 1, transition: "background-size 0.8s token(easings.thread)" })}
                        style={{
                          backgroundImage: "linear-gradient(90deg, #D2402A 0 7px, transparent 7px 11px), linear-gradient(90deg, #CFC7B8 0 4px, transparent 4px 8px)",
                          backgroundSize: `${done ? "11px" : "0px"} 2px, 8px 2px`,
                          backgroundRepeat: "repeat-x",
                        }}
                      />
                    )}
                  </div>
                  <span class={css({ fontSize: "12px", color: done || active ? "ink" : "ink-muted", fontWeight: active ? 600 : 400, pr: 2 })}>{st}</span>
                </li>
              );
            })}
          </ol>

          <pre
            ref={logEl}
            aria-live="polite"
            tabIndex={0}
            class={css({ mt: 5, p: 4, h: "180px", overflow: "auto", bg: "night", color: "night-text", rounded: "sm", fontFamily: "mono", fontSize: "12px", lineHeight: 1.7, whiteSpace: "pre-wrap" })}
          >
            {job.value
              ? job.value.logs.map((l, i) => (
                  <div key={i} style={{ color: /^error/i.test(l) ? "#F09A88" : undefined }}>
                    <span style={{ color: "#8F887A" }}>{String(i + 1).padStart(2, "0")} </span>
                    {l}
                  </div>
                ))
              : <span style={{ color: "#8F887A" }}>$ baste generate {s.selectedId}{form.dryRun ? " --dry-run" : ""}</span>}
          </pre>

          {result && "dryRun" in result && (
            <div class={css({ mt: 4, p: 4, rounded: "base", border: "1px dashed token(colors.chalk)", bg: "rgba(47,85,164,0.05)" })}>
              <span class={css({ fontSize: "12px", fontWeight: 600, color: "chalk" })}>Drafted hero prompt</span>
              <p class={css({ fontSize: "13.5px", mt: 1, lineHeight: 1.55 })}>{result.samplePrompt}</p>
            </div>
          )}
          {result && "svgs" in result && (
            <div class={css({ mt: 4, display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "repeat(3, 1fr)" }, gap: 3 })}>
              {([["SVG", result.svgs], ["Images", result.images], ["Video", result.videos]] as const).map(([k, list]) => (
                <div key={k} class={css({ p: 3, rounded: "base", bg: "paper" })}>
                  <span class={css({ fontSize: "12px", fontWeight: 600 })}>{k} · {list.length}</span>
                  <ul class={css({ listStyle: "none", mt: 1, fontFamily: "mono", fontSize: "11.5px", color: "ink-muted", display: "flex", flexDirection: "column", gap: 1 })}>
                    {list.map((a) => (
                      <li key={a.id} title={hosted ? undefined : a.path} class={css({ minW: 0, py: 1 })}>
                        {a.url ? <>
                          {k === "Images" && <img src={a.url} alt={`${a.purpose} fitted to the persona`} width={320} height={180} loading="lazy" class={css({ display: "block", w: "100%", h: "120px", objectFit: "contain", mb: 2, rounded: "sm" })} />}
                          <a href={a.url} download class={css({ color: "chalk", overflowWrap: "anywhere" })}>Download {a.purpose}</a>
                        </> : a.purpose}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Prompt preview */}
        <section class={panel} aria-labelledby="gen-prompts">
          <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 3, flexWrap: "wrap" })}>
            <div>
              <span class={kicker}>Pattern notes</span>
              <h2 id="gen-prompts" class={panelTitle}>How Baste will brief the models</h2>
            </div>
            <div role="tablist" aria-label="Prompt kind" class={css({ display: "flex", gap: 1 })}>
              {(["image", "svg", "video"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={promptKind.value === k} onClick$={() => (promptKind.value = k)} class={css({ h: "28px", px: 3, rounded: "sm", fontSize: "12.5px", border: "1px solid token(colors.rule)", bg: "card", "&[aria-selected=true]": { bg: "ink", color: "paper", borderColor: "ink" } })}>
                  {k === "svg" ? "SVG" : k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {p ? (
            <div class={css({ display: "flex", flexDirection: "column", gap: 3, mt: 4 })}>
              <p class={css({ fontSize: "14px", lineHeight: 1.6, p: 4, rounded: "base", bg: "paper", borderLeft: "3px solid token(colors.thread)" })}>{p.prompt}</p>
              {p.negativePrompt && (
                <p class={css({ fontSize: "13px", color: "ink-muted" })}>
                  <strong class={css({ color: "thread-ink" })}>Avoid: </strong>
                  {p.negativePrompt}
                </p>
              )}
            </div>
          ) : (
            <p class={hint}>Prompt preview unavailable.</p>
          )}
        </section>

        {jobs.value.length > 0 && (
          <section class={panel} aria-labelledby="gen-history">
            <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
              <h2 id="gen-history" class={panelTitle}>Earlier runs</h2>
              <button class={btn("ghost", btnSm)} onClick$={loadJobs}>Refresh</button>
            </div>
            <ul class={css({ listStyle: "none", mt: 3 })}>
              {jobs.value.map((j) => (
                <li key={j.id} class={css({ display: "flex", justifyContent: "space-between", gap: 3, py: 2, borderBottom: "1px solid token(colors.rule)", fontSize: "13px" })}>
                  <span class={css({ fontFamily: "mono" })}>{j.id}</span>
                  <span>{j.type}</span>
                  <span style={{ color: j.status === "error" ? "#A9311E" : j.status === "completed" ? "#2E7D5B" : "#6E6A61" }}>{j.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
});
