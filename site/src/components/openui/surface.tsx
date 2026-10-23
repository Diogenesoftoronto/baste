import { component$, createContextId, useContext, useId, type QRL } from "@builder.io/qwik";
import { css, cx } from "styled-system/css";
import type { ElementNode, ReactiveAssign } from "@openuidev/lang-core";
import type { DesignTokens, Persona } from "~/lib/api-types";
import { contrastRatio, onColor } from "~/lib/fitting";
import { FONT_FAMILIES } from "~/lib/openui/catalog";
import { boundValue, isBinding } from "~/lib/openui/runtime";
import type { ProjectDesign } from "~/lib/projects";
import type { DesignEdge } from "~/lib/project-contracts";
import { Garment } from "~/components/fitting/garment";
import { act, btnSm, fieldLabel, hint, input, kicker } from "~/components/studio/ui";

/**
 * Qwik renderers for Baste's OpenUI catalog (lib/openui/catalog.ts).
 *
 * The runtime evaluates a program to plain JSON; these components draw it and
 * hand interactions back through SurfaceCtx, so nothing here holds parser or
 * query state. Generated text is always rendered as text.
 */

export interface SurfaceContext {
  assign$: QRL<(binding: ReactiveAssign, value: unknown) => void>;
  run$: QRL<(action: unknown, label: string) => void>;
  /** True while a surface streams in; controls wait for the finished program. */
  locked: boolean;
  design: ProjectDesign;
  persona: Persona;
}

export const SurfaceCtx = createContextId<SurfaceContext>("baste.openui.surface");

type Props = Record<string, unknown>;
const str = (value: unknown, fallback = "") => typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
const isHex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
/** Where a `$binding` prop writes, without its current value, so handlers capture only plain data. */
const target = (value: unknown): ReactiveAssign | null => isBinding(value) ? { __reactive: "assign", target: value.target, expr: value.expr } : null;
const isElement = (value: unknown): value is ElementNode => !!value && typeof value === "object" && (value as ElementNode).type === "element";

/** The saved tokens with a preview's values laid over them, the way the engine applies them. */
export function previewTokens(design: ProjectDesign, props: Props): DesignTokens {
  const t = design.tokens;
  const colors = Object.fromEntries(Object.entries((props.colors ?? {}) as Record<string, unknown>).filter(([, v]) => isHex(v)));
  const heading = str(props.headingFont);
  const body = str(props.bodyFont);
  const edges = str(props.edges) as DesignEdge;
  return {
    ...t,
    colors: { ...t.colors, ...colors },
    typography: { ...t.typography, fontFamily: { ...t.typography.fontFamily, ...(design.options.fonts[heading] ? { heading: design.options.fonts[heading] } : {}), ...(design.options.fonts[body] ? { body: design.options.fonts[body] } : {}) } },
    borders: design.options.edges[edges] ? { ...t.borders, radius: design.options.edges[edges] } : t.borders,
  };
}

const wide = css({ gridColumn: "1 / -1" });
const block = css({ minW: 0, display: "flex", flexDirection: "column", gap: 3 });
const caption = css({ fontSize: "12.5px", color: "ink-muted", lineHeight: 1.45 });

/** Draw any value the runtime produced: elements, lists or plain text. */
export const SurfaceNode = component$<{ node: unknown }>(({ node }) => {
  if (node == null || node === false) return null;
  if (Array.isArray(node)) return <>{node.map((item, i) => <SurfaceNode key={i} node={item} />)}</>;
  if (!isElement(node)) return typeof node === "object" ? null : <>{String(node)}</>;
  const p = node.props as Props;
  switch (node.typeName) {
    case "Workbench": return <Workbench p={p} />;
    case "Section": return <Section p={p} />;
    case "Note": return <Note p={p} />;
    case "Preview": return <Preview p={p} />;
    case "ColorField": return <ColorField p={p} />;
    case "FontField": return <FontField p={p} />;
    case "EdgeField": return <EdgeField p={p} />;
    case "Choice": return <Choice p={p} />;
    case "Palette": return <Palette p={p} />;
    case "Swatch": return <Swatch p={p} />;
    case "Contrast": return <Contrast p={p} />;
    case "Compare": return <Compare p={p} />;
    case "Variant": return <Variant p={p} />;
    case "Question": return <Question p={p} />;
    case "Buttons": return <Buttons p={p} />;
    case "Button": return <Button p={p} />;
    case "SaveStatus": return <SaveStatus p={p} />;
    default: return null;
  }
});

const Workbench = component$<{ p: Props }>(({ p }) => (
  <section class={css({ display: "flex", flexDirection: "column", gap: 4 })} aria-label={str(p.title, "Design surface")}>
    {str(p.title) && <h3 class={css({ fontFamily: "display", fontSize: "20px", fontWeight: 500, lineHeight: 1.15, overflowWrap: "anywhere" })}>{str(p.title)}</h3>}
    <div class={css({ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 248px), 1fr))", gap: 4, alignItems: "start" })}>
      {((p.children ?? []) as unknown[]).map((child, i) => {
        const full = isElement(child) && ["Preview", "Compare", "Question", "Note", "Buttons", "SaveStatus"].includes(child.typeName);
        return <div key={i} class={cx(block, full && wide)}><SurfaceNode node={child} /></div>;
      })}
    </div>
  </section>
));

const Section = component$<{ p: Props }>(({ p }) => (
  <fieldset class={css({ minW: 0, border: "1px solid token(colors.rule)", rounded: "base", p: 4, display: "flex", flexDirection: "column", gap: 4, bg: "card" })}>
    <legend class={cx(kicker, css({ px: 1 }))}>{str(p.title)}</legend>
    <SurfaceNode node={p.children} />
  </fieldset>
));

const Note = component$<{ p: Props }>(({ p }) => {
  const tone = str(p.tone, "plain");
  return (
    <p role={tone === "warning" ? "note" : undefined} class={css({
      fontSize: "14px", lineHeight: 1.55, color: "ink-soft", overflowWrap: "anywhere", maxW: "68ch",
      "&[data-tone=aside]": { fontStyle: "italic", color: "ink-muted" },
      "&[data-tone=warning]": { borderLeft: "2px solid token(colors.thread-ink)", pl: 3, color: "ink" },
    })} data-tone={tone}>{str(p.text)}</p>
  );
});

const Preview = component$<{ p: Props }>(({ p }) => {
  const ctx = useContext(SurfaceCtx);
  return (
    <figure class={css({ display: "flex", flexDirection: "column", gap: 2 })}>
      <div class={css({ pointerEvents: "none" })} aria-hidden="true">
        <Garment persona={ctx.persona} tokens={previewTokens(ctx.design, p)} size="compact" />
      </div>
      <figcaption class={caption}>{str(p.caption, "A preview with these values. Nothing here is saved yet.")}</figcaption>
    </figure>
  );
});

const ColorField = component$<{ p: Props }>(({ p }) => {
  const ctx = useContext(SurfaceCtx);
  const id = useId();
  const value = boundValue(p.value, "#000000");
  const binding = target(p.value);
  return (
    <div>
      <label class={fieldLabel} for={id}>{str(p.label)}</label>
      <div class={css({ display: "flex", gap: 2, alignItems: "center" })}>
        <input type="color" id={id} value={isHex(value) ? value.toLowerCase() : "#000000"} disabled={!binding || ctx.locked}
          class={css({ w: "44px", h: "38px", p: "2px", rounded: "base", border: "1px solid token(colors.rule-strong)", bg: "card", flexShrink: 0 })}
          onInput$={(_, el) => binding && ctx.assign$(binding, el.value)} />
        <input class={cx(input, css({ fontFamily: "mono", fontSize: "13px" }))} aria-label={`${str(p.label)} hex value`} value={str(value)} maxLength={7} spellcheck={false} disabled={!binding || ctx.locked}
          onChange$={(_, el) => { const next = el.value.trim(); if (binding && /^#?[0-9a-f]{6}$/i.test(next)) ctx.assign$(binding, `#${next.replace("#", "").toLowerCase()}`); else el.value = str(value); }} />
      </div>
      {str(p.hint) && <p class={hint}>{str(p.hint)}</p>}
    </div>
  );
});

const FontField = component$<{ p: Props }>(({ p }) => {
  const ctx = useContext(SurfaceCtx);
  const id = useId();
  const value = str(boundValue(p.value, ""));
  const binding = target(p.value);
  return (
    <div>
      <label class={fieldLabel} for={id}>{str(p.label)}</label>
      <select id={id} class={input} value={value} disabled={!binding || ctx.locked} onChange$={(_, el) => binding && ctx.assign$(binding, el.value)}>
        {FONT_FAMILIES.map((family) => <option key={family} value={family}>{family}</option>)}
      </select>
      <p class={css({ mt: 2, fontSize: "22px", lineHeight: 1.2, color: "ink", overflowWrap: "anywhere" })} style={{ fontFamily: ctx.design.options.fonts[value] }}>{str(p.sample, "The quick brown fox")}</p>
    </div>
  );
});

const EDGE_LABELS: Record<DesignEdge, string> = { sharp: "Sharp", soft: "Soft", organic: "Organic", geometric: "Geometric", brutalist: "Brutalist" };

const EdgeField = component$<{ p: Props }>(({ p }) => {
  const ctx = useContext(SurfaceCtx);
  const binding = target(p.value);
  const value = str(boundValue(p.value, ""));
  return (
    <div role="radiogroup" aria-label={str(p.label)}>
      <span class={fieldLabel} aria-hidden="true">{str(p.label)}</span>
      <div class={css({ display: "flex", flexWrap: "wrap", gap: 2 })}>
        {(Object.keys(EDGE_LABELS) as DesignEdge[]).map((edge) => (
          <button key={edge} type="button" role="radio" aria-checked={value === edge} disabled={!binding || ctx.locked}
            class={act("pin", cx(btnSm, css({ gap: 2 })))} aria-pressed={value === edge}
            onClick$={() => binding && ctx.assign$(binding, edge)}>
            <i aria-hidden="true" class={css({ w: "14px", h: "14px", borderTop: "2px solid currentColor", borderLeft: "2px solid currentColor" })} style={{ borderTopLeftRadius: ctx.design.options.edges[edge]?.lg ?? "0" }} />
            {EDGE_LABELS[edge]}
          </button>
        ))}
      </div>
    </div>
  );
});

const Choice = component$<{ p: Props }>(({ p }) => {
  const ctx = useContext(SurfaceCtx);
  const binding = target(p.value);
  const value = str(boundValue(p.value, ""));
  return (
    <div role="radiogroup" aria-label={str(p.label)}>
      <span class={fieldLabel} aria-hidden="true">{str(p.label)}</span>
      <div class={css({ display: "flex", flexDirection: "column", gap: 2 })}>
        {((p.options ?? []) as ElementNode[]).filter(isElement).map((option) => {
          const o = option.props as Props;
          const selected = value === str(o.value);
          return (
            <button key={str(o.value)} type="button" role="radio" aria-checked={selected} aria-pressed={selected} disabled={!binding || ctx.locked}
              class={act("pin", css({ h: "auto", py: 2, justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal", flexDirection: "column", alignItems: "flex-start", gap: 1 }))}
              onClick$={() => binding && ctx.assign$(binding, str(o.value))}>
              <span>{str(o.label)}</span>
              {str(o.detail) && <span class={css({ fontWeight: 400, fontSize: "12.5px", color: "ink-muted" })}>{str(o.detail)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
});

const Swatch = component$<{ p: Props }>(({ p }) => (
  <span class={css({ display: "flex", flexDirection: "column", gap: 1, minW: 0 })}>
    <i class={css({ display: "block", h: "40px", rounded: "base", border: "1px solid token(colors.rule)" })} style={{ background: isHex(p.color) ? p.color : "transparent" }} />
    <span class={css({ fontSize: "12px", overflowWrap: "anywhere" })}>{str(p.label)}</span>
    <span class={css({ fontFamily: "mono", fontSize: "10.5px", color: "ink-muted" })}>{str(p.color).toUpperCase()}</span>
  </span>
));

const Palette = component$<{ p: Props }>(({ p }) => (
  <figure class={css({ display: "flex", flexDirection: "column", gap: 2 })}>
    <div role="list" class={css({ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 2 })}>
      {((p.swatches ?? []) as unknown[]).map((swatch, i) => <span role="listitem" key={i}><SurfaceNode node={swatch} /></span>)}
    </div>
    {str(p.caption) && <figcaption class={caption}>{str(p.caption)}</figcaption>}
  </figure>
));

const Contrast = component$<{ p: Props }>(({ p }) => {
  const fg = p.foreground, bg = p.background;
  if (!isHex(fg) || !isHex(bg)) return <p class={caption}>{str(p.label)}: waiting for two colours.</p>;
  const ratio = contrastRatio(fg, bg);
  const level = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "Large text only" : "Too faint";
  return (
    <div class={css({ display: "flex", alignItems: "center", gap: 3 })}>
      <span aria-hidden="true" class={css({ w: "44px", h: "44px", rounded: "base", display: "grid", placeItems: "center", fontWeight: 700, border: "1px solid token(colors.rule)", flexShrink: 0 })} style={{ background: bg, color: fg }}>Aa</span>
      <span class={css({ minW: 0 })}>
        <span class={css({ display: "block", fontSize: "13.5px", overflowWrap: "anywhere" })}>{str(p.label)}</span>
        <span class={css({ display: "block", fontFamily: "mono", fontSize: "12px", color: ratio < 4.5 ? "thread-ink" : "ink-muted" })}>{ratio.toFixed(2)}:1 · {level}</span>
      </span>
    </div>
  );
});

const Compare = component$<{ p: Props }>(({ p }) => (
  <figure class={css({ display: "flex", flexDirection: "column", gap: 2 })}>
    <div class={css({ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 3 })}>
      <SurfaceNode node={p.variants} />
    </div>
    {str(p.caption) && <figcaption class={caption}>{str(p.caption)}</figcaption>}
  </figure>
));

const Variant = component$<{ p: Props }>(({ p }) => {
  const ctx = useContext(SurfaceCtx);
  const t = previewTokens(ctx.design, p);
  const c = t.colors;
  return (
    <article class={css({ border: "1px solid token(colors.rule)", rounded: "base", overflow: "hidden", display: "flex", flexDirection: "column", bg: "card" })}>
      <div aria-hidden="true" class={css({ p: 4, display: "flex", flexDirection: "column", gap: 2, minH: "128px" })} style={{ background: c.background, color: c.text, fontFamily: t.typography.fontFamily.body }}>
        <span style={{ fontFamily: t.typography.fontFamily.heading, fontSize: "20px", lineHeight: 1.15, color: c.text }}>{str(p.name)}</span>
        <span style={{ fontSize: "12.5px", color: c.textMuted }}>A line of body text in this treatment.</span>
        <span class={css({ display: "flex", gap: 2, mt: "auto" })}>
          <i class={css({ px: 3, py: 1, fontStyle: "normal", fontSize: "12px", fontWeight: 600 })} style={{ background: c.primary, color: onColor(c.primary), borderRadius: t.borders.radius.base }}>Primary</i>
          <i class={css({ px: 3, py: 1, fontStyle: "normal", fontSize: "12px" })} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: t.borders.radius.base }}>Surface</i>
          <i class={css({ w: "22px", h: "22px", rounded: "full" })} style={{ background: c.accent }} />
        </span>
      </div>
      <div class={css({ p: 3, display: "flex", flexDirection: "column", gap: 2, flex: 1 })}>
        <h4 class={css({ fontSize: "14px", fontWeight: 600, overflowWrap: "anywhere" })}>{str(p.name)}</h4>
        <p class={css({ fontSize: "13px", color: "ink-soft", lineHeight: 1.5, overflowWrap: "anywhere" })}>{str(p.note)}</p>
        {p.action != null && <button type="button" class={act("baste", cx(btnSm, css({ alignSelf: "flex-start", mt: "auto" })))} disabled={ctx.locked} onClick$={() => ctx.run$(p.action, str(p.name))}>Try {str(p.name)}</button>}
      </div>
    </article>
  );
});

const Question = component$<{ p: Props }>(({ p }) => (
  <div class={css({ p: 4, bg: "paper-deep", rounded: "base", display: "flex", flexDirection: "column", gap: 3 })}>
    <p class={css({ fontFamily: "display", fontSize: "18px", lineHeight: 1.25, overflowWrap: "anywhere" })}>{str(p.text)}</p>
    <div class={css({ display: "flex", flexWrap: "wrap", gap: 2 })}><SurfaceNode node={p.answers} /></div>
  </div>
));

const Buttons = component$<{ p: Props }>(({ p }) => (
  <div class={css({ display: "flex", flexWrap: "wrap", gap: 2 })}><SurfaceNode node={p.buttons} /></div>
));

const Button = component$<{ p: Props }>(({ p }) => {
  const ctx = useContext(SurfaceCtx);
  const label = str(p.label);
  return (
    <button type="button" class={act(p.emphasis === "primary" ? "cut" : "baste")} disabled={ctx.locked} onClick$={() => ctx.run$(p.action ?? null, label)}>{label}</button>
  );
});

const SaveStatus = component$<{ p: Props }>(({ p }) => {
  const result = (p.result && typeof p.result === "object" ? p.result : null) as { status?: string; data?: { revision?: number; summary?: string }; error?: unknown } | null;
  const status = result?.status ?? "idle";
  const message = status === "loading" ? "Saving…"
    : status === "success" ? `Saved as version ${result?.data?.revision ?? "?"}${result?.data?.summary ? ` · ${result.data.summary}` : ""}`
    : status === "error" ? str(result?.error, "The design was not saved.")
    : str(p.idle, "Nothing is saved until you choose to.");
  return <p role={status === "error" ? "alert" : "status"} aria-live="polite" data-status={status} class={css({ fontSize: "13px", color: "ink-muted", "&[data-status=success]": { color: "ink" }, "&[data-status=error]": { color: "thread-ink" } })}>{message}</p>;
});
