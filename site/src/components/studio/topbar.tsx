import { component$, useContext } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { BasteLogo } from "~/components/layout/baste-logo";
import { StudioCtx, openView } from "./context";
import { btn, btnSm } from "./ui";
import { SoundToggle } from "~/components/fx/juice";

export const ConnectionPill = component$(() => {
  const s = useContext(StudioCtx);
  const meta = {
    connecting: { dot: "#A79E8D", label: "Connecting…", title: `Looking for a Baste server at ${s.apiBase}` },
    live: { dot: "#2E7D5B", label: "Live", title: `Connected to ${s.apiBase}` },
    demo: { dot: "#F0C534", label: "Demo", title: "No local server found — changes stay in this tab. Run `baste gui` to connect." },
  }[s.status];
  return (
    <button
      type="button"
      title={meta.title}
      onClick$={() => openView(s, "settings")}
      class={css({
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        h: "30px",
        px: 3,
        rounded: "full",
        border: "1px solid token(colors.rule-strong)",
        bg: "card",
        fontSize: "12.5px",
        color: "ink-soft",
        cursor: "pointer",
        _hover: { borderColor: "ink" },
      })}
    >
      <i
        aria-hidden="true"
        class={css({ w: "8px", h: "8px", rounded: "full" })}
        style={{ background: meta.dot, boxShadow: s.status === "live" ? "0 0 0 3px rgba(46,125,91,0.18)" : undefined }}
      />
      <span>{meta.label}</span>
      <span class={css({ display: { base: "none", md: "inline" }, fontFamily: "mono", fontSize: "11.5px", color: "ink-muted" })}>
        {s.status === "demo" ? "in-browser" : s.apiBase.replace(/^https?:\/\//, "")}
      </span>
    </button>
  );
});

export const Topbar = component$(() => {
  const s = useContext(StudioCtx);
  return (
    <header
      class={css({
        position: "sticky",
        top: 0,
        zIndex: 40,
        h: "56px",
        display: "flex",
        alignItems: "center",
        gap: { base: 1, md: 3 },
        px: { base: 3, md: 5 },
        bg: "rgba(241,236,226,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid token(colors.rule)",
      })}
    >
      <button
        type="button"
        aria-label={s.railOpen ? "Close wardrobe" : "Open wardrobe"}
        aria-expanded={s.railOpen}
        aria-controls="studio-rail"
        style={{ paddingInline: "0", flexShrink: "0" }}
        onClick$={() => (s.railOpen = !s.railOpen)}
        class={btn("ghost", css({ display: { base: "inline-flex", lg: "none" }, w: "38px", px: 0 }))}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          {s.railOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h10" />}
        </svg>
      </button>
      <a href="/" aria-label="Baste home" class={css({ textDecoration: "none", display: "flex" })}>
        <BasteLogo size={24} />
      </a>
      <span aria-hidden="true" class={css({ color: "rule-strong", display: { base: "none", sm: "inline" } })}>/</span>
      <span class={css({ fontSize: "14px", fontWeight: 600, display: { base: "none", sm: "inline" } })}>Studio</span>

      <div class={css({ ml: "auto", display: "flex", alignItems: "center", gap: { base: 0, md: 2 } })}>
        <ConnectionPill />
        <SoundToggle />
        <a href="/materials/" aria-label="Material room" title="Material room" class={btn("ghost", css({ display: { base: "none", md: "inline-flex" }, h: "30px", px: 3, fontSize: "13px" }))}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 7c4-6 14-6 18 0M3 12c4-6 14-6 18 0M3 17c4-6 14-6 18 0" /></svg>
          <span class={css({ display: { base: "none", md: "inline" } })}>Materials</span>
        </a>
        <a href="/docs/" class={btn("ghost", css({ display: { base: "none", md: "inline-flex" }, h: "30px", px: 3, fontSize: "13px" }))}>Docs</a>
        <button type="button" onClick$={() => openView(s, "settings")} class={btn("ghost", btnSm)} aria-label="Not Organic account">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>
          <span class={css({ display: { base: "none", md: "inline" } })}>{s.account.status?.authenticated ? "Account" : "Sign in"}</span>
        </button>
        <button type="button" onClick$={() => openView(s, "settings")} class={btn("ghost", btnSm)} aria-label="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
          <span class={css({ display: { base: "none", md: "inline" } })}>Settings</span>
        </button>
      </div>
    </header>
  );
});
