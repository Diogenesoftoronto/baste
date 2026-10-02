import { useLocale } from "~/i18n/provider";
import { text } from "~/i18n/runtime";
import { component$, useSignal } from "@builder.io/qwik";
import { css } from "styled-system/css";

interface CopyCommandProps {
  command: string;
  tone?: "paper" | "night";
}

/** A shell command you can copy in one click. */
export const CopyCommand = component$<CopyCommandProps>(({ command, tone = "paper" }) => {
  const locale = useLocale();
  const copied = useSignal(false);
  const night = tone === "night";
  return (
    <button
      type="button"
      data-juice="copy"
      aria-label={text(locale.value, "Copy command: {command}", { command })}
      onClick$={async () => {
        try {
          await navigator.clipboard.writeText(command);
          copied.value = true;
          setTimeout(() => (copied.value = false), 1600);
        } catch {
          /* clipboard blocked — the command is still visible to select */
        }
      }}
      class={css({
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        px: 4,
        h: "46px",
        maxW: "100%",
        rounded: "base",
        border: "1px solid",
        fontFamily: "mono",
        fontSize: "13px",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.2s, background 0.2s",
      })}
      style={{
        background: night ? "#24221D" : "#FBF9F4",
        color: night ? "#EDE7DA" : "#1C1B19",
        borderColor: night ? "#3A372F" : "#CFC7B8",
      }}
    >
      <span aria-hidden="true" style={{ color: night ? "#F0C534" : "#A9311E" }}>$</span>
      <span class={css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>{command}</span>
      <span
        aria-live="polite"
        class={css({ fontFamily: "body", fontSize: "12px", ml: "auto", pl: 2, whiteSpace: "nowrap" })}
        style={{ color: night ? "#A8A193" : "#6E6A61" }}
      >
        {copied.value ? text(locale.value, "Copied") : text(locale.value, "Copy")}
      </span>
    </button>
  );
});
