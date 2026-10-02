import { useLocale } from "~/i18n/provider";
import { text, personaText, localeHref } from "~/i18n/runtime";
import { component$, useContext } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, openView, selectPersona } from "./context";
import { kicker } from "./ui";

export const Rail = component$(() => {
  const locale = useLocale();
  const s = useContext(StudioCtx);
  const base = s.personas.filter((p) => p._source !== "custom");
  const custom = s.personas.filter((p) => p._source === "custom");

  const group = (title: string, list: typeof s.personas) => (
    <div class={css({ display: "flex", flexDirection: "column", gap: 1 })}>
      <h2 class={kicker} style={{ padding: "0 10px", marginBottom: "4px" }}>{title}</h2>
      <ul class={css({ listStyle: "none", display: "flex", flexDirection: "column", gap: "2px" })}>
        {list.map((p) => {
          const t = s.tokens[p.id];
          const current = s.view === "persona" && s.selectedId === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick$={() => selectPersona(s, p.id)}
                class={css({
                  w: "100%",
                  display: "grid",
                  gridTemplateColumns: "34px 1fr",
                  gap: 3,
                  alignItems: "center",
                  p: "8px 10px",
                  rounded: "base",
                  textAlign: "left",
                  bg: "transparent",
                  border: "1px solid transparent",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  _hover: { bg: "paper-deep" },
                  "&[aria-current=true]": { bg: "card", borderColor: "rule", boxShadow: "sheet" },
                })}
              >
                <span
                  aria-hidden="true"
                  class={css({ position: "relative", w: "34px", h: "34px", rounded: "sm", overflow: "hidden", border: "1px solid rgba(28,27,25,0.12)" })}
                  style={{ background: t?.colors.background ?? "#E7E0D2" }}
                >
                  {t && (
                    <>
                      <i class={css({ position: "absolute", left: "6px", top: "6px", w: "14px", h: "14px", rounded: "full" })} style={{ background: t.colors.primary }} />
                      <i class={css({ position: "absolute", right: "5px", bottom: "5px", w: "10px", h: "10px", rounded: "xs" })} style={{ background: t.colors.secondary }} />
                    </>
                  )}
                </span>
                <span class={css({ minW: 0 })}>
                  <span class={css({ display: "block", fontSize: "14px", fontWeight: 600, color: "ink", overflowWrap: "break-word", lineHeight: 1.3 })}>
                    {personaText(locale.value, p, p.name.replace(/^The /, ""))}
                  </span>
                  <span class={css({ display: "block", fontFamily: "mono", fontSize: "11px", color: "ink-muted", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>
                    {text(locale.value, p.aesthetic?.colorTemperature ?? "")} · {text(locale.value, p.aesthetic?.density ?? "")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const action = (label: string, view: "new" | "decompose" | "remix" | "projects", glyph: string, desc: string) => (
    <button
      type="button"
      aria-current={s.view === view ? "true" : undefined}
      onClick$={() => openView(s, view)}
      class={css({
        w: "100%",
        display: "grid",
        gridTemplateColumns: "26px 1fr",
        gap: 3,
        alignItems: "center",
        p: "8px 10px",
        rounded: "base",
        textAlign: "left",
        bg: "transparent",
        border: "1px solid transparent",
        cursor: "pointer",
        _hover: { bg: "paper-deep" },
        "&[aria-current=true]": { bg: "card", borderColor: "rule" },
      })}
    >
      <span aria-hidden="true" class={css({ display: "grid", placeItems: "center", w: "26px", h: "26px", rounded: "full", border: "1px dashed token(colors.rule-strong)", fontSize: "14px", color: "thread-ink" })}>
        {glyph}
      </span>
      <span>
        <span class={css({ display: "block", fontSize: "14px", fontWeight: 600 })}>{label}</span>
        <span class={css({ display: "block", fontSize: "12px", color: "ink-muted" })}>{desc}</span>
      </span>
    </button>
  );

  return (
    <>
      {s.railOpen && (
        <div
          aria-hidden="true"
          onClick$={() => (s.railOpen = false)}
          class={css({ position: "fixed", inset: 0, top: "56px", bg: "rgba(28,27,25,0.32)", zIndex: 30, display: { lg: "none" } })}
        />
      )}
      <nav
        id="studio-rail"
        aria-label={text(locale.value, "Wardrobe")}
        data-open={s.railOpen ? "true" : "false"}
        class={css({
          position: { base: "fixed", lg: "sticky" },
          top: "56px",
          left: 0,
          bottom: { base: 0, lg: "auto" },
          zIndex: 35,
          w: { base: "min(300px, 86vw)", lg: "auto" },
          h: { lg: "calc(100dvh - 56px)" },
          overflowY: "auto",
          bg: "paper",
          borderRight: "1px solid token(colors.rule)",
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          transition: "transform 0.3s token(easings.thread)",
          transform: { base: "translateX(-105%)", lg: "none" },
          "&[data-open=true]": { transform: "none" },
        })}
      >
        <div>
          {action(text(locale.value, "Projects"), "projects", "▤", text(locale.value, "Keep a brief and its design history"))}
        </div>
        {s.loading && s.personas.length === 0 ? (
          <div class={css({ display: "flex", flexDirection: "column", gap: 2, p: 2 })} aria-busy="true" aria-label={text(locale.value, "Loading personas")}>
            {[0, 1, 2].map((i) => (
              <div key={i} class={css({ h: "50px", rounded: "base", bg: "paper-deep", opacity: 0.7 })} />
            ))}
          </div>
        ) : (
          <>
            {group(text(locale.value, "Wardrobe"), base)}
            {custom.length > 0 && group(text(locale.value, "Bespoke"), custom)}
          </>
        )}

        <div class={css({ display: "flex", flexDirection: "column", gap: 1, mt: "auto", pt: 4, borderTop: "1px dashed token(colors.rule-strong)" })}>
          <h2 class={kicker} style={{ padding: "0 10px", marginBottom: "4px" }}>{text(locale.value, "Start a fitting")}</h2>
          <a href={localeHref("/materials/", locale.value)} class={css({ display: "block", px: "10px", py: 3, fontSize: "14px", color: "thread-ink", textDecoration: "none", _hover: { textDecoration: "underline" } })}>{text(locale.value, "Material room →")}</a>
          {action(text(locale.value, "New persona"), "new", "+", text(locale.value, "Write one from scratch"))}
          {action(text(locale.value, "Decompose a site"), "decompose", "⌗", text(locale.value, "Draft from a live URL"))}
          {action(text(locale.value, "Remix two"), "remix", "×", text(locale.value, "Cross two personas"))}
        </div>
      </nav>
    </>
  );
});
