import { createContextId, noSerialize, type NoSerialize } from "@builder.io/qwik";
import { connect, DEFAULT_API, type BasteClient } from "~/lib/api";
import type { DesignTokens, PersonaRecord } from "~/lib/api-types";
import { emptyHostedAccount, refreshHostedAccount, type HostedAccount } from "~/lib/notorganic";

export type StudioView = "persona" | "new" | "edit" | "tailor" | "decompose" | "remix" | "settings" | "projects";
export type PersonaTab = "fitting" | "tokens" | "generate" | "moodboard" | "brandkit" | "feedback" | "editor";

export interface Toast {
  id: number;
  msg: string;
  tone: "ok" | "error" | "info";
}

export interface StudioState {
  status: "connecting" | "live" | "demo";
  apiBase: string;
  client: NoSerialize<BasteClient>;
  personas: PersonaRecord[];
  tokens: Record<string, DesignTokens>;
  loading: boolean;
  selectedId: string;
  projectId: string;
  view: StudioView;
  tab: PersonaTab;
  toasts: Toast[];
  /** Mobile: wardrobe drawer open. */
  railOpen: boolean;
  account: HostedAccount;
}

export const StudioCtx = createContextId<StudioState>("baste.studio");

export const API_KEY = "baste_api_url";

export function initialState(): StudioState {
  return {
    status: "connecting",
    apiBase: DEFAULT_API,
    client: undefined,
    personas: [],
    tokens: {},
    loading: true,
    selectedId: "",
    projectId: "",
    view: "persona",
    tab: "fitting",
    toasts: [],
    railOpen: false,
    account: emptyHostedAccount(),
  };
}

let toastSeq = 0;
export function toast(s: StudioState, msg: string, tone: Toast["tone"] = "ok") {
  const id = ++toastSeq;
  s.toasts = [...s.toasts, { id, msg, tone }];
  setTimeout(() => {
    s.toasts = s.toasts.filter((t) => t.id !== id);
  }, tone === "error" ? 6000 : 3200);
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function connectStudio(s: StudioState, base: string) {
  if (s.status !== "connecting" && s.apiBase !== base) s.projectId = "";
  s.status = "connecting";
  s.apiBase = base;
  const client = await connect(base);
  s.client = noSerialize(client);
  s.status = client.mode;
  if (client.mode === "live") await refreshAccount(s);
  else s.account = emptyHostedAccount();
  await refreshPersonas(s);
}

export async function refreshAccount(s: StudioState) {
  const hadAccountStatus = s.account.status !== null;
  const previousIdentity = s.account.status?.profile?.did;
  await refreshHostedAccount(s.apiBase, s.account);
  s.client?.setCsrfToken?.(s.account.status?.csrfToken);
  if (previousIdentity !== s.account.status?.profile?.did) {
    if (hadAccountStatus) s.projectId = "";
    s.tokens = {};
    s.personas = [];
    await refreshPersonas(s);
  }
}

export async function refreshPersonas(s: StudioState) {
  const c = s.client;
  if (!c) return;
  if (s.account.status?.configured && (!s.account.status.authenticated || s.account.status.accessGranted !== true)) {
    s.personas = []; s.tokens = {}; s.selectedId = ""; s.projectId = ""; s.loading = false; return;
  }
  s.loading = true;
  try {
    const list = await c.listPersonas();
    s.personas = list;
    if (!s.selectedId || !list.some((p) => p.id === s.selectedId)) s.selectedId = list[0]?.id ?? "";
    await Promise.all(list.map((p) => loadTokens(s, p.id)));
  } catch (err) {
    toast(s, `Couldn't load personas: ${errMsg(err)}`, "error");
  } finally {
    s.loading = false;
  }
}

export async function loadTokens(s: StudioState, id: string, force = false) {
  const c = s.client;
  if (!c || (!force && s.tokens[id])) return;
  try {
    const t = await c.designTokens(id);
    s.tokens = { ...s.tokens, [id]: t };
  } catch {
    /* tokens are decoration in the rail; the workspace reports its own errors */
  }
}

export function selectPersona(s: StudioState, id: string, tab?: PersonaTab) {
  s.selectedId = id;
  s.view = "persona";
  if (tab) s.tab = tab;
  s.railOpen = false;
  syncUrl(s);
}

export function openView(s: StudioState, view: StudioView) {
  s.view = view;
  s.railOpen = false;
  syncUrl(s);
}

export function selectProject(s: StudioState, id: string) {
  s.projectId = id;
  openView(s, "projects");
}

export function syncUrl(s: StudioState) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.search = "";
  if (s.view === "persona") {
    if (s.selectedId) u.searchParams.set("persona", s.selectedId);
    if (s.tab !== "fitting") u.searchParams.set("tab", s.tab);
  } else if (s.view === "new") u.searchParams.set("new", "1");
  else {
    u.searchParams.set("flow", s.view);
    if (s.view === "projects" && s.projectId) u.searchParams.set("project", s.projectId);
  }
  window.history.replaceState(null, "", u.toString());
}

export const REQUIRES_SERVER = "Needs the local Baste server";
