import { $, component$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { css, cx } from "styled-system/css";
import { StudioCtx, errMsg, toast } from "../context";
import { act, btnSm, chip, emptyBox, fieldLabel, hint, input, kicker, panel, panelTitle } from "../ui";
import {
  DEFAULT_LOOK_FOR, cancelSampling, getSampleRun, keepSample, listSampleRuns, reasons, sampleFile, samplingProgress, startSampling,
  type Interval, type RunSummary, type Sample, type SampleRun,
} from "~/lib/samples";

interface SampleState {
  available: boolean | null;
  reading: boolean;
  url: string;
  lookFor: string[];
  draft: string;
  activeId: string;
  stage: string;
  error: string;
  runs: RunSummary[];
  run: SampleRun | null;
  focus: string;
  why: Record<string, string>;
  kept: Record<string, string>;
  keeping: string;
  showAll: boolean;
}

/**
 * Sample a site for this persona: name what you want (or keep the defaults),
 * SAM 3 finds every instance on the captured page, and Clairic reads the
 * words in each and judges how much this audience would want it, trait by
 * trait. Keeping a sample pins the page's original file (or a clean cut-out)
 * to the moodboard, tagged with why.
 */
export const SampleTab = component$(() => {
  const s = useContext(StudioCtx);
  const st = useStore<SampleState>({
    available: null, reading: false, url: "", lookFor: [...DEFAULT_LOOK_FOR], draft: "", activeId: "", stage: "", error: "",
    runs: [], run: null, focus: "", why: {}, kept: {}, keeping: "", showAll: false,
  }, { deep: true });

  const loadRuns = $(async (open?: string) => {
    try {
      st.runs = await listSampleRuns(s.apiBase, s.selectedId);
      const id = open ?? (st.run?.personaId === s.selectedId ? st.run.id : st.runs[0]?.id);
      st.run = id ? await getSampleRun(s.apiBase, id) : null;
    } catch (error) { st.error = errMsg(error); }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    track(() => s.selectedId);
    track(() => s.apiBase);
    st.run = null; st.focus = ""; st.error = "";
    try {
      const health = await (await fetch(`${s.apiBase.replace(/\/+$/, "")}/health`, { cache: "no-store" })).json();
      st.available = health?.sampling?.available === true;
      st.reading = health?.sampling?.reading === true;
    } catch { st.available = false; }
    if (st.available) await loadRuns();
  });

  // Poll a running sample until it lands.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const id = track(() => st.activeId);
    if (!id) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const p = await samplingProgress(s.apiBase, id, controller.signal);
        st.stage = p.stage;
        if (p.status === "done" && p.runId) { st.activeId = ""; await loadRuns(p.runId); toast(s, "Site sampled"); return; }
        if (p.status === "failed") { st.activeId = ""; st.error = p.error ?? "Sampling failed."; return; }
      } catch (error) { if (controller.signal.aborted) return; st.error = errMsg(error); st.activeId = ""; return; }
      timer = setTimeout(tick, 1200);
    };
    timer = setTimeout(tick, 600);
    cleanup(() => { controller.abort(); clearTimeout(timer); });
  });

  const start = $(async () => {
    const url = st.url.trim();
    if (!url || st.activeId) return;
    st.error = "";
    try {
      const p = await startSampling(s.apiBase, { url: /^https?:\/\//i.test(url) ? url : `https://${url}`, personaId: s.selectedId, lookFor: st.lookFor }, s.account.status?.csrfToken);
      // The previous result gives way, so what shows next is this site's.
      st.stage = p.stage; st.activeId = p.id; st.focus = ""; st.run = null; st.showAll = false; st.why = {}; st.kept = {};
    } catch (error) { st.error = errMsg(error); }
  });

  const addLook = $(() => {
    const items = st.draft.split(",").map((v) => v.trim().replace(/\s+/g, " ")).filter(Boolean);
    st.lookFor = [...new Set([...st.lookFor, ...items])].slice(0, 6);
    st.draft = "";
  });

  const keep = $(async (sample: Sample) => {
    if (!st.run || st.keeping) return;
    st.keeping = sample.id;
    try {
      const kept = await keepSample(s.apiBase, st.run.id, sample.id, st.why[sample.id] ?? "", s.account.status?.csrfToken);
      st.kept[sample.id] = kept.kind;
      toast(s, kept.kind === "original" ? "Original pinned to the moodboard" : "Cut-out pinned to the moodboard");
    } catch (error) { toast(s, errMsg(error), "error"); }
    finally { st.keeping = ""; }
  });

  const run = st.run;
  const visible = run ? (st.showAll ? run.samples : run.samples.slice(0, 12)) : [];
  const busy = !!st.activeId;

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 6 })}>
      <section class={panel} aria-labelledby="sample-title">
        <span class={kicker}>Take a sample</span>
        <h2 id="sample-title" class={panelTitle} style={{ marginTop: "8px" }}>What on this site matters to them?</h2>
        <p class={css({ color: "ink-soft", maxW: "64ch", mt: 2, fontSize: "14.5px", lineHeight: 1.55 })}>
          Name what you’re after. SAM 3 finds every instance on the page, Clairic reads its words and scores it against this persona’s values, looks and pet peeves. Keep what fits; the page’s original file goes to the moodboard.
        </p>
        {st.available === false ? (
          <p class={cx(hint, css({ mt: 4 }))} role="status">Sampling needs a local Baste server with a fal key. Reading and judging also need Cloudflare’s Clairic (CLOUDFLARE_AI_API_TOKEN and CLOUDFLARE_ACCOUNT_ID).</p>
        ) : (
          <form preventdefault:submit onSubmit$={start} class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "minmax(0, 1.2fr) minmax(0, 1fr)" }, gap: 5, mt: 5, alignItems: "start" })}>
            <div>
              <label class={fieldLabel} for="sample-url">Site</label>
              <input id="sample-url" class={input} type="url" inputMode="url" placeholder="https://…" required value={st.url} disabled={busy} onInput$={(_, el) => (st.url = el.value)} autoComplete="url" />
              <p class={hint}>The first two screens are captured. Private and local addresses are refused.</p>
            </div>
            <div>
              <label class={fieldLabel} for="sample-look">Look for</label>
              <ul class={css({ display: "flex", flexWrap: "wrap", gap: 2, listStyle: "none", mb: 2 })} aria-label="Looking for">
                {st.lookFor.map((item) => (
                  <li key={item} class={chip}>
                    {item}
                    <button type="button" aria-label={`Stop looking for ${item}`} disabled={busy || st.lookFor.length <= 1} onClick$={() => (st.lookFor = st.lookFor.filter((v) => v !== item))}
                      class={css({ ml: 1, color: "ink-muted", _hover: { color: "thread-ink" }, _disabled: { opacity: 0.4 } })}>×</button>
                  </li>
                ))}
              </ul>
              <div class={css({ display: "flex", gap: 2 })}>
                <input id="sample-look" class={input} placeholder="lantern illustration, neon sign…" value={st.draft} disabled={busy || st.lookFor.length >= 6} maxLength={120}
                  onInput$={(_, el) => (st.draft = el.value)} onKeyDown$={(event) => { if (event.key === "Enter" && st.draft.trim()) { event.preventDefault(); return addLook(); } }} />
                <button type="button" class={act("pin", btnSm)} style={{ height: "38px" }} disabled={busy || !st.draft.trim() || st.lookFor.length >= 6} onClick$={addLook}>Add</button>
              </div>
              <p class={hint}>Up to six. Plain names work best: “icon”, “mascot”, “product photo”.</p>
            </div>
            <div class={css({ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" })}>
              <button type="submit" class={act("cut")} disabled={busy || !st.url.trim() || st.available === null}>{busy ? "Sampling…" : "Sample this site"}</button>
              {busy && <>
                <span role="status" aria-live="polite" class={css({ fontSize: "13.5px", color: "ink-soft" })}>{st.stage}</span>
                <button type="button" class={act("unpick", btnSm)} onClick$={() => cancelSampling(s.apiBase, st.activeId, s.account.status?.csrfToken)}>Stop</button>
              </>}
              {!st.reading && st.available && <span class={hint} style={{ marginTop: 0 }}>Clairic isn’t configured: samples will be found but not read or judged.</span>}
            </div>
          </form>
        )}
        {st.error && <p role="alert" class={css({ mt: 4, color: "thread-ink", fontSize: "14px" })}>{st.error}</p>}
      </section>

      {st.runs.length > 1 && (
        <nav aria-label="Earlier samples" class={css({ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" })}>
          <span class={kicker}>Earlier</span>
          {st.runs.slice(0, 8).map((r) => (
            <button key={r.id} type="button" class={act("pin", btnSm)} aria-pressed={run?.id === r.id} onClick$={() => loadRuns(r.id)}>
              {hostOf(r.url)} <span class={css({ color: "ink-muted", fontWeight: 400 })}>· {r.count}</span>
            </button>
          ))}
        </nav>
      )}

      {busy ? (
        <div class={emptyBox} role="status" aria-live="polite">
          <p class={css({ fontWeight: 600 })}>{st.stage || "Starting"}…</p>
          <p class={hint}>Capturing the page, finding what you named, then reading and judging each find. Usually under a minute.</p>
        </div>
      ) : !run ? (
        st.available && <div class={emptyBox}>No samples for this persona yet. Try a site from their world, or one they’d hate.</div>
      ) : (
        <>
          <section class={panel} aria-labelledby="sample-page-title">
            <div class={css({ display: "flex", justifyContent: "space-between", gap: 4, flexWrap: "wrap", alignItems: "start" })}>
              <div class={css({ minW: 0 })}>
                <span class={kicker}>{hostOf(run.finalUrl)} · {new Date(run.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                <h2 id="sample-page-title" class={panelTitle} style={{ marginTop: "8px", overflowWrap: "anywhere" }}>{run.page?.headline ?? run.title}</h2>
              </div>
              {run.screen && <Meter label="Fit for this persona" value={run.screen.relevance} />}
            </div>

            <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "minmax(0, 1.6fr) minmax(260px, 1fr)" }, gap: 6, mt: 5, alignItems: "start" })}>
              <figure class={css({ position: "relative", border: "1px solid token(colors.rule)", rounded: "base", overflow: "hidden", bg: "paper-deep", lineHeight: 0 })}>
                <img src={sampleFile(s.apiBase, run.id, run.screenshot)} width={run.width} height={run.height} alt={`The captured page: ${run.title}`} class={css({ w: "100%", h: "auto", display: "block" })} />
                {run.samples.map((sample, i) => (
                  <button key={sample.id} type="button" aria-label={`Sample ${i + 1}: ${label(sample)}`}
                    onMouseEnter$={() => (st.focus = sample.id)} onFocus$={() => (st.focus = sample.id)}
                    onClick$={() => { st.focus = sample.id; document.getElementById(`sample-${sample.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}
                    data-focus={st.focus === sample.id ? "true" : undefined}
                    data-fit={fitTone(sample)}
                    class={css({
                      position: "absolute", border: "1.5px solid", borderColor: "rgba(28,27,25,0.45)", bg: "transparent", rounded: "2px", p: 0,
                      transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
                      "&[data-fit=high]": { borderColor: "token(colors.thread-ink)" },
                      "&[data-focus=true], &:focus-visible": { borderColor: "token(colors.chalk)", bg: "rgba(60,90,200,0.12)", boxShadow: "0 0 0 2px token(colors.chalk-soft)", outline: "none", zIndex: 2 },
                    })}
                    style={{ left: pct(sample.box.x, run.width), top: pct(sample.box.y, run.height), width: pct(sample.box.w, run.width), height: pct(sample.box.h, run.height) }}>
                    <span aria-hidden="true" class={css({ position: "absolute", top: "-1px", left: "-1px", fontFamily: "mono", fontSize: "10px", lineHeight: 1, px: "3px", py: "2px", bg: "ink", color: "paper" })}>{i + 1}</span>
                  </button>
                ))}
              </figure>

              <div class={css({ display: "flex", flexDirection: "column", gap: 5 })}>
                {run.screen && <Reasons judgement={run.screen} subject="This screen" />}
                <div>
                  <h3 class={kicker}>Measured on the page</h3>
                  <dl class={css({ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "8px 14px", mt: 3, fontSize: "13.5px" })}>
                    <dt class={css({ color: "ink-muted" })}>Colours</dt>
                    <dd class={css({ display: "flex", gap: 2, flexWrap: "wrap" })}>
                      {[["Ground", run.styles.background], ["Ink", run.styles.text], ...(run.styles.buttonBackground ? [["Button", run.styles.buttonBackground]] : [])].map(([name, hex]) => (
                        <span key={name} class={css({ display: "inline-flex", alignItems: "center", gap: "6px" })} title={hex}>
                          <i class={css({ w: "16px", h: "16px", rounded: "full", border: "1px solid token(colors.rule-strong)" })} style={{ background: hex }} />
                          <span>{name}</span><span class={css({ fontFamily: "mono", fontSize: "11px", color: "ink-muted" })}>{hex}</span>
                        </span>
                      ))}
                    </dd>
                    <dt class={css({ color: "ink-muted" })}>Type</dt>
                    <dd class={css({ overflowWrap: "anywhere" })}>{run.styles.headingFont}{run.styles.headingSize ? ` · ${Math.round(run.styles.headingSize)} px headline` : ""}{run.styles.bodyFont !== run.styles.headingFont ? ` / ${run.styles.bodyFont}` : ""}</dd>
                    {run.styles.buttonRadius !== undefined && <><dt class={css({ color: "ink-muted" })}>Corners</dt><dd>{run.styles.buttonRadius >= 999 ? "Pill buttons" : `${Math.round(run.styles.buttonRadius)} px buttons`}</dd></>}
                    {run.page?.primaryAction && <><dt class={css({ color: "ink-muted" })}>Main action</dt><dd>“{run.page.primaryAction}”</dd></>}
                    {!!run.page?.navigation.length && <><dt class={css({ color: "ink-muted" })}>Navigation</dt><dd class={css({ overflowWrap: "anywhere" })}>{run.page.navigation.join(" · ")}</dd></>}
                    {run.page?.density && <><dt class={css({ color: "ink-muted" })}>Density</dt><dd><Scale value={run.page.density} /></dd></>}
                  </dl>
                  <p class={hint}>Colours and type come from the page itself; words, density and fit are Clairic’s readings, shown with their 80% range.</p>
                </div>
                {run.notes.length > 0 && <ul class={css({ fontSize: "12.5px", color: "ink-muted", listStyle: "disc", pl: 4 })}>{run.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
              </div>
            </div>
          </section>

          <section aria-labelledby="sample-list-title">
            <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 3, mb: 3, flexWrap: "wrap" })}>
              <h2 id="sample-list-title" class={panelTitle}>Samples, most wanted first</h2>
              <span class={hint} style={{ marginTop: 0 }}>{run.samples.length} found · looked for {run.lookFor.join(", ")}</span>
            </div>
            <ol class={css({ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 4 })}>
              {visible.map((sample) => {
                const n = run.samples.indexOf(sample) + 1;
                const image = sample.cutout ?? sample.crop;
                return (
                  <li key={sample.id} id={`sample-${sample.id}`} data-focus={st.focus === sample.id ? "true" : undefined}
                    onMouseEnter$={() => (st.focus = sample.id)}
                    class={css({ bg: "card", border: "1px solid token(colors.rule)", rounded: "lg", overflow: "hidden", display: "flex", flexDirection: "column", transition: "border-color 0.15s, box-shadow 0.15s", "&[data-focus=true]": { borderColor: "chalk", boxShadow: "sheet" } })}>
                    <div class={css({ position: "relative", h: "150px", overflow: "hidden", bgImage: "linear-gradient(45deg, token(colors.paper-deep) 25%, transparent 25%, transparent 75%, token(colors.paper-deep) 75%), linear-gradient(45deg, token(colors.paper-deep) 25%, transparent 25%, transparent 75%, token(colors.paper-deep) 75%)", bgSize: "16px 16px", bgPosition: "0 0, 8px 8px" })}>
                      <img src={sampleFile(s.apiBase, run.id, image)} alt={label(sample)} loading="lazy" width={sample.box.w} height={sample.box.h} class={css({ position: "absolute", inset: 4, w: "calc(100% - 32px)", h: "calc(100% - 32px)", objectFit: "contain", imageRendering: Math.min(sample.box.w, sample.box.h) < 48 ? "pixelated" : "auto" })} />
                      <span aria-hidden="true" class={css({ position: "absolute", top: 2, left: 2, fontFamily: "mono", fontSize: "11px", px: "5px", py: "2px", bg: "ink", color: "paper", rounded: "2px" })}>{n}</span>
                    </div>
                    <div class={css({ p: 4, display: "flex", flexDirection: "column", gap: 3, flex: 1, borderTop: "1px solid token(colors.rule)" })}>
                      <div class={css({ display: "flex", justifyContent: "space-between", gap: 3, alignItems: "start" })}>
                        <div class={css({ minW: 0 })}>
                          <h3 class={css({ fontSize: "15px", fontWeight: 600, overflowWrap: "anywhere" })}>{sample.text ? `“${sample.text}”` : capital(sample.foundBy.filter((f) => f !== "page")[0] ?? sample.original?.kind ?? "element")}</h3>
                          <p class={css({ fontSize: "12px", color: "ink-muted", mt: 1 })}>
                            {sample.foundBy.includes("page") ? "From the page" : `Found as ${sample.foundBy.join(", ")}`}
                            {` · ${sample.box.w}×${sample.box.h}`}
                            {sample.original?.kind === "svg" ? " · vector original" : sample.original ? " · original image" : sample.cutout ? " · cut-out" : ""}
                          </p>
                        </div>
                        {sample.judgement && <Meter label="Fit" value={sample.judgement.relevance} compact />}
                      </div>
                      {sample.judgement && <Reasons judgement={sample.judgement} compact />}
                      <div class={css({ mt: "auto", display: "flex", flexDirection: "column", gap: 2 })}>
                        <label class={css({ srOnly: true })} for={`why-${sample.id}`}>Why keep sample {n}?</label>
                        <input id={`why-${sample.id}`} class={cx(input, css({ h: "34px", fontSize: "13px" }))} maxLength={200} placeholder="Why it matters (optional)"
                          value={st.why[sample.id] ?? ""} disabled={!!st.kept[sample.id]} onInput$={(_, el) => (st.why[sample.id] = el.value)} />
                        <button type="button" class={act(st.kept[sample.id] ? "pin" : "chalk", btnSm)} aria-pressed={!!st.kept[sample.id]} disabled={!!st.kept[sample.id] || st.keeping === sample.id} onClick$={() => keep(sample)}>
                          {st.kept[sample.id] ? "On the moodboard" : st.keeping === sample.id ? "Keeping…" : sample.original ? "Keep the original" : "Keep the cut-out"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {run.samples.length > 12 && <button type="button" class={act("go", css({ mt: 4 }))} onClick$={() => (st.showAll = !st.showAll)}>{st.showAll ? "Show the twelve most wanted" : `Show all ${run.samples.length}`}</button>}
          </section>
        </>
      )}
    </div>
  );
});

const pct = (n: number, of: number) => `${(n / of) * 100}%`;
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
const label = (sample: Sample) => sample.text ?? sample.original?.alt ?? sample.foundBy.filter((f) => f !== "page")[0] ?? "page element";
const fitTone = (sample: Sample) => (sample.judgement && sample.judgement.relevance.p10 >= 4 ? "high" : undefined);

/** A 0–10 reading: the median as a mark, its 80% range as a band. */
const Scale = component$<{ value: Interval }>(({ value }) => (
  <span class={css({ display: "inline-flex", alignItems: "center", gap: 2 })}>
    <span aria-hidden="true" class={css({ position: "relative", w: "88px", h: "6px", bg: "paper-deep", rounded: "full", border: "1px solid token(colors.rule)" })}>
      <i class={css({ position: "absolute", top: 0, bottom: 0, bg: "rule-strong", rounded: "full" })} style={{ left: `${value.p10 * 10}%`, width: `${Math.max(2, (value.p90 - value.p10) * 10)}%` }} />
      <i class={css({ position: "absolute", top: "-3px", w: "3px", h: "10px", bg: "ink", rounded: "1px" })} style={{ left: `calc(${value.median * 10}% - 1.5px)` }} />
    </span>
    <span class={css({ fontFamily: "mono", fontSize: "11px", color: "ink-muted" })}>{value.median}/10 <span aria-label={`likely between ${value.p10} and ${value.p90}`}>({value.p10}–{value.p90})</span></span>
  </span>
));

const Meter = component$<{ label: string; value: Interval; compact?: boolean }>(({ label: name, value, compact }) => (
  <div class={css({ textAlign: "right", flexShrink: 0 })} role="img" aria-label={`${name}: ${value.median} out of 10, likely ${value.p10} to ${value.p90}`}>
    <span class={css({ display: "block", fontFamily: "display", lineHeight: 1 })} style={{ fontSize: compact ? "26px" : "40px", color: value.p10 >= 4 ? "var(--colors-thread-ink)" : undefined }}>{value.median}<span class={css({ fontSize: "0.45em", color: "ink-muted" })}>/10</span></span>
    <span class={css({ display: "block", fontSize: "11px", color: "ink-muted", mt: 1 })}>{compact ? `${value.p10}–${value.p90}` : `${name} · likely ${value.p10}–${value.p90}`}</span>
  </div>
));

/** Why: the persona's traits this clearly shows, and pet peeves it commits. */
const Reasons = component$<{ judgement: { traits: Array<Interval & { id: string; label: string; kind: "value" | "look" | "peeve" }> }; subject?: string; compact?: boolean }>(({ judgement, subject, compact }) => {
  const { fits, clashes } = reasons(judgement.traits);
  if (!fits.length && !clashes.length) return <p class={css({ fontSize: "12.5px", color: "ink-muted" })}>{subject ? `${subject} doesn’t clearly show` : "Doesn’t clearly show"} any of their traits.</p>;
  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 2 })}>
      {!compact && <h3 class={kicker}>Why</h3>}
      {fits.length > 0 && <ul aria-label="Traits it shows" class={css({ display: "flex", flexWrap: "wrap", gap: "6px", listStyle: "none" })}>
        {fits.map((t) => <li key={t.id} class={cx(chip, css({ fontSize: "12px" }))} title={`${t.median}/10, likely ${t.p10}–${t.p90}`}>{t.label}</li>)}
      </ul>}
      {clashes.length > 0 && <ul aria-label="Pet peeves it commits" class={css({ display: "flex", flexWrap: "wrap", gap: "6px", listStyle: "none" })}>
        {clashes.map((t) => <li key={t.id} class={cx(chip, css({ fontSize: "12px", color: "thread-ink", borderColor: "thread-ink" }))} title={`${t.median}/10, likely ${t.p10}–${t.p90}`}>✕ {t.label}</li>)}
      </ul>}
    </div>
  );
});
