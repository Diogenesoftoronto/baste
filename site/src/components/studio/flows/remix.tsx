import { useLocale } from '~/i18n/provider';
import { text } from '~/i18n/runtime';
import { $, component$, useComputed$, useContext, useSignal, useStore } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, refreshPersonas, selectPersona, toast } from "../context";
import { btn, fieldLabel, hint, input, kicker, panel, panelTitle } from "../ui";
import { ServerOnly } from "./server-only";
import { play } from "~/lib/juice";

/** Cross two personas: weave one as warp, the other as weft. */
export const RemixFlow = component$(() => {
  const s = useContext(StudioCtx);
  const locale = useLocale();
  const f = useStore({ a: s.personas[0]?.id ?? "", b: s.personas[1]?.id ?? "", id: "", name: "" });
  const busy = useSignal(false);

  const suggested = useComputed$(() => (f.a && f.b ? `${f.a.split("-")[0]}-x-${f.b.split("-")[0]}` : ""));

  const run = $(async () => {
    if (!s.client || !f.a || !f.b || f.a === f.b) return;
    busy.value = true;
    const id = (f.id || suggested.value).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    try {
      await s.client.remix({ a: f.a, b: f.b, id, name: f.name.trim() || undefined });
      play("fanfare");
      toast(s, text(locale.value, "Woven together"));
      await refreshPersonas(s);
      selectPersona(s, id, "fitting");
    } catch (err) {
      play("error");
      toast(s, errMsg(err), "error");
    } finally {
      busy.value = false;
    }
  });

  const A = s.tokens[f.a];
  const B = s.tokens[f.b];

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 6, maxW: "1000px" })}>
      <header>
        <span class={kicker}>{text(locale.value, "Warp × weft")}</span>
        <h1 class="display" style={{ fontSize: "clamp(32px, 4vw, 48px)" }}>{text(locale.value, "Remix two personas")}</h1>
        <p class={css({ color: "ink-soft", maxW: "60ch", mt: 2 })}>{text(locale.value, "Influences and brand kits are crossed into a new persona. The preview weaves their primaries together.")}</p>
      </header>

      {s.status !== "live" && <ServerOnly what="Remixing" />}

      <section class={panel} aria-labelledby="rx-form">
        <h2 id="rx-form" class={panelTitle}>{text(locale.value, "Threads")}</h2>
        <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 160px 1fr" }, gap: 4, mt: 4, alignItems: "center" })}>
          <div>
            <label class={fieldLabel} for="rx-a">{text(locale.value, "Warp")}</label>
            <select id="rx-a" class={input} value={f.a} onChange$={(_, el) => (f.a = el.value)}>
              {s.personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {/* woven swatch preview */}
          <div
            role="img"
            aria-label={text(locale.value, "Woven preview of the two palettes")}
            class={css({ h: "110px", rounded: "base", border: "1px solid token(colors.rule)", boxShadow: "sheet" })}
            style={{
              backgroundColor: B?.colors.primary ?? "#ccc",
              backgroundImage: A
                ? `repeating-linear-gradient(90deg, ${A.colors.primary} 0 6px, transparent 6px 12px), repeating-linear-gradient(0deg, ${B?.colors.secondary ?? "#999"} 0 6px, transparent 6px 12px)`
                : undefined,
              backgroundBlendMode: "normal",
              maskImage: "linear-gradient(#000, #000)",
            }}
          />
          <div>
            <label class={fieldLabel} for="rx-b">{text(locale.value, "Weft")}</label>
            <select id="rx-b" class={input} value={f.b} onChange$={(_, el) => (f.b = el.value)}>
              {s.personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        {f.a === f.b && <p class={hint} role="alert">{text(locale.value, "Pick two different personas.")}</p>}
        <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 4, mt: 5 })}>
          <div>
            <label class={fieldLabel} for="rx-id">{text(locale.value, "Slug")}</label>
            <input id="rx-id" class={input} placeholder={suggested.value} value={f.id} onInput$={(_, el) => (f.id = el.value)} />
          </div>
          <div>
            <label class={fieldLabel} for="rx-name">{text(locale.value, "Name")}</label>
            <input id="rx-name" class={input} placeholder={text(locale.value, "Generated from both")} value={f.name} onInput$={(_, el) => (f.name = el.value)} />
          </div>
        </div>
        <button class={btn("primary", css({ mt: 5 }))} data-juice="snip" disabled={busy.value || f.a === f.b || s.status !== "live"} onClick$={run}>
          {busy.value ? text(locale.value, "Weaving…") : text(locale.value, "Weave them together")}
        </button>
      </section>
    </div>
  );
});
