import { $, component$, useContext, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { API_KEY, StudioCtx, connectStudio, errMsg, toast } from "../context";
import { btn, fieldLabel, hint, input, kicker, panel, panelTitle } from "../ui";
import { DEFAULT_API } from "~/lib/api";
import type { ServerConfig } from "~/lib/api-types";
import { AccountSection } from "./account";

export const SettingsFlow = component$(() => {
  const s = useContext(StudioCtx);
  const api = useSignal(s.apiBase);
  const cfg = useStore<{ data: ServerConfig; loaded: boolean; saving: boolean }>({ data: {}, loaded: false, saving: false });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    track(() => s.status);
    if (!s.client) return;
    try {
      cfg.data = await s.client.getConfig();
      cfg.loaded = true;
    } catch {
      cfg.loaded = false;
    }
  });

  const reconnect = $(async () => {
    try {
      localStorage.setItem(API_KEY, api.value);
    } catch {
      /* won't persist */
    }
    await connectStudio(s, api.value);
    toast(s, s.status === "live" ? `Connected to ${api.value}` : "No server there — staying in demo mode", s.status === "live" ? "ok" : "info");
  });

  const img = cfg.data.generators?.image;
  const qd = cfg.data.qd ?? {};
  const operatorDefaults = s.account.status?.configured === true;

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 6, maxW: "860px" })}>
      <header>
        <span class={kicker}>Workroom</span>
        <h1 class="display" style={{ fontSize: "clamp(32px, 4vw, 48px)" }}>Settings</h1>
      </header>

      <AccountSection />

      <section class={panel} aria-labelledby="st-conn">
        <h2 id="st-conn" class={panelTitle}>Connection</h2>
        <p class={hint}>
          The Studio connects to the Baste API. Run <code>devenv up</code> for local development. Without a server, the built-in personas run in this tab.
        </p>
        <label class={fieldLabel} for="st-api" style={{ marginTop: "16px" }}>API URL</label>
        <div class={css({ display: "flex", gap: 2, flexWrap: { base: "wrap", sm: "nowrap" } })}>
          <input id="st-api" class={input} value={api.value} onInput$={(_, el) => (api.value = el.value)} />
          <button class={btn("primary", css({ flexShrink: 0 }))} onClick$={reconnect}>Reconnect</button>
          <button class={btn("ghost", css({ flexShrink: 0 }))} onClick$={() => (api.value = DEFAULT_API)}>Default</button>
        </div>
        <p class={css({ display: "flex", gap: 2, alignItems: "center", mt: 3, fontSize: "13px" })}>
          <i class={css({ w: "8px", h: "8px", rounded: "full" })} style={{ background: s.status === "live" ? "#2E7D5B" : s.status === "demo" ? "#F0C534" : "#A79E8D" }} />
          {s.status === "live" ? s.account.status?.authenticated ? "Live — reading and writing your account's personas" : "Live — connected to the Baste server" : s.status === "demo" ? "Demo — changes stay in this tab" : "Connecting…"}
        </p>
      </section>

      <section class={panel} aria-labelledby="st-gen">
        <h2 id="st-gen" class={panelTitle}>Generation defaults</h2>
        {!cfg.loaded ? (
          <p class={hint}>Unavailable.</p>
        ) : (
          <>
            <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 4, mt: 4 })}>
              <div>
                <label class={fieldLabel} for="st-prov">Image provider</label>
                <select id="st-prov" class={input} disabled={operatorDefaults} value={img?.provider ?? "openai"} onChange$={(_, el) => (cfg.data = { ...cfg.data, generators: { ...cfg.data.generators, image: { ...img, provider: el.value, model: el.value === "notorganic" ? s.account.models.find((m) => m.kind === "image")?.id ?? "" : "" } } as ServerConfig["generators"] })}>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google</option>
                  <option value="notorganic" disabled={!s.account.status?.configured}>Not Organic (hosted)</option>
                </select>
              </div>
              <div>
                <label class={fieldLabel} for="st-model">Image model</label>
                <input id="st-model" class={input} disabled={operatorDefaults} value={img?.model ?? ""} placeholder="Use server default" onChange$={(_, el) => (cfg.data = { ...cfg.data, generators: { ...cfg.data.generators, image: { ...img, model: el.value } } as ServerConfig["generators"] })} />
              </div>
              <div>
                <label class={fieldLabel} for="st-iter">QD generations · {qd.iterations ?? 5}</label>
                <input id="st-iter" type="range" disabled={operatorDefaults} min={3} max={12} value={qd.iterations ?? 5} class={css({ w: "100%", accentColor: "#D2402A" })} onInput$={(_, el) => (cfg.data = { ...cfg.data, qd: { ...qd, iterations: Number(el.value) } })} />
              </div>
              <div>
                <label class={fieldLabel} for="st-out">Assets kept · {cfg.data.outputCount ?? 3}</label>
                <input id="st-out" type="range" disabled={operatorDefaults} min={1} max={12} value={cfg.data.outputCount ?? 3} class={css({ w: "100%", accentColor: "#D2402A" })} onInput$={(_, el) => (cfg.data = { ...cfg.data, outputCount: Number(el.value) })} />
              </div>
            </div>
            <button
              class={btn("primary", css({ mt: 5 }))}
              disabled={cfg.saving || s.status !== "live" || s.account.status?.configured === true}
              onClick$={async () => {
                cfg.saving = true;
                try {
                  await s.client!.saveConfig(cfg.data);
                  toast(s, "Saved to baste.config.json");
                } catch (err) {
                  toast(s, errMsg(err), "error");
                } finally {
                  cfg.saving = false;
                }
              }}
            >
              Save defaults
            </button>
            <p class={hint}>{s.account.status?.configured ? "Hosted server defaults are managed by the operator. Choose your image model in Generate; local-provider config edits are unavailable here." : "API keys stay in your environment (OPENAI_API_KEY, QUIVER_API_KEY…) and are never sent to the browser."}</p>
          </>
        )}
      </section>
    </div>
  );
});
