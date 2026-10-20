import { useLocale } from "~/i18n/provider";
import { text } from "~/i18n/runtime";
import { component$, $ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { kicker, panel, panelTitle } from "../ui";
import type { DesignTokens, MotionMoment, MotionPrimitive } from "~/lib/api-types";

const MOMENTS: MotionMoment[] = ["enter", "exit", "hover", "press", "emphasis", "ambient"];

/** A curve's value, short enough for a row: springs show their physics, not their 40 stops. */
function curveLabel(t: DesignTokens, curve: string): string {
  if (curve.startsWith("linear(")) return `spring ${t.motion.spring.stiffness}/${t.motion.spring.damping}`;
  return curve.replace(/^cubic-bezier/, "bezier");
}

/** 850ms stays in milliseconds; a 9000ms loop reads as 9s. */
const seconds = (duration: string) => (parseFloat(duration) >= 1000 ? `${parseFloat(duration) / 1000}s` : duration);

/** Play one move on its swatch with the Web Animations API, as exported. */
const play = $((chip: HTMLElement, p: MotionPrimitive) => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frames = reduced ? p.reduced : p.keyframes;
  if (!frames) return;
  chip.getAnimations().forEach((a) => a.cancel());
  const pointerState = p.trigger === "hover" || p.trigger === "press";
  const loop = p.iterations === "infinite";
  chip.animate(frames as Keyframe[], {
    duration: parseFloat(p.duration),
    easing: reduced ? "linear" : p.easing,
    // Pointer states go there and back; a loop plays one cycle, or one round trip.
    iterations: pointerState || (loop && p.direction === "alternate") ? 2 : 1,
    direction: pointerState ? "alternate" : p.direction,
    fill: "none",
  });
});

export const MotionPanel = component$<{ t: DesignTokens }>(({ t }) => {
  const locale = useLocale();
  const m = t.motion;
  // Tokens from an older server carry only durations and easings.
  const named: Array<[string, string]> = m.curves
    ? [["standard", m.curves.standard], ["enter", m.curves.enter], ["exit", m.curves.exit], ["emphasis", m.curves.emphasis], ["spring", m.spring.easing]]
    : Object.entries(m.easing);
  // Where emphasis is the spring, show one row for both.
  const curves = named.reduce<Array<[string, string]>>((rows, [name, curve]) => {
    const same = rows.find(([, existing]) => existing === curve);
    if (same) same[0] = `${same[0]} · ${name}`;
    else rows.push([name, curve]);
    return rows;
  }, []);

  return (
    <section class={panel} aria-labelledby="tok-motion">
      <span class={kicker}>{text(locale.value, "Hang")}</span>
      <h2 id="tok-motion" class={panelTitle}>{text(locale.value, "Motion")}</h2>
      {m.character && <p class={css({ fontSize: "14px", color: "ink-soft", mt: 2, lineHeight: 1.45, textWrap: "pretty" })}>{m.character}</p>}

      <h3 class={css({ fontFamily: "mono", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "ink-muted", mt: 5 })}>Curves</h3>
      <p class={css({ fontSize: "12.5px", color: "ink-muted", mt: 1 })}>{text(locale.value, "Hover a row to feel the curve.")}</p>
      <ul class={css({ listStyle: "none", display: "flex", flexDirection: "column", gap: 3, mt: 3 })}>
        {curves.map(([k, curve]) => (
          <li key={k} class={css({ display: "flex", flexDirection: "column", gap: 1, "&:hover .bob": { transform: "translateX(calc(100cqw - 18px))" } })}>
            <span class={css({ display: "flex", justifyContent: "space-between", gap: 3, fontFamily: "mono", fontSize: "11.5px" })}>
              <span>{k}</span>
              <span class={css({ color: "ink-muted", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })} title={curve}>{curveLabel(t, curve)}</span>
            </span>
            <span class={css({ position: "relative", h: "18px", rounded: "full", bg: "paper-deep", overflow: "hidden" })} style={{ containerType: "inline-size" }}>
              <span
                class={`bob ${css({ position: "absolute", left: 0, top: 0, w: "18px", h: "18px", rounded: "full", bg: "ink" })}`}
                style={{ transition: `transform ${curve.startsWith("linear(") && m.spring ? m.spring.duration : m.duration.slow} ${curve}` }}
              />
            </span>
          </li>
        ))}
      </ul>

      {m.choreography && (
        <>
          <h3 class={css({ fontFamily: "mono", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "ink-muted", mt: 6 })}>Moves</h3>
          <p class={css({ fontSize: "12.5px", color: "ink-muted", mt: 1 })}>Press one to play it as exported.</p>
          <ul class={css({ listStyle: "none", display: "flex", flexDirection: "column", mt: 3, borderTop: "1px solid token(colors.rule)" })}>
            {MOMENTS.map((moment) => {
              const p = m.choreography[moment];
              return (
                <li key={moment} class={css({ borderBottom: "1px solid token(colors.rule)" })}>
                  <button
                    type="button"
                    aria-label={`Play ${moment}: ${p.use}`}
                    onClick$={(_, el) => play(el.querySelector<HTMLElement>(".swatch")!, p)}
                    class={css({
                      display: "grid", gridTemplateColumns: "52px minmax(0, 1fr)", gap: 3, alignItems: "center", w: "100%", py: 3, textAlign: "left", bg: "transparent",
                      rounded: "sm", transition: "background 0.15s",
                      _hover: { bg: "paper-deep" },
                      _focusVisible: { outline: "2px solid token(colors.chalk)", outlineOffset: "2px" },
                    })}
                  >
                    <span aria-hidden="true" class={css({ display: "grid", placeItems: "center", w: "52px", h: "52px", rounded: "base", bg: "paper-deep", overflow: "hidden" })}>
                      <span
                        class={`swatch ${css({ display: "block", w: "24px", h: "24px", rounded: "sm", boxShadow: "0 1px 0 rgba(28,27,25,0.12)" })}`}
                        style={{ background: t.colors.primary }}
                      />
                    </span>
                    <span class={css({ display: "flex", flexDirection: "column", gap: "2px", minW: 0 })}>
                      <span class={css({ display: "flex", justifyContent: "space-between", gap: 2, fontFamily: "mono", fontSize: "12px" })}>
                        <span class={css({ color: "ink", fontWeight: 600 })}>{moment}</span>
                        <span class={css({ color: "ink-muted" })}>{p.iterations === "infinite" ? `${seconds(p.duration)} loop` : seconds(p.duration)}</span>
                      </span>
                      <span class={css({ fontSize: "13px", color: "ink-soft", lineHeight: 1.4 })}>{p.use}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p class={css({ fontSize: "12.5px", color: "ink-muted", mt: 3, lineHeight: 1.45 })}>
            The CSS export ships these as <code class={css({ fontFamily: "mono" })}>.motion-*</code> classes. With reduced motion on, arrivals and exits fade in place and loops stay still.
          </p>
        </>
      )}
    </section>
  );
});
