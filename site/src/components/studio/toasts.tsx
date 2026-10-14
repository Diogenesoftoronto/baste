import { component$, useContext } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx } from "./context";

export const Toasts = component$(() => {
  const s = useContext(StudioCtx);
  return (
    <div
      role="status"
      aria-live="polite"
      class={css({ position: "fixed", bottom: 5, right: 5, left: { base: 5, sm: "auto" }, zIndex: 100, display: "flex", flexDirection: "column", gap: 2, maxW: { sm: "380px" } })}
    >
      {s.toasts.map((t) => (
        <div
          key={t.id}
          class={`rise ${css({ display: "flex", gap: 3, alignItems: "flex-start", px: 4, py: 3, rounded: "base", bg: "night", color: "night-text", fontSize: "14px", boxShadow: "lift" })}`}
        >
          <i
            aria-hidden="true"
            class={css({ flexShrink: 0, w: "8px", h: "8px", rounded: "full", mt: "6px" })}
            style={{ background: t.tone === "error" ? "#E8664F" : t.tone === "info" ? "#F0C534" : "#5DBB8A" }}
          />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
});
