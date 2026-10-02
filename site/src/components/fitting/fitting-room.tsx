import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import type { DesignTokens, PersonaRecord } from "~/lib/api-types";
import { primaryFamily } from "~/lib/fonts";
import { Fabric, lookFromTokens } from "~/components/fx/fabric";
import { Garment } from "./garment";

interface FittingRoomProps {
  personas: PersonaRecord[];
  tokens: Record<string, DesignTokens>;
  /** Auto-advance between personas until the visitor picks one. */
  autoplay?: boolean;
}

/**
 * One interface pattern, fitted live to each persona. The garment is pinned
 * to a bolt of cloth dyed in that persona's colours; chalk notes call out the
 * measurements that changed so the difference reads as a decision.
 */
export const FittingRoom = component$<FittingRoomProps>(({ personas, tokens, autoplay = true }) => {
  const index = useSignal(0);
  const touched = useSignal(false);
  const stage = useSignal<HTMLDivElement>();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (autoplay && !reduced) {
      const id = setInterval(() => {
        if (!touched.value) index.value = (index.value + 1) % personas.length;
      }, 5600);
      cleanup(() => clearInterval(id));
    }
    // pointer tilt: the pinned garment leans toward the cursor
    const el = stage.value;
    if (!el || reduced || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--tilt-x", `${(-y * 5).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${(x * 7).toFixed(2)}deg`);
        el.style.setProperty("--shift-x", `${(x * -14).toFixed(1)}px`);
        el.style.setProperty("--shift-y", `${(y * -10).toFixed(1)}px`);
      });
    };
    const onLeave = () => {
      for (const p of ["--tilt-x", "--tilt-y", "--shift-x", "--shift-y"]) el.style.setProperty(p, "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    cleanup(() => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    });
  });

  const pick = $((i: number) => {
    touched.value = true;
    index.value = i;
  });

  const persona = personas[index.value];
  const t = tokens[persona.id];
  const a = persona.aesthetic;

  const notes = [
    { k: "display face", v: primaryFamily(t.typography.fontFamily.heading) },
    { k: "primary", v: t.colors.primary.toUpperCase(), swatch: t.colors.primary },
    { k: "ground", v: t.colors.background.toUpperCase(), swatch: t.colors.background },
    { k: "radius", v: `${t.borders.radius.base} · ${a.edgeStyle}` },
    { k: "density", v: a.density },
    { k: "motion", v: `${t.motion.duration.base} · ${a.motionStyle}` },
  ];

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 6 })}>
      {/* Garment tags — persona switcher */}
      <div role="tablist" aria-label="Fit for persona" class={css({ display: "flex", gap: 2, flexWrap: "wrap" })}>
        {personas.map((p, i) => {
          const pt = tokens[p.id];
          const selected = i === index.value;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={selected}
              aria-controls="fitting-panel"
              onClick$={() => pick(i)}
              class={css({
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                pl: 2,
                pr: 3,
                h: "36px",
                rounded: "base",
                border: "1px solid",
                borderColor: "rule",
                bg: "card",
                fontSize: "13px",
                color: "ink-soft",
                boxShadow: "sheet",
                transition: "all 0.25s token(easings.thread)",
                _hover: { borderColor: "rule-strong", color: "ink", transform: "translateY(-1px)" },
                "&[aria-selected=true], &[aria-selected=true]:hover": { bg: "ink", color: "paper", borderColor: "ink" },
              })}
            >
              <span class={css({ display: "flex" })} aria-hidden="true">
                {[pt.colors.primary, pt.colors.secondary, pt.colors.background].map((c, j) => (
                  <i
                    key={j}
                    class={css({ w: "12px", h: "12px", rounded: "full", border: "1.5px solid", ml: j ? "-4px" : 0 })}
                    style={{ background: c, borderColor: selected ? "#1C1B19" : "#FBF9F4" }}
                  />
                ))}
              </span>
              {p.name.replace(/^The /, "")}
              {selected && !touched.value && (
                <span
                  aria-hidden="true"
                  class={css({ position: "absolute", left: "8px", right: "8px", bottom: "-1px", h: "2px", bg: "tape", transformOrigin: "left", animation: "tag-timer 5.6s linear" })}
                />
              )}
            </button>
          );
        })}
      </div>

      <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "1fr 150px" }, gap: { base: 6, lg: 6 }, alignItems: "center" })}>
        {/* Stage: bolt of dyed cloth with the garment pinned on top */}
        <div ref={stage} class={css({ position: "relative", perspective: "1600px", py: { base: 6, md: 10 }, px: { base: 3, md: 8 } })}>
          <div
            aria-hidden="true"
            class={css({ position: "absolute", inset: 0, filter: "drop-shadow(0 18px 28px rgba(60,45,20,0.28)) drop-shadow(0 2px 2px rgba(28,27,25,0.12))" })}
            style={{ transform: "rotate(-1.6deg) translate(var(--shift-x, 0), var(--shift-y, 0))", transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)" }}
          >
            <div class={`pinked ${css({ position: "absolute", inset: 0 })}`}>
              <Fabric look={lookFromTokens(t, a.density)} quality={0.75} label={`${persona.name} cloth`} />
            </div>
          </div>

          <div
            id="fitting-panel"
            role="tabpanel"
            aria-live="polite"
            class={css({ position: "relative", transformStyle: "preserve-3d", transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)" })}
            style={{
              transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateZ(30px)",
              borderRadius: t.borders.radius.xl,
              boxShadow: "0 30px 60px -24px rgba(20,14,6,0.55), 0 2px 4px rgba(20,14,6,0.2)",
            }}
          >
            <span class="pin-head" style={{ left: "-6px", top: "-6px" }} aria-hidden="true" />
            <span class="pin-head" style={{ right: "18px", top: "-7px" }} aria-hidden="true" />
            <Garment persona={persona} tokens={t} />
          </div>
        </div>

        {/* Chalk notes */}
        <dl
          aria-label={`Measurements for ${persona.name}`}
          class={css({
            display: "grid",
            gridTemplateColumns: { base: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "1fr" },
            gap: { base: 3, lg: 4 },
            fontFamily: "mono",
            fontSize: "12px",
            color: "chalk",
          })}
        >
          {notes.map((n) => (
            <div key={n.k} class={css({ display: "flex", flexDirection: "column", gap: "2px", pl: 3, borderLeft: "1.5px dashed token(colors.chalk)" })}>
              <dt class={css({ fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase" })}>{n.k}</dt>
              <dd class={css({ display: "flex", alignItems: "center", gap: 2, color: "ink", fontWeight: 500 })}>
                {n.swatch && (
                  <i class={css({ w: "12px", h: "12px", rounded: "xs", border: "1px solid token(colors.rule-strong)", flexShrink: 0 })} style={{ background: n.swatch }} />
                )}
                {n.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
});
