import { component$, useContext, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, toast } from "../context";
import { btn, btnSm, kicker, panel, panelTitle } from "../ui";
import { CodeView } from "~/components/ui/code-view";
import type { TokenFormat } from "~/lib/api-types";

const FORMATS: Array<{ id: TokenFormat; label: string; ext: string }> = [
  { id: "css", label: "CSS variables", ext: "css" },
  { id: "tailwind", label: "Tailwind", ext: "js" },
  { id: "panda", label: "Panda", ext: "ts" },
  { id: "json", label: "JSON", ext: "json" },
];

export const TokensTab = component$(() => {
  const s = useContext(StudioCtx);
  const format = useSignal<TokenFormat>("css");
  const content = useSignal("");
  const loading = useSignal(false);
  const t = s.tokens[s.selectedId];

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    const f = track(() => format.value);
    const id = track(() => s.selectedId);
    if (!s.client || !id) return;
    loading.value = true;
    try {
      content.value = (await s.client.exportTokens(id, f)).content;
    } catch (err) {
      content.value = "";
      toast(s, errMsg(err), "error");
    } finally {
      loading.value = false;
    }
  });

  const ext = FORMATS.find((f) => f.id === format.value)!.ext;

  return (
    <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "minmax(0, 1.25fr) minmax(300px, 0.75fr)" }, gap: 6, alignItems: "start" })}>
      <section class={panel} aria-labelledby="tok-title">
        <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 3, flexWrap: "wrap", mb: 4 })}>
          <div>
            <span class={kicker}>Pattern</span>
            <h2 id="tok-title" class={panelTitle}>Design tokens</h2>
          </div>
          <div class={css({ display: "flex", gap: 2 })}>
            <button
              class={btn("secondary", btnSm)}
              data-juice="copy"
              disabled={!content.value}
              onClick$={async () => {
                await navigator.clipboard?.writeText(content.value);
                toast(s, "Tokens copied");
              }}
            >
              Copy
            </button>
            <button
              class={btn("primary", btnSm)}
              data-juice="snip"
              disabled={!content.value}
              onClick$={() => {
                const blob = new Blob([content.value], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${s.selectedId}-tokens.${ext}`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Download .{ext}
            </button>
          </div>
        </div>
        <div role="tablist" aria-label="Format" class={css({ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" })}>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={format.value === f.id}
              onClick$={() => (format.value = f.id)}
              class={css({ h: "30px", px: 3, rounded: "sm", fontSize: "13px", border: "1px solid token(colors.rule)", bg: "card", color: "ink-soft", "&[aria-selected=true]": { bg: "ink", color: "paper", borderColor: "ink" } })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div aria-busy={loading.value} style={{ opacity: loading.value ? 0.5 : 1, transition: "opacity 0.2s" }}>
          <CodeView code={content.value || "/* loading… */"} label={`${format.value} tokens`} maxHeight="560px" />
        </div>
        <p class={css({ fontFamily: "mono", fontSize: "12px", color: "ink-muted", mt: 3 })}>
          $ baste tokens {s.selectedId} --format {format.value}
        </p>
      </section>

      {t && (
        <aside class={css({ display: "flex", flexDirection: "column", gap: 6 })}>
          <section class={panel} aria-labelledby="tok-scale">
            <span class={kicker}>Seam allowances</span>
            <h2 id="tok-scale" class={panelTitle}>Spacing · {t.spacing.density}</h2>
            <ul class={css({ listStyle: "none", display: "flex", flexDirection: "column", gap: 2, mt: 4 })}>
              {Object.entries(t.spacing.scale).filter(([k]) => k !== "0").map(([k, v]) => (
                <li key={k} class={css({ display: "grid", gridTemplateColumns: "22px 1fr 54px", gap: 3, alignItems: "center", fontFamily: "mono", fontSize: "12px" })}>
                  <span class={css({ color: "ink-muted" })}>{k}</span>
                  <span
                    class={css({ h: "8px", rounded: "xs", bg: "thread", minW: "3px" })}
                    style={{ width: `${(parseFloat(v) / Math.max(...Object.values(t.spacing.scale).map((x) => parseFloat(x) || 0))) * 100}%` }}
                  />
                  <span class={css({ textAlign: "right" })}>{v}</span>
                </li>
              ))}
            </ul>
          </section>
          <section class={panel} aria-labelledby="tok-radius">
            <span class={kicker}>Edges</span>
            <h2 id="tok-radius" class={panelTitle}>Radii & shadow</h2>
            <div class={css({ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, mt: 4 })}>
              {(["sm", "base", "lg", "xl"] as const).map((r) => (
                <div key={r} class={css({ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" })}>
                  <span class={css({ w: "56px", h: "56px", border: "2px solid token(colors.ink)", bg: "paper" })} style={{ borderRadius: t.borders.radius[r], boxShadow: t.shadows.lg }} />
                  <span class={css({ fontFamily: "mono", fontSize: "11px", color: "ink-muted" })}>{r} · {t.borders.radius[r]}</span>
                </div>
              ))}
            </div>
          </section>
          <section class={panel} aria-labelledby="tok-motion">
            <span class={kicker}>Hang</span>
            <h2 id="tok-motion" class={panelTitle}>Motion</h2>
            <p class={css({ fontSize: "13px", color: "ink-muted", mt: 1 })}>Hover a row to feel the curve.</p>
            <ul class={css({ listStyle: "none", display: "flex", flexDirection: "column", gap: 3, mt: 3 })}>
              {Object.entries(t.motion.easing).map(([k, curve]) => (
                <li key={k} class={css({ display: "flex", flexDirection: "column", gap: 1, "&:hover .bob": { transform: "translateX(calc(100cqw - 18px))" } })}>
                  <span class={css({ display: "flex", justifyContent: "space-between", fontFamily: "mono", fontSize: "11.5px" })}>
                    <span>{k}</span>
                    <span class={css({ color: "ink-muted" })}>{curve}</span>
                  </span>
                  <span class={css({ position: "relative", h: "18px", rounded: "full", bg: "paper-deep", overflow: "hidden" })} style={{ containerType: "inline-size" }}>
                    <span
                      class={`bob ${css({ position: "absolute", left: 0, top: 0, w: "18px", h: "18px", rounded: "full", bg: "ink" })}`}
                      style={{ transition: `transform ${t.motion.duration.slow} ${curve}` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      )}
    </div>
  );
});
