import { component$, useContext } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, openView } from "../context";
import { btn, btnSm } from "../ui";

/** Explains, once, why a flow needs the local server — and how to get it. */
export const ServerOnly = component$<{ what: string }>(({ what }) => {
  const s = useContext(StudioCtx);
  return (
    <div role="note" class={css({ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", p: 4, rounded: "lg", border: "1px dashed token(colors.rule-strong)", bg: "rgba(240,197,52,0.12)" })}>
      <span class={css({ fontSize: "14px", flex: 1, minW: "220px" })}>
        <strong>{what} runs on your machine.</strong> Start the local server, then reconnect:{" "}
        <code class={css({ fontFamily: "mono", fontSize: "13px", bg: "card", px: 2, py: "2px", rounded: "sm" })}>baste gui</code>
      </span>
      <button class={btn("secondary", btnSm)} onClick$={() => openView(s, "settings")}>Connection settings</button>
    </div>
  );
});
