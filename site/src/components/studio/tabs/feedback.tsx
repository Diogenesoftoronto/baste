import { $, component$, useContext, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, toast } from "../context";
import { btn, fieldLabel, hint, input, kicker, panel, panelTitle, splitList } from "../ui";
import type { FeedbackSummary, RankStats } from "~/lib/api-types";
import { chalkPuff, play } from "~/lib/juice";

/** Teach the persona's taste: rate assets, see what it has learned. */
export const FeedbackTab = component$(() => {
  const s = useContext(StudioCtx);
  const stats = useSignal<RankStats | null>(null);
  const summary = useSignal<FeedbackSummary | null>(null);
  const form = useStore({ assetId: "", feedback: "", tags: "", score: 0 });

  const load = $(async () => {
    try {
      const [r, f] = await Promise.all([s.client!.getRanks(s.selectedId), s.client!.getFeedback(s.selectedId).catch(() => null)]);
      stats.value = r;
      summary.value = f;
    } catch (err) {
      toast(s, errMsg(err), "error");
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => s.selectedId);
    if (s.client) load();
  });

  const submit = $(async (score: number, e: MouseEvent) => {
    if (!form.assetId.trim()) {
      toast(s, "Name the asset you're rating", "info");
      return;
    }
    try {
      await s.client!.rank({ assetId: form.assetId.trim(), personaId: s.selectedId, score, feedback: form.feedback, tags: splitList(form.tags) });
      play(score > 0 ? "thread" : "chalk", score > 0 ? 0.9 : 0.1);
      chalkPuff(e.clientX, e.clientY, score > 0 ? "rgba(46,125,91,0.6)" : "rgba(210,64,42,0.55)");
      toast(s, score > 0 ? "Noted: more like this" : "Noted: less like this");
      form.feedback = "";
      await load();
    } catch (err) {
      toast(s, errMsg(err), "error");
    }
  });

  const st = stats.value;
  const trend = st?.trend ?? [];
  const w = 280, h = 64;
  const path = trend.length > 1
    ? trend.map((v, i) => `${i ? "L" : "M"}${((i / (trend.length - 1)) * w).toFixed(1)} ${(h / 2 - v * (h / 2 - 4)).toFixed(1)}`).join(" ")
    : "";

  return (
    <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "minmax(300px, 0.75fr) minmax(0, 1.25fr)" }, gap: 6, alignItems: "start" })}>
      <section class={panel} aria-labelledby="fb-rate">
        <span class={kicker}>Fitting notes</span>
        <h2 id="fb-rate" class={panelTitle}>Rate an asset</h2>
        <p class={hint}>Verdicts feed back into future prompts, so the next round fits better.</p>
        <div class={css({ display: "flex", flexDirection: "column", gap: 3, mt: 4 })}>
          <div>
            <label class={fieldLabel} for="fb-asset">Asset</label>
            <input id="fb-asset" class={input} placeholder="e.g. cyberbotanist-hero-1730…" value={form.assetId} onInput$={(_, el) => (form.assetId = el.value)} />
          </div>
          <div>
            <label class={fieldLabel} for="fb-note">Why</label>
            <input id="fb-note" class={input} placeholder="too clean — wants more spore texture" value={form.feedback} onInput$={(_, el) => (form.feedback = el.value)} />
          </div>
          <div>
            <label class={fieldLabel} for="fb-tags">Tags</label>
            <input id="fb-tags" class={input} placeholder="texture, palette" value={form.tags} onInput$={(_, el) => (form.tags = el.value)} />
          </div>
          <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 })}>
            <button class={btn("secondary", css({ h: "44px" }))} onClick$={(e) => submit(1, e)}>
              <span aria-hidden="true">＋</span> More like this
            </button>
            <button class={btn("secondary", css({ h: "44px" }))} onClick$={(e) => submit(-1, e)}>
              <span aria-hidden="true">－</span> Less like this
            </button>
          </div>
        </div>
      </section>

      <div class={css({ display: "flex", flexDirection: "column", gap: 6, minW: 0 })}>
        <section class={panel} aria-labelledby="fb-learned">
          <span class={kicker}>Learned taste</span>
          <h2 id="fb-learned" class={panelTitle}>{st && st.total ? `${st.total} verdicts so far` : "No verdicts yet"}</h2>
          {st && st.total > 0 && (
            <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "auto 1fr" }, gap: 6, mt: 4, alignItems: "center" })}>
              <dl class={css({ display: "flex", gap: 6 })}>
                {([["More", st.positive, "#2E7D5B"], ["Less", st.negative, "#A9311E"], ["Net", st.score.toFixed(2), "#1C1B19"]] as const).map(([k, v, c]) => (
                  <div key={k}>
                    <dt class={css({ fontSize: "12px", color: "ink-muted" })}>{k}</dt>
                    <dd class="display" style={{ fontSize: "34px", color: c }}>{v}</dd>
                  </div>
                ))}
              </dl>
              {path && (
                <svg viewBox={`0 0 ${w} ${h}`} class={css({ w: "100%", h: "64px" })} role="img" aria-label="Trend of recent verdicts">
                  <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="#CFC7B8" stroke-dasharray="3 4" />
                  <path d={path} fill="none" stroke="#D2402A" stroke-width="2" stroke-dasharray="8 5" stroke-linecap="round" />
                </svg>
              )}
            </div>
          )}
          {summary.value && (summary.value.topUpTags.length > 0 || summary.value.topDownTags.length > 0) && (
            <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 4, mt: 5 })}>
              {([["Leans toward", summary.value.topUpTags, "#2E7D5B"], ["Steers away from", summary.value.topDownTags, "#A9311E"]] as const).map(([k, list, c]) => (
                <div key={k}>
                  <h3 class={css({ fontSize: "13px", fontWeight: 600, mb: 2 })} style={{ color: c }}>{k}</h3>
                  <ul class={css({ listStyle: "none", display: "flex", flexDirection: "column", gap: 1 })}>
                    {list.map((t) => (
                      <li key={t.tag} class={css({ display: "grid", gridTemplateColumns: "1fr 60px 24px", gap: 2, alignItems: "center", fontSize: "13px" })}>
                        <span>{t.tag}</span>
                        <span class={css({ h: "6px", rounded: "full" })} style={{ background: c, width: `${Math.min(100, t.count * 20)}%`, opacity: 0.7 }} />
                        <span class={css({ fontFamily: "mono", fontSize: "11px", textAlign: "right" })}>{t.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {st && st.recent.length > 0 && (
          <section class={panel} aria-labelledby="fb-recent">
            <h2 id="fb-recent" class={panelTitle}>Recent verdicts</h2>
            <ul class={css({ listStyle: "none", mt: 3 })}>
              {st.recent.map((r) => (
                <li key={`${r.assetId}-${r.ts}`} class={css({ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 3, py: 2, borderBottom: "1px solid token(colors.rule)", fontSize: "13px", alignItems: "baseline" })}>
                  <span style={{ color: r.score > 0 ? "#2E7D5B" : "#A9311E", fontWeight: 700 }}>{r.score > 0 ? "＋" : "－"}</span>
                  <span>
                    <span class={css({ fontFamily: "mono", fontSize: "12px" })}>{r.assetId}</span>
                    {r.feedback && <span class={css({ display: "block", color: "ink-muted" })}>{r.feedback}</span>}
                  </span>
                  <span class={css({ fontFamily: "mono", fontSize: "11px", color: "ink-muted" })}>{new Date(r.ts).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary.value?.document && (
          <details class={panel}>
            <summary class={css({ fontWeight: 600, fontSize: "14px" })}>What gets injected into prompts</summary>
            <pre class={css({ mt: 3, p: 4, bg: "night", color: "night-text", rounded: "sm", fontFamily: "mono", fontSize: "12px", whiteSpace: "pre-wrap", maxH: "320px", overflow: "auto" })}>{summary.value.document}</pre>
          </details>
        )}
      </div>
    </div>
  );
});
