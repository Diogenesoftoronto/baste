import { useLocale } from "~/i18n/provider";
import { text, personaText } from "~/i18n/runtime";
import { component$, useContext, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css, cx } from "styled-system/css";
import { StudioCtx, errMsg, loadTokens, openView, refreshPersonas, syncUrl, toast, type PersonaTab } from "./context";
import { act, btnSm, emptyBox, kicker } from "./ui";
import { FittingTab } from "./tabs/fitting";
import { TokensTab } from "./tabs/tokens";
import { GenerateTab } from "./tabs/generate";
import { MoodboardTab } from "./tabs/moodboard";
import { SampleTab } from "./tabs/sample";
import { BrandKitTab } from "./tabs/brandkit";
import { FeedbackTab } from "./tabs/feedback";
import { EditorTab } from "./tabs/editor";
import { MaterialTab } from "./tabs/material";
import { Fabric } from "~/components/fx/fabric";
import { MATERIAL_EVENT, materialForPersona, personaMaterialKey, savedPersonaMaterial, type MaterialLook } from "~/lib/materials";
import { HoldButton } from "./hold-button";

/**
 * Two benches. Measure: who they are and what that becomes (profile, cloth,
 * tokens). Make: what gets cut from it and what you thought of the result.
 * OpenPencil is an edit mode of Tokens, not a place of its own; a brand kit
 * only exists for personas cut from a live site.
 */
const BENCHES: Array<{ name: string; tabs: Array<{ id: PersonaTab; label: string; customOnly?: boolean }> }> = [
  { name: "Measure", tabs: [
    { id: "fitting", label: "Fitting" },
    { id: "material", label: "Material" },
    { id: "tokens", label: "Tokens" },
  ] },
  { name: "Make", tabs: [
    { id: "generate", label: "Generate" },
    { id: "sample", label: "Sample" },
    { id: "moodboard", label: "Moodboard" },
    { id: "feedback", label: "Taste" },
    { id: "brandkit", label: "Brand kit", customOnly: true },
  ] },
];
/** Which tab a view belongs to (the OpenPencil editor sits under Tokens). */
const tabOf = (t: PersonaTab): PersonaTab => (t === "editor" ? "tokens" : t);

export const Workspace = component$(() => {
  const locale = useLocale();
  const s = useContext(StudioCtx);
  const persona = s.personas.find((p) => p.id === s.selectedId);
  const tokens = persona ? s.tokens[persona.id] : undefined;
  /** The cloth this browser has saved for the persona, if any (else it's fitted fresh). */
  const savedCloth = useSignal<MaterialLook | null>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const id = track(() => s.selectedId);
    track(() => s.status);
    if (id) loadTokens(s, id);
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const id = track(() => s.selectedId);
    savedCloth.value = id ? savedPersonaMaterial(id) : null;
    const sync = (e: Event) => {
      if ((e as CustomEvent<string>).detail === personaMaterialKey(id)) savedCloth.value = savedPersonaMaterial(id);
    };
    window.addEventListener(MATERIAL_EVENT, sync);
    cleanup(() => window.removeEventListener(MATERIAL_EVENT, sync));
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
        <button class={act("go", undefined, true)} onClick$={() => openView(s, "settings")}>{text(locale.value, "Sign in / create profile")} <span data-arrow aria-hidden="true">→</span></button>
      </div>
    );
    return (
      <div class={emptyBox}>
        <h1 class="display" style={{ fontSize: "34px" }}>{text(locale.value, "The wardrobe is empty.")}</h1>
        <p>{text(locale.value, "Measure a new persona, or draft one from a site you admire.")}</p>
        <div class={css({ display: "flex", gap: 2, flexWrap: "wrap" })}>
          <button class={act("go", undefined, true)} onClick$={() => openView(s, "new")}>{text(locale.value, "Measure a new persona")} <span data-arrow aria-hidden="true">→</span></button>
          <button class={act("go")} onClick$={() => openView(s, "decompose")}>{text(locale.value, "Decompose a site")} <span data-arrow aria-hidden="true">→</span></button>
        </div>
      </div>
    );
  }

  const custom = persona._source === "custom";
  const cloth = tokens ? savedCloth.value ?? materialForPersona(persona, tokens) : undefined;
  const current = tabOf(s.tab);

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 6, maxW: "1280px" })}>
      {/* Persona header: a strip of the persona's own cloth behind its name */}
      <header
        class={css({ position: "relative", rounded: "lg", overflow: "hidden", border: "1px solid token(colors.rule)", bg: "card", boxShadow: "sheet", minH: { md: "260px" } })}
        style={cloth ? { backgroundColor: cloth.ground } : undefined}
      >
        <div class={css({ position: "absolute", inset: 0 })} aria-hidden="true">
          {cloth && <Fabric look={cloth} quality={0.75} label={`${persona.name}'s material`} />}
        </div>
        <div
          class={css({ position: "relative", m: { base: 3, md: 4 }, mt: { base: "72px", md: 4 }, ml: { md: "auto" }, maxW: { md: "min(720px, 72%)" }, p: { base: 4, md: 6 }, rounded: "base", display: "flex", flexDirection: "column", gap: 3 })}
          style={{ background: "rgba(251,249,244,0.94)", backdropFilter: "blur(6px)", boxShadow: "0 12px 30px -12px rgba(20,14,6,0.4)" }}
        >
          <div class={css({ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" })}>
            <span class={kicker}>{custom ? text(locale.value, "Bespoke persona") : text(locale.value, "Base persona")}</span>
            <span class={css({ fontFamily: "mono", fontSize: "11.5px", color: "ink-muted" })}>· {persona.id}</span>
          </div>
          <h1 class="display" style={{ fontSize: "clamp(30px, 3.6vw, 46px)" }}>{personaText(locale.value, persona, persona.name)}</h1>
          <p class={css({ color: "ink-soft", fontSize: "15px", maxW: "62ch" })}>{personaText(locale.value, persona, persona.summary)}</p>
          <div class={css({ display: "flex", gap: 2, flexWrap: "wrap", mt: 1, alignItems: "center" })}>
            <button class={act("baste", btnSm)} onClick$={() => openView(s, custom ? "edit" : "tailor")} title={custom ? text(locale.value, "Re-measure this persona") : text(locale.value, "Draft your own copy; the original stays as it is")}>
              {custom ? text(locale.value, "Edit measurements") : text(locale.value, "Tailor a copy")}
            </button>
            {current !== "material" && (
              <button class={act("go", btnSm)} onClick$={() => { s.tab = "material"; syncUrl(s); }}>
                {text(locale.value, "Change the cloth")} <span data-arrow aria-hidden="true">→</span>
              </button>
            )}
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
        class={css({ display: "flex", alignItems: "center", gap: 1, overflowX: "auto", borderBottom: "1px solid token(colors.rule)", scrollbarWidth: "none", maskImage: { base: "linear-gradient(90deg, #000 85%, transparent)", md: "none" } })}
      >
        {BENCHES.flatMap((b, bi) => [
          <span key={`bench-${b.name}`} aria-hidden="true" class={cx(kicker, css({ flexShrink: 0, pl: bi ? 4 : 0, pr: 1, fontSize: "10px", borderLeft: bi ? "1px dashed token(colors.rule-strong)" : "none", ml: bi ? 2 : 0 }))}>{text(locale.value, b.name)}</span>,
          ...b.tabs.filter((t) => !t.customOnly || custom || s.tab === t.id).map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={current === t.id}
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
        ))])}
      </div>

      <div id="persona-tabpanel" role="tabpanel" aria-labelledby={`tab-${current}`} key={`${persona.id}-${s.tab}`} class="rise">
        {current === "tokens" && (
          <div role="radiogroup" aria-label={text(locale.value, "Tokens mode")} class={css({ display: "inline-flex", gap: 1, p: "3px", mb: 4, rounded: "base", border: "1px solid token(colors.rule)", bg: "paper-deep" })}>
            {([["tokens", "Read the pattern"], ["editor", "Edit in OpenPencil"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={s.tab === id}
                onClick$={() => { s.tab = id; syncUrl(s); }}
                class={css({ h: "30px", px: 3, rounded: "sm", fontSize: "13px", border: "1px solid transparent", bg: "transparent", color: "ink-muted", _hover: { color: "ink" }, "&[aria-checked=true]": { bg: "card", color: "ink", fontWeight: 600, borderColor: "rule-strong", boxShadow: "sheet" } })}
              >
                {text(locale.value, label)}
              </button>
            ))}
          </div>
        )}
        {s.tab === "fitting" && <FittingTab />}
        {s.tab === "material" && <MaterialTab />}
        {s.tab === "tokens" && <TokensTab />}
        {s.tab === "generate" && <GenerateTab />}
        {s.tab === "sample" && <SampleTab />}
        {s.tab === "moodboard" && <MoodboardTab />}
        {s.tab === "brandkit" && <BrandKitTab />}
        {s.tab === "feedback" && <FeedbackTab />}
        {s.tab === "editor" && <EditorTab />}
      </div>
    </div>
  );
});
