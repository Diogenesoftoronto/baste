import { $, component$, useContext, useSignal, useStore } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, refreshPersonas, selectPersona } from "../context";
import { btn, fieldLabel, hint, input, kicker, panel, panelTitle } from "../ui";
import type { DecomposeResult } from "~/lib/api-types";
import { onColor } from "~/lib/fitting";
import { play } from "~/lib/juice";
import { ServerOnly } from "./server-only";

const STEPS = ["Fetching the page", "Reading stylesheets", "Assigning palette roles", "Finding type & logo", "Drafting the persona"];

/** Unpick a live site's seams: palette, type, imagery → a draft persona. */
export const DecomposeFlow = component$(() => {
  const s = useContext(StudioCtx);
  const f = useStore({ url: "", id: "", name: "", seed: true, deep: false, mirror: false, init: false });
  const running = useSignal(false);
  const step = useSignal(0);
  const result = useSignal<DecomposeResult | null>(null);
  const error = useSignal("");

  const run = $(async () => {
    if (!s.client || !f.url.trim()) return;
    running.value = true;
    error.value = "";
    result.value = null;
    step.value = 0;
    const tick = setInterval(() => (step.value = Math.min(STEPS.length - 1, step.value + 1)), f.deep ? 2600 : 1100);
    try {
      result.value = await s.client.decompose({
        url: f.url.trim(),
        id: f.id.trim() || undefined,
        name: f.name.trim() || undefined,
        seedMoodboard: f.seed,
        deep: f.deep,
        mirrorAssets: f.mirror,
        initVersioning: f.init,
      });
      play("fanfare");
      await refreshPersonas(s);
    } catch (err) {
      play("error");
      error.value = errMsg(err);
    } finally {
      clearInterval(tick);
      running.value = false;
    }
  });

  const r = result.value;

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 6, maxW: "1100px" })}>
      <header>
        <span class={kicker}>Unpick the seams</span>
        <h1 class="display" style={{ fontSize: "clamp(32px, 4vw, 48px)" }}>Decompose a website</h1>
        <p class={css({ color: "ink-soft", maxW: "62ch", mt: 2 })}>
          Give Baste a site you admire. It reads the CSS, assigns palette roles, finds fonts, logo and imagery, and drafts a persona
          with a brand kit attached — so its real colours flow into your tokens.
        </p>
      </header>

      {s.status !== "live" && <ServerOnly what="Decomposing sites" />}

      <section class={panel} aria-labelledby="dc-form">
        <h2 id="dc-form" class={panelTitle}>Source</h2>
        <form preventdefault:submit onSubmit$={run} class={css({ display: "flex", flexDirection: "column", gap: 4, mt: 4 })}>
          <div>
            <label class={fieldLabel} for="dc-url">URL</label>
            <div class={css({ display: "flex", gap: 2, flexWrap: { base: "wrap", sm: "nowrap" } })}>
              <input id="dc-url" type="url" required class={input} placeholder="https://qwik.dev" value={f.url} onInput$={(_, el) => (f.url = el.value)} />
              <button type="submit" class={btn("primary", css({ flexShrink: 0 }))} data-juice="snip" disabled={running.value || s.status !== "live"}>
                {running.value ? "Unpicking…" : "Decompose"}
              </button>
            </div>
          </div>
          <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 4 })}>
            <div>
              <label class={fieldLabel} for="dc-id">Slug (optional)</label>
              <input id="dc-id" class={input} placeholder="from the domain" value={f.id} onInput$={(_, el) => (f.id = el.value)} />
            </div>
            <div>
              <label class={fieldLabel} for="dc-name">Display name (optional)</label>
              <input id="dc-name" class={input} placeholder="from the page title" value={f.name} onInput$={(_, el) => (f.name = el.value)} />
            </div>
          </div>
          <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 2 })}>
            {([
              ["seed", "Seed the moodboard", "Pin the site's imagery as references"],
              ["deep", "Deep render", "Run JavaScript with Playwright — needed for SPAs"],
              ["mirror", "Mirror assets", "Save logo, OG image and thumbnails to disk"],
              ["init", "Start version history", "Track every later change to this persona"],
            ] as const).map(([k, label, desc]) => (
              <label key={k} class={css({ display: "flex", gap: 3, p: 3, rounded: "base", border: "1px solid token(colors.rule)", cursor: "pointer", "&:has(input:checked)": { borderColor: "ink", bg: "paper" } })}>
                <input type="checkbox" checked={f[k]} onChange$={(_, el) => (f[k] = el.checked)} class={css({ accentColor: "#1C1B19", mt: "3px" })} />
                <span>
                  <span class={css({ display: "block", fontSize: "14px", fontWeight: 600 })}>{label}</span>
                  <span class={css({ display: "block", fontSize: "12.5px", color: "ink-muted" })}>{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </form>

        {running.value && (
          <ol aria-live="polite" class={css({ listStyle: "none", mt: 5, display: "flex", flexDirection: "column", gap: 2 })}>
            {STEPS.map((st, i) => (
              <li key={st} class={css({ display: "flex", gap: 3, alignItems: "center", fontSize: "14px" })} style={{ color: i <= step.value ? "#1C1B19" : "#A79E8D" }}>
                <span aria-hidden="true" class={css({ fontFamily: "mono", w: "18px" })}>{i < step.value ? "✓" : i === step.value ? "›" : "·"}</span>
                {st}
              </li>
            ))}
          </ol>
        )}
        {error.value && <p role="alert" class={css({ mt: 4, p: 3, rounded: "base", bg: "rgba(210,64,42,0.08)", color: "thread-ink", fontSize: "14px" })}>{error.value}</p>}
      </section>

      {r && (
        <section class={panel} aria-labelledby="dc-result">
          <span class={kicker}>Drafted</span>
          <h2 id="dc-result" class={panelTitle}>{r.persona.name}</h2>
          <p class={css({ color: "ink-soft", mt: 1 })}>{r.persona.summary}</p>
          <div class={css({ display: "flex", mt: 4, rounded: "base", overflow: "hidden", border: "1px solid token(colors.rule)" })}>
            {Object.entries(r.brandKit.paletteRoles).filter(([, v]) => v).map(([role, hex]) => (
              <div key={role} class={css({ flex: 1, minW: 0, h: "72px", p: 2, display: "flex", flexDirection: "column", justifyContent: "flex-end", fontSize: "11px" })} style={{ background: hex!, color: onColor(hex!) }}>
                <span class={css({ fontWeight: 600 })}>{role}</span>
                <span class={css({ fontFamily: "mono" })}>{hex}</span>
              </div>
            ))}
          </div>
          <p class={hint}>Fonts: {r.brandKit.fonts.join(", ") || "none detected"}</p>
          <div class={css({ display: "flex", gap: 2, mt: 4 })}>
            <button class={btn("primary")} onClick$={() => selectPersona(s, r.persona.id, "fitting")}>See the fitting</button>
            <button class={btn("secondary")} onClick$={() => selectPersona(s, r.persona.id, "brandkit")}>Open brand kit</button>
          </div>
        </section>
      )}
    </div>
  );
});
