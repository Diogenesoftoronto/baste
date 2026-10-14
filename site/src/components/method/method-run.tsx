import { $, component$, sync$, useComputed$, useSignal, useStyles$, useVisibleTask$ } from "@builder.io/qwik";
import Tempus from "tempus";
import type { RecordedRun } from "~/lib/recorded-runs";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";
import { voiceOf } from "~/lib/converse";
import { ShaderCanvas } from "~/components/fx/shader-canvas";
import cyberbotanist from "~/lib/runs/cyberbotanist.json";
import nightmarketcoder from "~/lib/runs/nightmarketcoder.json";
import liminalweeb from "~/lib/runs/liminalweeb.json";
import styles from "./method-run.css?inline";

const RUNS: Record<string, RecordedRun> = {
  cyberbotanist: cyberbotanist as RecordedRun,
  nightmarketcoder: nightmarketcoder as RecordedRun,
  liminalweeb: liminalweeb as RecordedRun,
};
const ORDER = ["cyberbotanist", "nightmarketcoder", "liminalweeb"];

/** Scroll phases, as fractions of the pinned span. Keep in step with method-run.css. */
const LAND_START = 0.04;
const LAND_STEP = 0.021;
const LAND_SPAN = 0.07;
const JUDGE_START = 0.62;
const CUT_START = 0.78;

const CRITERIA: Array<[string, string]> = [
  ["personaAlignment", "Persona alignment"],
  ["visualQuality", "Visual quality"],
  ["uniqueness", "Uniqueness"],
  ["coherence", "Coherence"],
  ["usability", "Usability"],
];

/** Where the judge placed a draft, in words. */
function direction(f: number[]): string {
  const temp = f[0] <= -0.33 ? "cool" : f[0] >= 0.33 ? "warm" : "neutral";
  const density = f[1] >= 0.75 ? "dense" : f[1] <= 0.35 ? "sparse" : "balanced";
  return `${temp} and ${density}`;
}

const VARIATION = /^- (.+) (color temperature|visual density|rendering)$/gm;
const variation = (brief: string) =>
  [...brief.matchAll(VARIATION)].map((m) => ({ value: m[1], axis: m[2] === "color temperature" ? "colour" : m[2] === "visual density" ? "density" : "rendering" }));

/** The parts of a drafted brief worth reading in a hero: subject, variation, references. */
function readBrief(run: RecordedRun) {
  const lines = run.brief.split("\n");
  const subject = lines[0].replace(/^Stunning hero image:\s*/, "");
  const elements = lines.find((l) => l.includes("Core visual elements"))?.replace(/^- Core visual elements:\s*/, "") ?? "";
  const nod = lines.find((l) => l.startsWith("Create something")) ?? "";
  const final = variation(run.evolved);
  return { subject, elements, nod, axes: variation(run.brief).map((s, i) => ({ ...s, final: final[i]?.value ?? s.value })) };
}

/** A hand-drawn grease-pencil loop that overshoots where it closes. */
const LOOP = "M10 46 C 6 20, 40 5, 104 6 C 170 7, 196 22, 194 44 C 192 70, 150 84, 98 83 C 42 82, 4 70, 8 40 C 10 26, 30 14, 58 9";

/**
 * The /method hero: one real Baste run as a darkroom contact sheet. As the page
 * scrolls (Lenis, pinned), six generations of drafts develop strip by strip,
 * the judge's scores appear on the film edge, and grease pencil circles the
 * drafts Baste kept — the best in each direction it explored. Every frame is
 * real output and opens to the judge's notes. Reduced motion and narrow
 * screens get the finished sheet.
 */
export const MethodRun = component$(() => {
  useStyles$(styles);
  const active = useSignal(ORDER[0]);
  const selected = useSignal<number | null>(null);
  const landed = useSignal(24);
  const phase = useSignal<"land" | "judge" | "cut">("cut");
  const root = useSignal<HTMLElement>();

  const strips = useComputed$(() => {
    const byGeneration = new Map<number, number[]>();
    RUNS[active.value].candidates.forEach((c, i) => byGeneration.set(c.generation, [...(byGeneration.get(c.generation) ?? []), i]));
    return [...byGeneration.entries()].sort((a, b) => a[0] - b[0]);
  });

  // Follow the pinned progress for the live counter and the phase wording.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const el = root.value;
    if (!el) return;
    const settled = window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 959px)");
    let last = "";
    const remove = Tempus.add(() => {
      const p = settled.matches ? 1 : Number(el.style.getPropertyValue("--pin") || 0);
      const n = Math.max(0, Math.min(24, Math.floor((p - LAND_START - LAND_SPAN / 2) / LAND_STEP) + 1));
      const ph = p >= CUT_START ? "cut" : p >= JUDGE_START ? "judge" : "land";
      if (`${n}:${ph}` === last) return;
      last = `${n}:${ph}`;
      landed.value = n;
      phase.value = ph;
    }, { label: "method-run" });
    cleanup(() => remove?.());
  });

  const pick = $((id: string) => {
    active.value = id;
    selected.value = null;
  });

  const run = RUNS[active.value];
  const t = DEMO_TOKENS[active.value];
  const handle = voiceOf(active.value).handle;
  const brief = readBrief(run);
  const keptOrder = new Map<number, number>();
  run.candidates.forEach((c, i) => { if (c.cell) keptOrder.set(i, keptOrder.size); });
  const shown = Math.min(landed.value, run.candidates.length);
  const generation = shown ? run.candidates[shown - 1].generation : 0;
  const focus = selected.value ?? run.best.index;
  const draft = run.candidates[focus];
  const quote = draft.feedback.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  const stops = [
    { color: "#0c0a09", position: 0 },
    { color: "#4a100b", position: 0.45 },
    { color: t.colors.primary, position: 0.8 },
    { color: t.colors.accent, position: 1 },
  ];

  return (
    <section ref={root} class="method-run" data-pin aria-labelledby="method-title" style={{ "--persona-primary": t.colors.primary, "--persona-accent": t.colors.accent }}>
      <div class="method-run-stage">
        <div class="method-run-copy">
          <a href="/#meet" class="method-run-back">← Back to the personas</a>
          <span class="label method-run-kicker">The method · one real run</span>
          <h1 id="method-title" class="display">24 drafts for <em>one</em> person.</h1>
          <p class="method-run-lede">
            Every frame here is a real draft from one Baste run for {handle}, scored by a vision model that looked at
            it. The circled frames are what Baste kept: the best in each direction it explored.
          </p>

          <div role="tablist" aria-label="Whose run" class="method-run-tabs">
            {ORDER.map((id) => {
              const isActive = id === active.value;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`run-${id}`}
                  aria-selected={isActive}
                  aria-controls="method-run-sheet"
                  tabIndex={isActive ? 0 : -1}
                  title={DEMO_PERSONAS.find((p) => p.id === id)!.name}
                  data-juice="pin"
                  class="method-run-tab"
                  style={{ "--tab-accent": DEMO_TOKENS[id].colors.accent }}
                  onClick$={() => pick(id)}
                  onKeyDown$={[sync$((event: KeyboardEvent) => {
                    if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) event.preventDefault();
                  }), $(async (event: KeyboardEvent) => {
                    const i = ORDER.indexOf(id);
                    const n = event.key === "Home" ? 0 : event.key === "End" ? ORDER.length - 1 : event.key === "ArrowRight" ? (i + 1) % ORDER.length : event.key === "ArrowLeft" ? (i + ORDER.length - 1) % ORDER.length : -1;
                    if (n < 0) return;
                    await pick(ORDER[n]);
                    document.getElementById(`run-${ORDER[n]}`)?.focus();
                  })]}
                >
                  <img src={`/assets/companions/${id}.webp`} alt="" width={30} height={30} loading="lazy" decoding="async" />
                  {voiceOf(id).handle}
                </button>
              );
            })}
          </div>

          <ol class="method-run-steps">
            <li data-step="1"><strong>Baste</strong><span>Four seed drafts, then five rounds that nudge the brief warmer or cooler, sparser or denser.</span></li>
            <li data-step="2"><strong>Fit</strong><span>A vision model scores every draft against {handle}’s taste, and whether it still works as an interface.</span></li>
            <li data-step="3"><strong>Cut</strong><span>The best in each direction is kept. You choose from the spread, not one guess.</span></li>
          </ol>

          <p class="method-run-counter">
            {phase.value === "cut"
              ? <><strong>{keptOrder.size}</strong> kept from <strong>{run.candidates.length}</strong> drafts</>
              : <><strong>{shown}</strong>/{run.candidates.length} {phase.value === "judge" ? "judged" : "developed"} · {generation ? <>generation <strong>{generation}</strong> of {run.generations}</> : "seeds"}</>}
          </p>
        </div>

        <div class="method-run-table-wrap">
          <div class="method-run-table">
            <ShaderCanvas
              class="method-run-glow"
              fallback={`radial-gradient(70% 60% at 30% 0%, rgba(150, 30, 20, .35), transparent 70%), radial-gradient(60% 60% at 90% 100%, color-mix(in oklab, ${t.colors.accent} 16%, transparent), transparent 70%), #0c0a09`}
              layers={[
                { type: "SolidColor", id: "ground", props: { color: "#0c0a09" } },
                { type: "MeshGradient", id: "safelight", props: { stops, count: 4, smoothness: 2.6, variation: 0.28, swirl: 0.2, drift: 0.14, speed: 0.22, opacity: 0.5 } },
                { type: "FilmGrain", id: "grain", props: { strength: 0.12, animated: true } },
              ]}
              live={{ safelight: { stops } }}
            />

            <div id="method-run-sheet" role="tabpanel" aria-labelledby={`run-${active.value}`} class="method-run-sheet">
              <p class="method-run-hint" aria-hidden="true">Scroll to develop the run <span>↓</span></p>
              {strips.value.map(([g, indices]) => (
                <div key={`${active.value}-${g}`} class="method-run-strip">
                  <span class="method-run-edge" aria-hidden="true">BASTE ▸ {g ? `GEN ${g}` : "SEEDS"}</span>
                  <ol class="method-run-frames" aria-label={`Generation ${g}`}>
                    {indices.map((i) => {
                      const c = run.candidates[i];
                      const k = keptOrder.get(i);
                      const best = i === run.best.index;
                      return (
                        <li
                          key={i}
                          class="method-run-frame"
                          data-kept={k !== undefined ? "true" : "false"}
                          data-best={best ? "true" : "false"}
                          style={{ "--i": i, "--k": k ?? 0, "--loop-tilt": `${((i * 37) % 7) - 3}deg` }}
                        >
                          <button
                            type="button"
                            class="method-run-frame-button"
                            aria-pressed={selected.value === i}
                            aria-label={`Draft ${i + 1}, generation ${g}, judged ${c.quality.toFixed(2)}${k !== undefined ? ", kept" : ""}. Show the judge's notes.`}
                            onClick$={() => (selected.value = selected.value === i ? null : i)}
                          >
                            <img src={c.url} alt="" width={480} height={270} loading="lazy" decoding="async" />
                          </button>
                          <span class="method-run-frame-edge" aria-hidden="true">
                            <span>{String(i + 1).padStart(2, "0")}A</span>
                            <span class="method-run-frame-score">{c.quality.toFixed(2)}</span>
                          </span>
                          {k !== undefined && (
                            <svg class="method-run-loop" viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden="true">
                              <path d={LOOP} pathLength={1} />
                            </svg>
                          )}
                          {best && (
                            <svg class="method-run-star" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 2.5 L12.4 21 M3.5 7.5 L20.5 16.2 M20 7 L4 16.8" pathLength={1} />
                            </svg>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>

            <div class="method-run-panel" data-selected={selected.value !== null ? "true" : "false"}>
              <article class="method-run-brief" aria-label="The brief">
                <span class="label">The brief</span>
                <p class="method-run-brief-from">Drafted from {handle}’s measurements</p>
                <p class="method-run-brief-subject">{brief.subject}</p>
                <dl class="method-run-brief-axes">
                  <dt>Variation <small>seed → kept hero</small></dt>
                  {brief.axes.map((a) => (
                    <dd key={a.axis} data-moved={a.final !== a.value ? "true" : "false"}>
                      <span class="method-run-brief-axis">{a.axis}</span>
                      <span class="method-run-brief-seed">{a.value}</span>
                      {a.final !== a.value && <span class="method-run-brief-final">→ {a.final}</span>}
                    </dd>
                  ))}
                </dl>
                <p class="method-run-brief-refs">{brief.elements}</p>
                <p class="method-run-brief-nod">{brief.nod}</p>
              </article>

              <figure class="method-run-loupe" aria-live="polite">
                <img src={focus === run.best.index ? run.best.src : draft.url} alt={`Draft ${focus + 1} for ${handle}`} width={1280} height={720} loading="lazy" decoding="async" />
                <figcaption>
                  <span class="method-run-loupe-head">
                    <span>
                      <span class="label">Draft {focus + 1} · {draft.generation ? `generation ${draft.generation}` : "seed"}</span>
                      <span class="method-run-loupe-verdict" data-kept={draft.cell ? "true" : "false"}>
                        {draft.cell ? `Kept: ${direction(draft.features)}` : "Not kept: a stronger draft held this direction"}
                      </span>
                    </span>
                    <strong title="Judge score">{draft.quality.toFixed(2)}</strong>
                  </span>
                  <dl>
                    {CRITERIA.map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd><i style={{ width: `${Math.round((draft.criteria[key] ?? 0) * 100)}%` }} /><span>{(draft.criteria[key] ?? 0).toFixed(2)}</span></dd>
                      </div>
                    ))}
                  </dl>
                  <blockquote>“{quote}”<cite>— the judge, looking at the image</cite></blockquote>
                  {selected.value !== null && (
                    <button type="button" class="method-run-loupe-close" onClick$={() => (selected.value = null)}>
                      {focus === run.best.index ? "Close" : "Back to the pick"}
                    </button>
                  )}
                </figcaption>
              </figure>
            </div>
          </div>
          <p class="method-run-note">
            Real output from <code>baste generate {active.value} --provider fal</code> · Seedream drafts, judged by Gemini through fal.
            Select any frame to read the judge’s notes.
          </p>
        </div>
      </div>
    </section>
  );
});
