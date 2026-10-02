import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { chalkPuff, haptic, play, setSoundEnabled, snipBurst, soundEnabled, type Sound } from "~/lib/juice";

/**
 * Global juice wiring, by delegation so every control gets feedback:
 * - any button/link/tab: press squash (CSS) + a tick
 * - [data-juice="snip"]: primary actions — scissor snip + thread-end burst + haptic
 * - [data-juice="pin"]: selections — pin sound + chalk puff
 * - [role=tab], [role=radio]: pin sound
 * - [data-juice="copy"]: chalk sound + puff
 * Plus the idle easter egg: leave the page alone and a pin drops onto it.
 */
export const Juice = component$(() => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("button, a, [role=tab], [role=radio], summary, select, input[type=checkbox]");
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      const kind = el.dataset.juice as Sound | "copy" | undefined;
      if (kind === "snip") {
        play("snip");
        haptic([6, 30, 8]);
        snipBurst(e.clientX, e.clientY);
      } else if (kind === "pin" || el.getAttribute("role") === "tab" || el.getAttribute("role") === "radio") {
        play("pin");
        haptic(5);
        if (kind === "pin") chalkPuff(e.clientX, e.clientY);
      } else if (kind === "copy") {
        play("chalk");
        chalkPuff(e.clientX, e.clientY, "rgba(28,27,25,0.45)");
      } else {
        play("tick");
      }
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
      aria-label={on.value ? "Sound on — turn off" : "Sound off — turn on"}
      title={on.value ? "Sound on" : "Sound off"}
      onClick$={() => {
        setSoundEnabled(!on.value);
        on.value = !on.value;
        if (on.value) play("thread", 0.7);
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
