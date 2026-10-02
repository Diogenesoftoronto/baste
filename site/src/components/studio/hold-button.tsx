import { component$, useSignal, type QRL } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { haptic, play, snipBurst } from "~/lib/juice";

interface HoldButtonProps {
  label: string;
  /** Shown while held. */
  holdingLabel?: string;
  onConfirm$: QRL<() => void>;
  ms?: number;
  class?: string;
}

/**
 * Destructive actions are confirmed by holding, not by a modal: thread is
 * unpicked along the button as you hold, and it snips when it reaches the end.
 * Keyboard: hold Space/Enter the same way.
 */
export const HoldButton = component$<HoldButtonProps>(({ label, holdingLabel = "Keep holding…", onConfirm$, ms = 900, class: cls }) => {
  const holding = useSignal(false);
  const timer = useSignal<number>();
  const btnEl = useSignal<HTMLButtonElement>();

  return (
    <button
      ref={btnEl}
      type="button"
      aria-label={`${label} (press and hold)`}
      class={`${css({
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        h: "30px",
        px: 3,
        rounded: "base",
        fontSize: "13px",
        fontWeight: 600,
        color: "thread-ink",
        bg: "transparent",
        border: "1px solid token(colors.rule)",
        userSelect: "none",
        touchAction: "none",
        _hover: { borderColor: "thread-ink" },
        "&[data-holding=true]": { animation: "shake-hold 0.12s linear infinite" },
      })} ${cls ?? ""}`}
      data-holding={holding.value ? "true" : "false"}
      style={{ "--hold-ms": `${ms}ms` } as Record<string, string>}
      onPointerDown$={(e, el) => {
        el.setPointerCapture(e.pointerId);
        holding.value = true;
        play("thread", 0.2);
        timer.value = window.setTimeout(() => {
          holding.value = false;
          const r = el.getBoundingClientRect();
          play("snip");
          haptic([10, 40, 14]);
          snipBurst(r.left + r.width / 2, r.top + r.height / 2);
          onConfirm$();
        }, ms);
      }}
      onPointerUp$={() => {
        holding.value = false;
        clearTimeout(timer.value);
      }}
      onPointerCancel$={() => {
        holding.value = false;
        clearTimeout(timer.value);
      }}
      onKeyDown$={(e, el) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          el.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 }));
        }
      }}
      onKeyUp$={(e) => {
        if (e.key === " " || e.key === "Enter") {
          holding.value = false;
          clearTimeout(timer.value);
        }
      }}
      preventdefault:keydown
    >
      {/* thread being unpicked */}
      <span
        aria-hidden="true"
        class={css({ position: "absolute", left: 0, bottom: 0, h: "2px", w: "100%", transformOrigin: "left", transform: "scaleX(0)" })}
        style={{
          backgroundImage: "linear-gradient(90deg, #D2402A 0 6px, transparent 6px 10px)",
          backgroundSize: "10px 2px",
          transform: holding.value ? "scaleX(1)" : "scaleX(0)",
          transition: holding.value ? `transform ${ms}ms linear` : "transform 0.25s ease-out",
        }}
      />
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
      </svg>
      {holding.value ? holdingLabel : label}
    </button>
  );
});
