import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { chalkPuff, haptic, play, setSoundEnabled, snipBurst, soundEnabled, type Sound } from "~/lib/juice";
import { press, type PressKind } from "./press-gl";

/** What each action verb sounds, feels and looks like when pressed (see global.css "Action verbs"). */
const VERBS: Record<string, { sound: Sound; pitch?: number; buzz: number | number[]; fx?: PressKind; color?: string; burst?: "snip" | "chalk" }> = {
  cut: { sound: "snip", buzz: [6, 30, 8], fx: "snip", burst: "snip" },
  spend: { sound: "tape", buzz: [10, 20, 10, 20, 12], fx: "snip", color: "#8A6A0C", burst: "snip" },
  baste: { sound: "thread", pitch: 0.35, buzz: 6, fx: "stitch" },
  pin: { sound: "pin", buzz: 5, fx: "ripple" },
  chalk: { sound: "chalk", buzz: 4, fx: "chalk", burst: "chalk" },
  go: { sound: "paper", buzz: 3 },
  dye: { sound: "dip", buzz: 8, fx: "dye" },
  unpick: { sound: "thread", pitch: 0.15, buzz: 4 },
  // legacy names
  snip: { sound: "snip", buzz: [6, 30, 8], fx: "snip", burst: "snip" },
  copy: { sound: "chalk", buzz: 4, fx: "chalk", burst: "chalk" },
};

function verbOf(el: HTMLElement): string | undefined {
  if (el.dataset.juice) return el.dataset.juice;
  const m = /\bact-(\w+)/.exec(typeof el.className === "string" ? el.className : "");
  if (m) return m[1];
  const role = el.getAttribute("role");
  if (role === "tab" || role === "radio" || el.matches("input[type=checkbox], [aria-pressed]")) return "pin";
  return undefined;
}

/**
 * Global juice wiring, by delegation so every control gets feedback in kind:
 * each action verb (cut, spend, baste, pin, chalk, go, dye, unpick — from an
 * `act-*` class or `data-juice`) has its own sound, haptic pattern and press
 * shader, so a press tells you what sort of thing just happened. Tabs, radios
 * and toggles are pins. Anything else gets a light tick.
 * Plus the idle easter egg: leave the page alone and a pin drops onto it.
 */
export const Juice = component$(() => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("button, a, [role=tab], [role=radio], summary, select, input[type=checkbox]");
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      if (el.dataset.juice === "self") return; // the control plays its own feedback (HoldButton)
      // a submit that the browser will refuse: say so now, not with a cutting sound
      if (el instanceof HTMLButtonElement && el.type === "submit" && el.form && !el.form.noValidate && !el.form.checkValidity()) {
        play("error");
        haptic([4, 40, 4]);
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) el.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }], { duration: 260, easing: "ease-out" });
        return;
      }
      const v = VERBS[verbOf(el) ?? ""];
      if (!v) {
        play("tick");
        return;
      }
      play(v.sound, v.pitch);
      haptic(v.buzz);
      const color = el.dataset.dye || v.color;
      if (v.fx) press(v.fx, el, e.clientX, e.clientY, color);
      if (v.burst === "snip") snipBurst(e.clientX, e.clientY, color ? [color, "#1C1B19", "#D2402A"] : undefined, 10);
      if (v.burst === "chalk") chalkPuff(e.clientX, e.clientY);
    };
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (el.type === "range") {
        const min = Number(el.min || 0), max = Number(el.max || 100);
        play("thread", (Number(el.value) - min) / Math.max(1, max - min));
      }
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("input", onInput, { passive: true });

    // idle easter egg: after a while untouched, a dressmaker's pin drops in
    let idleTimer = 0;
    const arm = () => {
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(dropPin, 24000);
    };
    const dropPin = () => {
      if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const pin = document.createElement("span");
      pin.className = "pin-head idle-pin";
      pin.setAttribute("aria-hidden", "true");
      pin.style.left = `${20 + Math.random() * 60}vw`;
      document.body.appendChild(pin);
      pin.addEventListener("animationend", () => {
        play("pin", 0.2);
        chalkPuff(pin.getBoundingClientRect().left + 7, pin.getBoundingClientRect().top + 14, "rgba(110,106,97,0.5)", 10);
        setTimeout(() => pin.remove(), 2600);
      });
    };
    for (const ev of ["pointermove", "keydown", "scroll"]) window.addEventListener(ev, arm, { passive: true });
    arm();

    cleanup(() => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("input", onInput);
      clearTimeout(idleTimer);
      for (const ev of ["pointermove", "keydown", "scroll"]) window.removeEventListener(ev, arm);
    });
  });
  return null;
});

/** Sound on/off. Juice is optional; the choice persists. */
export const SoundToggle = component$<{ tone?: "paper" | "night" }>(({ tone = "paper" }) => {
  const on = useSignal(true);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    on.value = soundEnabled();
    const sync = (e: Event) => (on.value = (e as CustomEvent<boolean>).detail);
    window.addEventListener("baste:sound", sync);
    cleanup(() => window.removeEventListener("baste:sound", sync));
  });
  return (
    <button
      type="button"
      aria-pressed={on.value}
      aria-label={on.value ? "Interface sounds on — turn off" : "Interface sounds off — turn on"}
      title={on.value ? "Interface sounds on" : "Interface sounds off"}
      onClick$={() => {
        // setSoundEnabled broadcasts "baste:sound", which the listener above
        // writes back into `on`; set it once from a fixed value, never toggle twice.
        const next = !on.value;
        setSoundEnabled(next);
        on.value = next;
        if (next) play("thread", 0.7);
      }}
      class={css({
        display: "inline-grid",
        placeItems: "center",
        w: "34px",
        h: "34px",
        rounded: "full",
        border: "1px solid transparent",
        bg: "transparent",
        _hover: { borderColor: "rule-strong" },
      })}
      style={{ color: tone === "night" ? "#EDE7DA" : "#45423C" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
        <path d="M4 10v4h3l5 4V6L7 10H4z" fill="currentColor" fill-opacity="0.12" />
        {on.value ? (
          <>
            <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
            <path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" stroke-dasharray="2.6 2" />
          </>
        ) : (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        )}
      </svg>
    </button>
  );
});
