import { useLocale } from "~/i18n/provider";
import { text } from "~/i18n/runtime";
import { component$, useContextProvider, useStore, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import {
  API_KEY,
  StudioCtx,
  connectStudio,
  initialState,
  toast,
  type PersonaTab,
  type StudioView,
} from "~/components/studio/context";
import { Topbar } from "~/components/studio/topbar";
import { Rail } from "~/components/studio/rail";
import { Toasts } from "~/components/studio/toasts";
import { Workspace } from "~/components/studio/workspace";
import { PersonaForm } from "~/components/studio/flows/persona-form";
import { DecomposeFlow } from "~/components/studio/flows/decompose";
import { RemixFlow } from "~/components/studio/flows/remix";
import { SettingsFlow } from "~/components/studio/flows/settings";
import { ProjectsFlow } from "~/components/studio/flows/projects";
import { DEFAULT_API } from "~/lib/api";
import { AccountSection } from "~/components/studio/flows/account";
import { needsAccountOnboarding } from "~/lib/notorganic";
import { accountCopy } from "~/lib/account-copy";

const TABS: PersonaTab[] = ["fitting", "tokens", "generate", "moodboard", "brandkit", "feedback", "editor"];
const FLOWS: StudioView[] = ["decompose", "remix", "settings", "tailor", "projects"];

export default component$(() => {
  const locale = useLocale();
  const state = useStore(initialState(), { deep: true });
  useContextProvider(StudioCtx, state);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const q = new URLSearchParams(window.location.search);
    const tab = q.get("tab") as PersonaTab | null;
    const flow = q.get("flow") as StudioView | null;
    if (q.get("persona")) state.selectedId = q.get("persona")!;
    if (q.get("project")) state.projectId = q.get("project")!;
    if (tab && TABS.includes(tab)) state.tab = tab;
    if (q.get("new")) state.view = "new";
    else if (flow && FLOWS.includes(flow)) state.view = flow;

    let base = DEFAULT_API;
    try {
      base = localStorage.getItem(API_KEY) || DEFAULT_API;
    } catch {
      /* storage unavailable — use the default */
    }
    await connectStudio(state, base);
    if (q.get("account") === "connected") toast(state, accountCopy[locale.value].connectedToast);
    if (q.get("account") === "onboarding") toast(state, accountCopy[locale.value].onboardingToast, "info");
    if (q.get("account") === "error") toast(state, accountCopy[locale.value].accountError, "error");
    if (q.get("payment") === "returned") toast(state, "Returned from checkout. Refresh your wallet to confirm available credit.", "info");
    if (q.has("account") || q.has("payment")) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("account");
      clean.searchParams.delete("reason");
      clean.searchParams.delete("payment");
      window.history.replaceState(null, "", clean);
    }
  });

  const accountViewKey = `${state.apiBase}:${state.account.status?.profile?.did ?? "local"}`;
  const projectViewKey = `${accountViewKey}:${state.status}:${state.account.status?.configured}:${state.account.status?.authenticated}:${state.account.status?.csrfToken ?? ""}`;

  return (
    <div class={css({ minH: "100dvh", display: "flex", flexDirection: "column" })}>
      <a href="#studio-main" class="skip-link">{text(locale.value, "Skip to workspace")}</a>
      <Topbar />
      <div
        class={css({
          flex: 1,
          display: "grid",
          gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "272px minmax(0, 1fr)" },
          minH: 0,
          // the rail is sticky; carry its paper + seam down the full column
          bgImage: { lg: "linear-gradient(90deg, token(colors.paper) 0 271px, token(colors.rule) 271px 272px, transparent 272px)" },
        })}
      >
        <Rail />
        <main id="studio-main" class={css({ minW: 0, px: { base: 4, md: 8 }, py: { base: 5, md: 8 } })}>
          {needsAccountOnboarding(state.account.status) ? <AccountSection /> : <>
          {state.view === "persona" && <Workspace key={accountViewKey} />}
          {(state.view === "new" || state.view === "edit" || state.view === "tailor") && <PersonaForm key={`${accountViewKey}:${state.view}-${state.selectedId}`} />}
          {state.view === "decompose" && <DecomposeFlow key={accountViewKey} />}
          {state.view === "remix" && <RemixFlow key={accountViewKey} />}
          {state.view === "settings" && <SettingsFlow key={accountViewKey} />}
          {state.view === "projects" && <ProjectsFlow key={projectViewKey} />}
          </>}
        </main>
      </div>
      <Toasts />
    </div>
  );
});

export const head: DocumentHead = {
  title: "Studio — Baste",
  meta: [{ name: "description", content: "Fit personas, draft tokens, generate assets and keep a moodboard — the Baste Studio." }],
};
