import { useLocale } from '~/i18n/provider';
import { text } from '~/i18n/runtime';
import { component$, useContext, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, loadTokens, toast } from "../context";
import { btn, btnSm, hint, input, kicker, panel, panelTitle } from "../ui";
import type { OpenPencilDoc } from "~/lib/api-types";

/** The persona's tokens as an editable OpenPencil document. */
export const EditorTab = component$(() => {
  const s = useContext(StudioCtx);
  const locale = useLocale();
  const doc = useSignal<OpenPencilDoc | null>(null);
  const saving = useSignal(false);
  const watching = useSignal(false);
  const filePath = useSignal("");
  const filter = useSignal("");

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    const id = track(() => s.selectedId);
    if (!s.client) return;
    try {
      doc.value = await s.client.getOpenPencil(id);
    } catch (err) {
      doc.value = null;
      toast(s, errMsg(err), "error");
    }
  });

  if (!doc.value) return <div aria-busy="true" class={css({ h: "300px", rounded: "lg", bg: "paper-deep", opacity: 0.5 })} />;

  const d = doc.value;
  const groups = new Map<string, typeof d.tokens>();
  for (const t of d.tokens) {
    if (filter.value && !`${t.name} ${t.value}`.toLowerCase().includes(filter.value.toLowerCase())) continue;
    const list = groups.get(t.category) ?? [];
    list.push(t);
    groups.set(t.category, list);
  }
  const custom = s.personas.find((p) => p.id === s.selectedId)?._source === "custom";
  const hosted = s.account.status?.configured === true;

  return (
    <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "minmax(0, 1.3fr) minmax(300px, 0.7fr)" }, gap: 6, alignItems: "start" })}>
      <section class={panel} aria-labelledby="op-title">
        <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 3, flexWrap: "wrap", mb: 4 })}>
          <div>
            <span class={kicker}>OpenPencil · v{d.version}</span>
            <h2 id="op-title" class={panelTitle}>{text(locale.value, "{count} editable tokens", { count: d.tokens.length })}</h2>
          </div>
          <input class={input} style={{ maxWidth: "220px" }} aria-label={text(locale.value, "Filter tokens")} placeholder={text(locale.value, "Filter…")} bind:value={filter} />
        </div>
        {[...groups.entries()].map(([cat, list]) => (
          <fieldset key={cat} class={css({ border: 0, p: 0, mb: 5 })}>
            <legend class={css({ fontFamily: "mono", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "chalk", mb: 2 })}>{cat}</legend>
            <div class={css({ display: "flex", flexDirection: "column", gap: 1 })}>
              {list.map((t) => {
                const isColor = t.type === "color" && /^#[0-9a-f]{3,8}$/i.test(t.value);
                return (
                  <label key={t.id} class={css({ display: "grid", gridTemplateColumns: "minmax(120px, 0.8fr) 1fr", gap: 3, alignItems: "center", py: 1 })}>
                    <span class={css({ fontSize: "13px" })}>
                      {t.name}
                      {t.description && <span class={css({ display: "block", fontSize: "11.5px", color: "ink-muted" })}>{t.description}</span>}
                    </span>
                    <span class={css({ display: "flex", gap: 2, alignItems: "center" })}>
                      {isColor && (
                        <input
                          type="color"
                          aria-label={text(locale.value, "{name} colour", { name: t.name })}
                          value={t.value.slice(0, 7)}
                          onInput$={(_, el) => {
                            doc.value = { ...d, tokens: d.tokens.map((x) => (x.id === t.id ? { ...x, value: el.value } : x)) };
                          }}
                          class={css({ w: "38px", h: "34px", p: "2px", border: "1px solid token(colors.rule-strong)", rounded: "base", bg: "card", flexShrink: 0 })}
                        />
                      )}
                      <input
                        class={`${input} ${css({ fontFamily: "mono", fontSize: "12.5px", h: "34px" })}`}
                        aria-label={t.name}
                        value={t.value}
                        onChange$={(_, el) => {
                          doc.value = { ...d, tokens: d.tokens.map((x) => (x.id === t.id ? { ...x, value: el.value } : x)) };
                        }}
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </section>

      <aside class={css({ display: "flex", flexDirection: "column", gap: 6 })}>
        <section class={panel} aria-labelledby="op-save">
          <h2 id="op-save" class={panelTitle}>{text(locale.value, "Save & sync")}</h2>
          <p class={hint}>
            {custom ? text(locale.value, "Saving writes these tokens back onto the persona.") : text(locale.value, "Base personas are read-only — saving writes a document you can open in OpenPencil.")}
          </p>
          <div class={css({ display: "flex", flexDirection: "column", gap: 2, mt: 4 })}>
            <button
              class={btn("primary")}
              data-juice="snip"
              disabled={saving.value}
              onClick$={async () => {
                saving.value = true;
                try {
                  await s.client!.saveOpenPencil(s.selectedId, doc.value!);
                  await loadTokens(s, s.selectedId, true);
                  toast(s, text(locale.value, "Document saved"));
                } catch (err) {
                  toast(s, errMsg(err), "error");
                } finally {
                  saving.value = false;
                }
              }}
            >
              {saving.value ? text(locale.value, "Saving…") : text(locale.value, "Save document")}
            </button>
            <button
              class={btn("secondary")}
              disabled={hosted}
              onClick$={async () => {
                try {
                  const r = await s.client!.writeOpenPencilFile(s.selectedId);
                  filePath.value = r.path;
                  watching.value = r.watching;
                  toast(s, text(locale.value, "Written to {path}", { path: r.path }));
                } catch (err) {
                  toast(s, errMsg(err), "error");
                }
              }}
            >{text(locale.value, "Write .op file")}</button>
            <button
              class={btn("ghost", btnSm)}
              disabled={hosted}
              aria-pressed={watching.value}
              onClick$={async () => {
                try {
                  const r = await s.client!.toggleOpenPencilWatch(s.selectedId, !watching.value);
                  watching.value = r.watching;
                  if (r.path) filePath.value = r.path;
                  toast(s, r.watching ? text(locale.value, "Watching for edits from OpenPencil") : text(locale.value, "Stopped watching"));
                } catch (err) {
                  toast(s, errMsg(err), "error");
                }
              }}
            >
              <i aria-hidden="true" class={css({ w: "8px", h: "8px", rounded: "full" })} style={{ background: watching.value ? "#2E7D5B" : "#A79E8D" }} />
              {watching.value ? text(locale.value, "Watching file") : text(locale.value, "Watch file for changes")}
            </button>
            {filePath.value && <p class={css({ fontFamily: "mono", fontSize: "11.5px", color: "ink-muted", wordBreak: "break-all" })}>{filePath.value}</p>}
            {hosted && <p class={hint}>{text(locale.value, "Document saving is available for your account. Native file export and watching require a local Baste server.")}</p>}
          </div>
        </section>
        {d.culturalContext?.rationale && (
          <section class={panel} aria-labelledby="op-why">
            <h2 id="op-why" class={panelTitle}>{text(locale.value, "Rationale")}</h2>
            <p class={css({ fontSize: "13.5px", color: "ink-soft", mt: 2, lineHeight: 1.6 })}>{d.culturalContext.rationale}</p>
          </section>
        )}
        <a href="https://openpencil.app" target="_blank" rel="noopener" class={btn("ghost", btnSm)}>{text(locale.value, "Open OpenPencil ↗")}</a>
      </aside>
    </div>
  );
});
