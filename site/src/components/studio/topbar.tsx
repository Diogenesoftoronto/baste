import { component$, useContext } from "@builder.io/qwik";
import { css, cx } from "styled-system/css";
import { BasteLogo } from "~/components/layout/baste-logo";
import { StudioCtx, openView } from "./context";
import { act, btn, btnSm } from "./ui";
import { SoundToggle } from "~/components/fx/juice";

const outLink = css({ display: { base: "none", md: "inline-flex" }, h: "30px", px: 3, fontSize: "13px" });

export const ConnectionPill = component$(() => {
  const s = useContext(StudioCtx);
  const meta = {
    connecting: { dot: "#A79E8D", label: "Connecting…", title: `Looking for a Baste server at ${s.apiBase}` },
    live: { dot: "#2E7D5B", label: "Live", title: `Connected to ${s.apiBase}` },
    demo: { dot: "#F0C534", label: "Demo", title: "No local server found — changes stay in this tab. Run `npx baste gui` to connect." },
  }[s.status];
  return (
    <button
      type="button"
      title={meta.title}
      onClick$={() => openView(s, "settings")}
      data-juice="go"
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
        {/* links that leave the Studio carry an out-arrow; everything inside stays a quiet "go" */}
        <a href="/materials/" title="Baste's own material room — leaves the Studio" class={act("go", outLink)}>
          Material room <span data-arrow="out" aria-hidden="true">↗</span>
        </a>
        <a href="/docs/" title="Studio guide — leaves the Studio" class={act("go", outLink)}>
          Guide <span data-arrow="out" aria-hidden="true">↗</span>
        </a>
        {/* one door to the workroom: account, connection and defaults all live there */}
        <button
          type="button"
          onClick$={() => openView(s, "settings")}
          aria-current={s.view === "settings" ? "page" : undefined}
          aria-label={s.account.status?.authenticated ? "Workroom — account and settings" : "Sign in — account and settings"}
          class={act("go", cx(btnSm, css({ "&[aria-current=page]": { color: "ink", bg: "paper-deep" } })))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>
          <span class={css({ display: { base: "none", md: "inline" } })}>{s.account.status?.authenticated ? "Workroom" : "Sign in"}</span>
        </button>
      </div>
    </header>
  );
});
