import { useLocale } from "~/i18n/provider";
import { text, personaText } from "~/i18n/runtime";
import { component$, useContext, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, loadTokens, openView, refreshPersonas, syncUrl, toast, type PersonaTab } from "./context";
import { btn, btnSm, emptyBox, kicker } from "./ui";
import { FittingTab } from "./tabs/fitting";
import { TokensTab } from "./tabs/tokens";
import { GenerateTab } from "./tabs/generate";
import { MoodboardTab } from "./tabs/moodboard";
import { BrandKitTab } from "./tabs/brandkit";
import { FeedbackTab } from "./tabs/feedback";
import { EditorTab } from "./tabs/editor";
import { Fabric, lookFromTokens } from "~/components/fx/fabric";
import { HoldButton } from "./hold-button";

const TABS: Array<{ id: PersonaTab; label: string }> = [
  { id: "fitting", label: "Fitting" },
  { id: "tokens", label: "Tokens" },
  { id: "generate", label: "Generate" },
  { id: "moodboard", label: "Moodboard" },
  { id: "brandkit", label: "Brand kit" },
  { id: "feedback", label: "Taste" },
  { id: "editor", label: "OpenPencil" },
];

export const Workspace = component$(() => {
  const locale = useLocale();
  const s = useContext(StudioCtx);
  const persona = s.personas.find((p) => p.id === s.selectedId);
  const tokens = persona ? s.tokens[persona.id] : undefined;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const id = track(() => s.selectedId);
    track(() => s.status);
    if (id) loadTokens(s, id);
  });

  if (s.status === "connecting" || (s.loading && !persona)) {
    return (
      <div aria-busy="true" class={css({ display: "flex", flexDirection: "column", gap: 4 })}>
        <div class={css({ h: "120px", rounded: "lg", bg: "paper-deep", opacity: 0.6 })} />
        <div class={css({ h: "360px", rounded: "lg", bg: "paper-deep", opacity: 0.4 })} />
      </div>
    );
  }

  if (!persona) {
    if (s.account.status?.configured && !s.account.status.authenticated) return (
      <div class={emptyBox}>
        <h1 class="display" style={{ fontSize: "34px" }}>{text(locale.value, "Connect your workroom.")}</h1>
        <p>{text(locale.value, "Sign in or create a Not Organic profile to open your personas, models and wallet on this server.")}</p>
        <button class={btn("primary")} onClick$={() => openView(s, "settings")}>{text(locale.value, "Sign in / create profile")}</button>
      </div>
    );
    return (
      <div class={emptyBox}>
        <h1 class="display" style={{ fontSize: "34px" }}>{text(locale.value, "The wardrobe is empty.")}</h1>
        <p>{text(locale.value, "Measure a new persona, or draft one from a site you admire.")}</p>
        <div class={css({ display: "flex", gap: 2, flexWrap: "wrap" })}>
          <button class={btn("primary")} onClick$={() => openView(s, "new")}>{text(locale.value, "New persona")}</button>
          <button class={btn("secondary")} onClick$={() => openView(s, "decompose")}>{text(locale.value, "Decompose a site")}</button>
        </div>
      </div>
    );
  }

  const custom = persona._source === "custom";

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 6, maxW: "1280px" })}>
      {/* Persona header: a strip of the persona's own cloth behind its name */}
      <header key={persona.id} class={css({ position: "relative", rounded: "lg", overflow: "hidden", border: "1px solid token(colors.rule)", bg: "card", boxShadow: "sheet" })}>
        <div class={css({ position: "absolute", inset: 0, opacity: 0.9 })} aria-hidden="true">
          {tokens && <Fabric look={lookFromTokens(tokens, persona.aesthetic.density)} quality={0.5} />}
        </div>
        <div
          class={css({ position: "relative", m: { base: 3, md: 4 }, ml: { md: "auto" }, maxW: { md: "min(720px, 72%)" }, p: { base: 4, md: 6 }, rounded: "base", display: "flex", flexDirection: "column", gap: 3 })}
          style={{ background: "rgba(251,249,244,0.94)", backdropFilter: "blur(6px)", boxShadow: "0 12px 30px -12px rgba(20,14,6,0.4)" }}
        >
          <div class={css({ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" })}>
            <span class={kicker}>{custom ? text(locale.value, "Bespoke persona") : text(locale.value, "Base persona")}</span>
            <span class={css({ fontFamily: "mono", fontSize: "11.5px", color: "ink-muted" })}>· {persona.id}</span>
          </div>
          <h1 class="display" style={{ fontSize: "clamp(30px, 3.6vw, 46px)" }}>{personaText(locale.value, persona, persona.name)}</h1>
          <p class={css({ color: "ink-soft", fontSize: "15px", maxW: "62ch" })}>{personaText(locale.value, persona, persona.summary)}</p>
          <div class={css({ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 })}>
            <button class={btn("primary", btnSm)} onClick$={() => { s.tab = "generate"; syncUrl(s); }}>{text(locale.value, "Generate assets")}</button>
            <button class={btn("secondary", btnSm)} onClick$={() => openView(s, custom ? "edit" : "tailor")}>
              {custom ? text(locale.value, "Edit measurements") : text(locale.value, "Tailor a copy")}
            </button>
            {custom && (
              <HoldButton
                label={text(locale.value, "Unpick")}
                holdingLabel={text(locale.value, "Unpicking…")}
                onConfirm$={async () => {
                  if (!s.client) return;
                  try {
                    await s.client.deletePersona(persona.id);
                    toast(s, text(locale.value, "Unpicked {name} — personas/{id}.json removed", { name: persona.name, id: persona.id }));
                    s.selectedId = "";
                    await refreshPersonas(s);
                  } catch (err) {
                    toast(s, errMsg(err), "error");
                  }
                }}
              />
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={text(locale.value, "Persona workspace")}
        class={css({ display: "flex", gap: 1, overflowX: "auto", borderBottom: "1px solid token(colors.rule)", scrollbarWidth: "none", maskImage: { base: "linear-gradient(90deg, #000 85%, transparent)", md: "none" } })}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={s.tab === t.id}
            aria-controls="persona-tabpanel"
            onClick$={() => {
              s.tab = t.id;
              syncUrl(s);
            }}
            class={css({
              position: "relative",
              flexShrink: 0,
              h: "42px",
              px: 3,
              fontSize: "14px",
              color: "ink-muted",
              bg: "transparent",
              border: 0,
              _hover: { color: "ink" },
              "&[aria-selected=true]": { color: "ink", fontWeight: 600 },
              "&[aria-selected=true]::after": {
                content: '""',
                position: "absolute",
                left: 3,
                right: 3,
                bottom: "-1px",
                h: "2px",
                backgroundImage: "linear-gradient(90deg, token(colors.thread) 0 7px, transparent 7px 11px)",
                backgroundSize: "11px 2px",
              },
            })}
          >
            {text(locale.value, t.label)}
          </button>
        ))}
      </div>

      <div id="persona-tabpanel" role="tabpanel" aria-labelledby={`tab-${s.tab}`} key={`${persona.id}-${s.tab}`} class="rise">
        {s.tab === "fitting" && <FittingTab />}
        {s.tab === "tokens" && <TokensTab />}
        {s.tab === "generate" && <GenerateTab />}
        {s.tab === "moodboard" && <MoodboardTab />}
        {s.tab === "brandkit" && <BrandKitTab />}
        {s.tab === "feedback" && <FeedbackTab />}
        {s.tab === "editor" && <EditorTab />}
      </div>
    </div>
  );
});
