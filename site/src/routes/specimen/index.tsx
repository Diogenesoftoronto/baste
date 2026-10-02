import { component$, useStore } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { Section, SectionHead } from "~/components/ui/section";
import { AtelierIcon, type AtelierIconName } from "~/components/icons/atelier-icon";
import { Fabric } from "~/components/fx/fabric";
import { LINEN, type FabricLook } from "~/components/fx/fabric-gl";
import { Garment } from "~/components/fitting/garment";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";
import { contrastRatio } from "~/lib/fitting";
import { btn } from "~/components/studio/ui";

const COLORS = [
  { name: "paper", hex: "#F1ECE2", use: "Ground — pattern paper" },
  { name: "card", hex: "#FBF9F4", use: "Fresh sheet, raised surfaces" },
  { name: "muslin", hex: "#E9DFCB", use: "Toile, pinboards" },
  { name: "ink", hex: "#1C1B19", use: "Text, primary actions" },
  { name: "ink-muted", hex: "#6E6A61", use: "Secondary text (4.9:1 on paper)" },
  { name: "thread", hex: "#D2402A", use: "Basting stitch — the signature mark" },
  { name: "thread-ink", hex: "#A9311E", use: "Thread as text, emphasis" },
  { name: "chalk", hex: "#2F55A4", use: "Tailor's chalk — annotation" },
  { name: "tape", hex: "#F0C534", use: "Tape measure, selection" },
  { name: "pin", hex: "#2E7D5B", use: "Success, live" },
  { name: "night", hex: "#191814", use: "Terminal, inverse panels" },
];

const ICONS: AtelierIconName[] = [
  "needle", "thread", "spool", "tape-measure", "button", "scissors", "pin", "ruler", "ruler-pen", "shirt", "hanger",
  "swatch", "palette", "layers", "wand", "sparkle", "pen", "pen-sparkle", "image", "image-sparkle", "video",
  "video-cut", "type", "code", "terminal", "download", "copy", "globe", "shuffle", "grid", "folder", "check", "plus", "arrow-right",
];

const SLIDERS: Array<{ key: keyof FabricLook; label: string; min: number; max: number; step: number }> = [
  { key: "fold", label: "Fold depth", min: 0, max: 1.6, step: 0.05 },
  { key: "weave", label: "Weave relief", min: 0, max: 1, step: 0.05 },
  { key: "thread", label: "Thread width", min: 1, max: 8, step: 0.2 },
  { key: "scale", label: "Folds per screen", min: 0.6, max: 4, step: 0.1 },
  { key: "dye", label: "Dye", min: 0, max: 1, step: 0.05 },
];

export default component$(() => {
  const look = useStore<FabricLook>({ ...LINEN, warp: "#D2402A", weft: "#2F55A4", dye: 0.85, weave: 0.7, thread: 3 });

  return (
    <>
      <Nav />
      <main id="main">
        <header class={css({ maxW: "1240px", mx: "auto", px: { base: 4, md: 8 }, pt: { base: 12, md: 20 }, pb: 12 })}>
          <span class="label" style={{ color: "#A9311E" }}>Pattern book · house style</span>
          <h1 class="display" style={{ fontSize: "clamp(48px, 7vw, 96px)", marginTop: "12px", maxWidth: "14ch" }}>
            The atelier, <em style={{ color: "#A9311E" }}>itemised.</em>
          </h1>
          <p class={css({ fontSize: { base: "17px", md: "19px" }, color: "ink-soft", maxW: "58ch", mt: 5 })}>
            Baste's own clothes are deliberately quiet — paper, ink, thread and chalk — so that every persona's generated
            palette is the loudest thing on the page. This is everything the house style is made of.
          </p>
        </header>

        <Section tone="deep">
          <SectionHead kicker="Type" title="Three hands." lede="A Didone for display, a grotesque for reading, a mono for measurements." />
          <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1.3fr 1fr 1fr" }, gap: 5, mt: 10 })}>
            {([
              ["Display", "Bodoni Moda", "'Bodoni Moda', serif", "Fitted", "Headlines, numerals, persona names. Italic for the one word that matters."],
              ["Text", "Instrument Sans", "'Instrument Sans', sans-serif", "Aa Gg", "Interface and long-form. 14–20px."],
              ["Measure", "IBM Plex Mono", "'IBM Plex Mono', monospace", "#D2402A", "Tokens, slugs, commands, chalk notes."],
            ] as const).map(([role, name, stack, sample, use]) => (
              <article key={role} class={css({ bg: "card", border: "1px solid token(colors.rule)", rounded: "sm", p: 6, display: "flex", flexDirection: "column", gap: 3, boxShadow: "sheet" })} data-reveal>
                <span class="label" style={{ color: "#6E6A61" }}>{role}</span>
                <span style={{ fontFamily: stack, fontSize: role === "Display" ? "84px" : "56px", lineHeight: 1, fontStyle: role === "Display" ? "italic" : undefined }}>{sample}</span>
                <span class={css({ fontWeight: 600 })}>{name}</span>
                <span class={css({ fontSize: "14px", color: "ink-muted" })}>{use}</span>
              </article>
            ))}
          </div>
          <ol class={css({ listStyle: "none", mt: 12, display: "flex", flexDirection: "column" })}>
            {([
              ["display", "clamp(48px,7.4vw,104px)", "Cut to fit one person."],
              ["h2", "clamp(36px,4.6vw,60px)", "Baste first. Cut later."],
              ["h3", "28px", "Many fittings, not one answer."],
              ["lead", "20px", "Generic interfaces fit everyone, so they fit no one."],
              ["body", "16px", "Baste reads films, music, rooms and obsessions as measurements."],
              ["small", "13px", "Same screen, same code — only the fitting changes."],
            ] as const).map(([k, size, text], i) => (
              <li key={k} class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "140px 1fr" }, gap: 4, py: 4, borderBottom: "1px solid token(colors.rule)", alignItems: "baseline" })}>
                <span class={css({ fontFamily: "mono", fontSize: "12px", color: "ink-muted" })}>{k} · {size}</span>
                <span class={i < 3 ? "display" : undefined} style={{ fontSize: size, lineHeight: i < 3 ? 1 : 1.4 }}>{text}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section>
          <SectionHead kicker="Cloth" title="Eleven colours, all of them working." />
          <ul class={css({ listStyle: "none", display: "grid", gridTemplateColumns: { base: "repeat(2, 1fr)", md: "repeat(4, 1fr)", xl: "repeat(6, 1fr)" }, gap: 4, mt: 10 })}>
            {COLORS.map((c, i) => {
              const onInk = contrastRatio(c.hex, "#1C1B19") > contrastRatio(c.hex, "#FBF9F4");
              const cr = contrastRatio(c.hex, "#F1ECE2");
              return (
                <li key={c.name} data-reveal data-reveal-delay={String(i * 40)} class={css({ display: "flex", flexDirection: "column", rounded: "sm", overflow: "hidden", border: "1px solid token(colors.rule)", bg: "card", boxShadow: "sheet" })}>
                  <div class={css({ h: "96px", p: 3, display: "flex", alignItems: "flex-end", fontFamily: "mono", fontSize: "12px" })} style={{ background: c.hex, color: onInk ? "#1C1B19" : "#FBF9F4" }}>
                    {c.hex}
                  </div>
                  <div class={css({ p: 3, display: "flex", flexDirection: "column", gap: 1 })}>
                    <span class={css({ fontWeight: 600, fontSize: "14px" })}>{c.name}</span>
                    <span class={css({ fontSize: "12.5px", color: "ink-muted" })}>{c.use}</span>
                    <span class={css({ fontFamily: "mono", fontSize: "11px", color: "chalk" })}>{cr.toFixed(1)}:1 on paper</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div class={css({ mt: 12, display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr 1fr" }, gap: 6 })}>
            <div class={css({ display: "flex", flexDirection: "column", gap: 3 })}>
              <span class="label" style={{ color: "#6E6A61" }}>Basting stitch</span>
              <div class="stitch-rule" />
              <p class={css({ fontSize: "13px", color: "ink-muted" })}>12px stitch, 8px gap. Section seams, active tabs, progress.</p>
            </div>
            <div class={css({ display: "flex", flexDirection: "column", gap: 3 })}>
              <span class="label" style={{ color: "#6E6A61" }}>Chalk line</span>
              <div class="stitch-rule stitch-rule--chalk" />
              <p class={css({ fontSize: "13px", color: "ink-muted" })}>Annotation leaders and measurement notes.</p>
            </div>
            <div class={css({ display: "flex", flexDirection: "column", gap: 3, position: "relative" })}>
              <span class="label" style={{ color: "#6E6A61" }}>Pin</span>
              <div class={css({ position: "relative", h: "40px" })}><span class="pin-head" style={{ left: "6px", top: "4px" }} /></div>
              <p class={css({ fontSize: "13px", color: "ink-muted" })}>Pinned references, the idle easter egg.</p>
            </div>
          </div>
        </Section>

        <Section tone="deep">
          <SectionHead kicker="Toy garden" title="The cloth shader." lede="The backdrop and every persona swatch is one fragment shader: a plain weave, shot with two yarn colours, draped in breathing folds that gather toward your pointer. Pull the threads." />
          <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "1.5fr 0.5fr" }, gap: 6, mt: 10 })}>
            <div class={`pinked ${css({ h: { base: "320px", md: "460px" }, boxShadow: "lift" })}`}>
              <Fabric look={{ ...look }} quality={0.8} label="Interactive fabric shader" />
            </div>
            <div class={css({ display: "flex", flexDirection: "column", gap: 4, p: 5, bg: "card", rounded: "sm", border: "1px solid token(colors.rule)" })}>
              <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 })}>
                {(["warp", "weft"] as const).map((k) => (
                  <label key={k} class={css({ display: "flex", flexDirection: "column", gap: 1, fontSize: "13px" })}>
                    {k === "warp" ? "Warp yarn" : "Weft yarn"}
                    <input type="color" value={look[k]} onInput$={(_, el) => (look[k] = el.value)} class={css({ w: "100%", h: "38px", border: "1px solid token(colors.rule-strong)", rounded: "base", p: "2px", bg: "card" })} />
                  </label>
                ))}
              </div>
              {SLIDERS.map((sl) => (
                <label key={sl.key} class={css({ display: "flex", flexDirection: "column", gap: 1, fontSize: "13px" })}>
                  <span class={css({ display: "flex", justifyContent: "space-between" })}>
                    {sl.label}
                    <span class={css({ fontFamily: "mono", fontSize: "12px", color: "ink-muted" })}>{Number(look[sl.key]).toFixed(2)}</span>
                  </span>
                  <input type="range" min={sl.min} max={sl.max} step={sl.step} value={look[sl.key] as number} onInput$={(_, el) => ((look as unknown as Record<string, number>)[sl.key] = Number(el.value))} class={css({ accentColor: "#D2402A" })} />
                </label>
              ))}
              <button class={btn("secondary")} onClick$={() => Object.assign(look, { ...LINEN, warp: "#D2402A", weft: "#2F55A4", dye: 0.85, weave: 0.7, thread: 3 })}>Reset</button>
              <a href="/materials/" class={btn("ghost")}>Explore the material room →</a>
            </div>
          </div>
        </Section>

        <Section>
          <SectionHead kicker="Notions" title="Icons." lede="Reicon outlines (MIT) for the everyday set; tailoring glyphs drawn to match where Reicon had none." />
          <ul class={css({ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 3, mt: 10 })}>
            {ICONS.map((n) => (
              <li key={n} class={css({ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 4, rounded: "sm", bg: "card", border: "1px solid token(colors.rule)", transition: "transform 0.3s token(easings.thread), color 0.2s", _hover: { transform: "translateY(-3px) rotate(-2deg)", color: "thread-ink" } })}>
                <AtelierIcon name={n} size={28} />
                <span class={css({ fontFamily: "mono", fontSize: "11px", color: "ink-muted" })}>{n}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section tone="deep">
          <SectionHead kicker="Proof" title="The same pattern, three fittings." lede="One component, cut three times from three personas' generated tokens." />
          <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "repeat(3, 1fr)" }, gap: 6, mt: 10 })}>
            {DEMO_PERSONAS.map((p, i) => (
              <div key={p.id} data-reveal="sheet" data-reveal-delay={String(i * 120)} class={css({ display: "flex", flexDirection: "column", gap: 3 })}>
                <span class="label" style={{ color: "#6E6A61" }}>{p.name}</span>
                <Garment persona={p} tokens={DEMO_TOKENS[p.id]} size="compact" />
              </div>
            ))}
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
});

export const head: DocumentHead = {
  title: "Pattern book — Baste",
  meta: [{ name: "description", content: "Baste's house style: type, colour, stitch, icons and the cloth shader." }],
};
