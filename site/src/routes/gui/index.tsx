import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { flex, grid, hstack, vstack } from "styled-system/patterns";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { BasteLogo } from "~/components/layout/baste-logo";

const DEFAULT_API = "http://localhost:3456/api";

type Tab =
  | "personas" | "brandkit" | "moodboard" | "decompose"
  | "remix"    | "create"   | "generate"  | "rank"
  | "tokens"   | "editor"   | "feedback"  | "config";

interface OpenPencilToken {
  id: string;
  name: string;
  type: "color" | "font" | "spacing" | "radius" | "shadow" | "duration" | "easing";
  value: string;
  description?: string;
  category: string;
}
interface OpenPencilDoc {
  version: string;
  type: string;
  metadata: { personaId: string; personaName: string; exportedAt: number; basteVersion: string };
  tokens: OpenPencilToken[];
  pages: unknown[];
  culturalContext: { references: unknown[]; rationale: string };
  components: unknown[];
}
interface FeedbackSummary {
  total: number;
  positive: number;
  negative: number;
  topUpTags: Array<{ tag: string; count: number }>;
  topDownTags: Array<{ tag: string; count: number }>;
  recent: Array<{ score: number; feedback: string; assetId?: string; ts: number; tags?: string[] }>;
  document: string;
}

// ─── Shared types ────────────────────────────────────────────────────────────

interface PersonaShort {
  id: string; name: string; summary: string;
  _source?: string;
  aesthetic?: { colorTemperature?: string; density?: string };
}
interface BrandKit {
  sourceUrl: string; fetchedAt: string; title: string; description: string;
  palette: string[]; paletteRoles: Record<string, string | undefined>;
  fonts: string[]; fontFaces: Array<{ family: string; src?: string }>;
  logo?: string; ogImage?: string; background?: string;
  images: Array<{ url: string; alt?: string }>;
  signals: {
    borderRadiusAvg: number; hasGrid: boolean;
    bodyFontCategory: string; imageCount: number;
  };
}
interface Moodboard {
  personaId: string;
  references: Array<{ id: string; src: string; tags: string[]; pinned: boolean; addedAt: number }>;
  notes: string; vibe: string[];
}
interface ServerConfig {
  outputDir?: string; personaDir?: string;
  generators?: {
    image?: { provider?: string; model?: string };
    svg?: { provider?: string };
  };
  qd?: { iterations?: number; batchSize?: number; mutationRate?: number; qualityThreshold?: number };
  outputCount?: number;
  evaluator?: { model?: string };
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const drippyButton = (variant: "primary" | "secondary" | "ghost" | "danger" = "primary") => {
  const p = {
    primary:   { bg: "acid-lime",       color: "ink-black", border: "ink-black", hover: "neon-fuchsia",    hc: "off-white" },
    secondary: { bg: "electric-purple", color: "off-white", border: "ink-black", hover: "neon-fuchsia",    hc: "off-white" },
    ghost:     { bg: "transparent",     color: "acid-lime", border: "acid-lime", hover: "acid-lime",       hc: "ink-black" },
    danger:    { bg: "neon-fuchsia",    color: "off-white", border: "ink-black", hover: "danger",          hc: "off-white" },
  }[variant];
  return css({
    display: "inline-flex", alignItems: "center", gap: 2,
    px: 5, py: 2.5, rounded: "lg",
    bg: p.bg, color: p.color, fontSize: "sm", fontWeight: "bold",
    fontFamily: "graffiti", textTransform: "uppercase", letterSpacing: "0.04em",
    border: "2px solid", borderColor: p.border,
    boxShadow: "4px 5px 0 #0A0A0A", cursor: "pointer", transition: "all 0.15s",
    _hover: { bg: p.hover, color: p.hc, transform: "translate(-2px,-2px)", boxShadow: "6px 7px 0 #0A0A0A" },
    _active: { transform: "translate(2px,2px)", boxShadow: "0 0 0 #0A0A0A" },
    _disabled: { opacity: 0.4, cursor: "not-allowed" },
  });
};

const inputCls = css({
  w: "full", bg: "ink-black", border: "2px solid", borderColor: "electric-purple",
  color: "off-white", px: 3, py: 2, rounded: "md", fontSize: "sm", fontFamily: "mono",
  transition: "all 0.2s",
  _focus: { outline: "none", borderColor: "acid-lime", boxShadow: "0 0 12px rgba(198,255,0,0.5)" },
});
const labelCls = css({
  display: "block", fontSize: "xs", color: "acid-lime", mb: 1,
  textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold",
});
const sectionTitle = css({
  mt: 4, mb: 2, fontSize: "lg", fontWeight: "bold", fontFamily: "graffiti",
  color: "neon-fuchsia", textTransform: "uppercase", letterSpacing: "0.04em",
});
const checkRow = css({
  display: "flex", alignItems: "center", gap: 2,
  fontSize: "sm", color: "text-muted", cursor: "pointer",
});

const AESTHETIC_FIELDS = [
  { key: "colorTemperature", label: "Color Temperature", options: ["warm","cool","neutral","high-contrast","muted"] },
  { key: "density",          label: "Density",           options: ["minimal","dense","rich","maximalist"] },
  { key: "edgeStyle",        label: "Edge Style",        options: ["sharp","soft","organic","geometric","brutalist"] },
  { key: "motionStyle",      label: "Motion Style",      options: ["smooth","snappy","liquid","mechanical"] },
  { key: "typographyStyle",  label: "Typography",        options: ["clean","expressive","retro","futuristic","handcrafted"] },
  { key: "textureStyle",     label: "Texture",           options: ["flat","textured","noisy","clean","grainy"] },
  { key: "iconStyle",        label: "Icon Style",        options: ["line","filled","hand-drawn","geometric","abstract"] },
  { key: "layoutStyle",      label: "Layout",            options: ["grid","organic","asymmetric","brutalist","editorial"] },
];

const IMAGE_MODELS: Record<string, string[]> = {
  openai: ["gpt-image-2", "dall-e-3"],
  gemini: ["imagen-3.0-generate-002", "gemini-2.0-flash-preview-image-generation"],
};

// ─── Main component ───────────────────────────────────────────────────────────

export default component$(() => {
  // API base (from localStorage, settable in Config tab)
  const apiBase = useSignal(DEFAULT_API);

  const activeTab = useSignal<Tab>("personas");
  const toastMsg  = useSignal("");
  const toastType = useSignal("success");
  const toastShow = useSignal(false);

  const personas        = useSignal<PersonaShort[]>([]);
  const personasLoading = useSignal(true);

  // ── Persona form ────────────────────────────────────────────────────────────
  const editingId       = useSignal<string | null>(null);
  const pId             = useSignal("");
  const pName           = useSignal("");
  const pSummary        = useSignal("");
  const pRegion         = useSignal("");
  const pSubcultures    = useSignal("");
  const pValues         = useSignal("");
  const pFilms          = useSignal("");
  const pAnime          = useSignal("");
  const pMusicGenres    = useSignal("");
  const pMusicArtists   = useSignal("");
  const pVisualArtists  = useSignal("");
  const pSpaces         = useSignal("");
  const pObsessions     = useSignal("");
  const pInterfaceValues = useSignal("");
  const pPetPeeves      = useSignal("");
  const pColorTemp      = useSignal("high-contrast");
  const pDensity        = useSignal("maximalist");
  const pEdge           = useSignal("brutalist");
  const pMotion         = useSignal("snappy");
  const pTypography     = useSignal("expressive");
  const pTexture        = useSignal("noisy");
  const pIcon           = useSignal("hand-drawn");
  const pLayout         = useSignal("asymmetric");

  // ── Brand Kit ───────────────────────────────────────────────────────────────
  const bkSelected  = useSignal("");
  const bkData      = useSignal<BrandKit | null>(null);
  const bkLoading   = useSignal(false);
  const bkError     = useSignal("");

  // ── Moodboard ───────────────────────────────────────────────────────────────
  const mbSelected  = useSignal("");
  const mb          = useSignal<Moodboard>({ personaId: "", references: [], notes: "", vibe: [] });
  const mbNewSrc    = useSignal("");
  const mbNewTags   = useSignal("");

  // ── Decompose ───────────────────────────────────────────────────────────────
  const decUrl        = useSignal("");
  const decId         = useSignal("");
  const decName       = useSignal("");
  const decSeed       = useSignal(true);
  const decDeep       = useSignal(false);
  const decMirror     = useSignal(false);
  const decInit       = useSignal(false);
  const decRunning    = useSignal(false);
  const decResult     = useSignal<{ persona: PersonaShort; brandKit: BrandKit } | null>(null);
  const decError      = useSignal("");

  // ── Remix ───────────────────────────────────────────────────────────────────
  const rxA       = useSignal("");
  const rxB       = useSignal("");
  const rxId      = useSignal("");
  const rxName    = useSignal("");
  const rxRunning = useSignal(false);
  const rxResult  = useSignal("");

  // ── Generate ────────────────────────────────────────────────────────────────
  const genSelected    = useSignal("");
  const genType        = useSignal("suite");
  const genDryRun      = useSignal(false);
  const genProvider    = useSignal("openai");
  const genModel       = useSignal("gpt-image-2");
  const genRunning     = useSignal(false);
  const genLogs        = useSignal<string[]>([]);
  const genJobStatus   = useSignal("");
  const genJobs        = useSignal<Array<{ id: string; personaId: string; type: string; status: string }>>([]);

  // ── Tokens ──────────────────────────────────────────────────────────────────
  const tokSelected = useSignal("");
  const tokFormat   = useSignal("css");
  const tokContent  = useSignal("");
  const tokLoading  = useSignal(false);

  // ── Rank ────────────────────────────────────────────────────────────────────
  const rankSelected = useSignal("");
  const rankStats    = useSignal<{
    total: number; positive: number; negative: number; score: number;
    trend: number[]; recent: Array<{ assetId: string; score: number; feedback: string; ts: number }>;
  }>({ total: 0, positive: 0, negative: 0, score: 0, trend: [], recent: [] });
  const rankAssetId  = useSignal("");
  const rankFeedback = useSignal("");

  // ── Split / QuiverAI ────────────────────────────────────────────────────────
  const splitSrc   = useSignal("");
  const splitCols  = useSignal(4);
  const splitRows  = useSignal(4);
  const splitCells = useSignal<Array<{ id: string; x: number; y: number; w: number; h: number; src: string }>>([]);

  // ── OpenPencil editor ───────────────────────────────────────────────────────
  const opSelected   = useSignal("");
  const opDoc        = useSignal<OpenPencilDoc | null>(null);
  const opLoading    = useSignal(false);
  const opSaving     = useSignal(false);
  const opWatching   = useSignal(false);
  const opFilePath   = useSignal("");
  const opWebviewUrl = useSignal("https://openpencil.app");
  const opShowWebview = useSignal(false);

  // ── Feedback ────────────────────────────────────────────────────────────────
  const fbSelected = useSignal("");
  const fbData     = useSignal<FeedbackSummary | null>(null);
  const fbLoading  = useSignal(false);

  // ── Config ──────────────────────────────────────────────────────────────────
  const cfgApiUrl     = useSignal(DEFAULT_API);
  const cfgData       = useSignal<ServerConfig>({});
  const cfgSaving     = useSignal(false);
  const cfgImgProvider = useSignal("openai");
  const cfgImgModel    = useSignal("gpt-image-2");

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = $((msg: string, type = "success") => {
    toastMsg.value = msg; toastType.value = type; toastShow.value = true;
    setTimeout(() => (toastShow.value = false), 3500);
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const loadPersonas = $(() => {
    personasLoading.value = true;
    fetch(apiBase.value + "/personas")
      .then((r) => r.json())
      .then((d) => { personas.value = d; personasLoading.value = false; })
      .catch(() => { personasLoading.value = false; });
  });

  const loadBrandKit = $((id: string) => {
    if (!id) return;
    bkLoading.value = true; bkError.value = "";
    fetch(apiBase.value + "/brandkit/" + encodeURIComponent(id))
      .then((r) => { if (!r.ok && r.status === 404) throw new Error("not_found"); return r.json(); })
      .then((d) => { bkData.value = d; bkLoading.value = false; })
      .catch((e) => {
        bkData.value = null; bkLoading.value = false;
        bkError.value = e.message === "not_found"
          ? "No brand kit found for this persona. Run Decompose on a URL to extract one."
          : "Failed to load brand kit.";
      });
  });

  const loadMoodboard = $((id: string) => {
    if (!id) return;
    fetch(apiBase.value + "/moodboard/" + encodeURIComponent(id))
      .then((r) => r.json())
      .then((d) => { mb.value = d; })
      .catch(() => {});
  });

  const loadRanks = $((id: string) => {
    if (!id) return;
    fetch(apiBase.value + "/rank/" + encodeURIComponent(id))
      .then((r) => r.json())
      .then((d) => { rankStats.value = d; })
      .catch(() => {});
  });

  const loadTokens = $((id: string, fmt: string) => {
    if (!id) return;
    tokLoading.value = true;
    fetch(apiBase.value + "/tokens/" + id, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: fmt }),
    })
      .then((r) => r.json())
      .then((d) => { tokContent.value = d.content ?? ""; tokLoading.value = false; })
      .catch(() => { tokLoading.value = false; });
  });

  const loadServerConfig = $(() => {
    fetch(apiBase.value + "/config")
      .then((r) => r.json())
      .then((d: ServerConfig) => {
        cfgData.value = d;
        cfgImgProvider.value = d.generators?.image?.provider ?? "openai";
        cfgImgModel.value = d.generators?.image?.model ?? "gpt-image-2";
      })
      .catch(() => {});
  });

  useVisibleTask$(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("baste_api_url") : null;
    if (stored) { apiBase.value = stored; cfgApiUrl.value = stored; }
    loadPersonas();
    fetch(apiBase.value + "/jobs")
      .then((r) => r.json()).then((d) => { genJobs.value = d; }).catch(() => {});
    loadServerConfig();
  });

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const resetForm = $(() => {
    pId.value = ""; pName.value = ""; pSummary.value = "";
    pRegion.value = ""; pSubcultures.value = ""; pValues.value = "";
    pFilms.value = ""; pAnime.value = ""; pMusicGenres.value = "";
    pMusicArtists.value = ""; pVisualArtists.value = "";
    pSpaces.value = ""; pObsessions.value = "";
    pInterfaceValues.value = ""; pPetPeeves.value = "";
    pColorTemp.value = "high-contrast"; pDensity.value = "maximalist";
    pEdge.value = "brutalist"; pMotion.value = "snappy";
    pTypography.value = "expressive"; pTexture.value = "noisy";
    pIcon.value = "hand-drawn"; pLayout.value = "asymmetric";
    editingId.value = null;
  });

  const fillForm = $((p: any) => {
    pId.value = p.id; pName.value = p.name; pSummary.value = p.summary ?? "";
    pRegion.value = p.culture?.region ?? "";
    pSubcultures.value = (p.culture?.subcultures ?? []).join(", ");
    pValues.value = (p.culture?.values ?? []).join(", ");
    pFilms.value = (p.influences?.films ?? []).join(", ");
    pAnime.value = (p.influences?.anime ?? []).join(", ");
    pMusicGenres.value = (p.influences?.music?.genres ?? []).join(", ");
    pMusicArtists.value = (p.influences?.music?.artists ?? []).join(", ");
    pVisualArtists.value = (p.influences?.visualArtists ?? []).join(", ");
    pSpaces.value = (p.influences?.spaces ?? []).join(", ");
    pObsessions.value = (p.influences?.obsessions ?? []).join(", ");
    pInterfaceValues.value = (p.behaviors?.interfaceValues ?? []).join(", ");
    pPetPeeves.value = (p.behaviors?.petPeeves ?? []).join(", ");
    pColorTemp.value = p.aesthetic?.colorTemperature ?? "high-contrast";
    pDensity.value = p.aesthetic?.density ?? "maximalist";
    pEdge.value = p.aesthetic?.edgeStyle ?? "brutalist";
    pMotion.value = p.aesthetic?.motionStyle ?? "snappy";
    pTypography.value = p.aesthetic?.typographyStyle ?? "expressive";
    pTexture.value = p.aesthetic?.textureStyle ?? "noisy";
    pIcon.value = p.aesthetic?.iconStyle ?? "hand-drawn";
    pLayout.value = p.aesthetic?.layoutStyle ?? "asymmetric";
  });

  const savePersona = $(() => {
    const split = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
    if (!pId.value.trim()) { showToast("ID is required", "error"); return; }
    const persona = {
      id: pId.value.trim(),
      name: pName.value.trim() || pId.value.trim(),
      summary: pSummary.value.trim(),
      culture: { region: pRegion.value.trim() || undefined, subcultures: split(pSubcultures.value), values: split(pValues.value) },
      influences: {
        films: split(pFilms.value), shows: [], anime: split(pAnime.value),
        music: { genres: split(pMusicGenres.value), artists: split(pMusicArtists.value) },
        games: [], visualArtists: split(pVisualArtists.value), fashion: [],
        spaces: split(pSpaces.value), tools: [], obsessions: split(pObsessions.value),
      },
      behaviors: { discovery: [], interfaceValues: split(pInterfaceValues.value), platforms: [], expression: [], petPeeves: split(pPetPeeves.value) },
      aesthetic: {
        colorTemperature: pColorTemp.value, density: pDensity.value, edgeStyle: pEdge.value,
        motionStyle: pMotion.value, typographyStyle: pTypography.value, textureStyle: pTexture.value,
        iconStyle: pIcon.value, layoutStyle: pLayout.value,
        visualKeywords: [...split(pFilms.value), ...split(pAnime.value), ...split(pVisualArtists.value)].slice(0, 8),
        moodKeywords: [...split(pValues.value), ...split(pInterfaceValues.value)].slice(0, 6),
      },
    };
    const url = editingId.value ? `${apiBase.value}/personas/${editingId.value}` : `${apiBase.value}/personas`;
    const method = editingId.value ? "PUT" : "POST";
    fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(persona) })
      .then((r) => { if (!r.ok) throw new Error(); showToast(editingId.value ? "Updated." : "Created."); resetForm(); activeTab.value = "personas"; loadPersonas(); })
      .catch(() => showToast("Save failed", "error"));
  });

  const deletePersona = $((id: string) => {
    if (!confirm(`Delete "${id}"?`)) return;
    fetch(`${apiBase.value}/personas/${id}`, { method: "DELETE" })
      .then(() => { showToast("Deleted"); loadPersonas(); })
      .catch(() => showToast("Delete failed", "error"));
  });

  // ── Generation ───────────────────────────────────────────────────────────────
  const startGeneration = $(() => {
    if (!genSelected.value) { showToast("Pick a persona first", "warn"); return; }
    genRunning.value = true; genLogs.value = []; genJobStatus.value = "running";
    fetch(`${apiBase.value}/generate/${genSelected.value}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: genType.value, dryRun: genDryRun.value,
        imageProvider: genProvider.value, imageModel: genModel.value,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        genLogs.value = [`>>> Job ${data.jobId} started`];
        const iv = setInterval(() => {
          fetch(`${apiBase.value}/jobs/${data.jobId}`)
            .then((r) => r.json())
            .then((job) => {
              genJobStatus.value = job.status;
              genLogs.value = job.logs ?? [];
              if (job.status === "completed" || job.status === "error") {
                clearInterval(iv); genRunning.value = false;
                if (job.status === "completed") showToast("Done. Make. Share. Slay.");
                else showToast(job.error ?? "Generation failed", "error");
                fetch(`${apiBase.value}/jobs`).then((r) => r.json()).then((d) => { genJobs.value = d; }).catch(() => {});
              }
            })
            .catch(() => { clearInterval(iv); genRunning.value = false; });
        }, 1500);
      })
      .catch((err) => { genRunning.value = false; genJobStatus.value = "error"; showToast(err.message, "error"); genLogs.value = [`Error: ${err.message}`]; });
  });

  const previewPrompts = $(() => {
    if (!genSelected.value) { showToast("Pick a persona first", "warn"); return; }
    fetch(`${apiBase.value}/prompts/${genSelected.value}`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        genLogs.value = [
          "── PROMPT PREVIEW ──",
          `IMG: ${(d.image?.prompt ?? "n/a").slice(0, 280)}`,
          `SVG: ${(d.svg?.prompt ?? "n/a").slice(0, 280)}`,
        ];
      })
      .catch(() => showToast("Preview failed", "error"));
  });

  // ── Moodboard actions ───────────────────────────────────────────────────────
  const addReference = $(() => {
    if (!mbSelected.value || !mbNewSrc.value) return;
    fetch(`${apiBase.value}/moodboard/${mbSelected.value}/reference`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src: mbNewSrc.value, tags: mbNewTags.value.split(",").map((s) => s.trim()).filter(Boolean) }),
    }).then(() => { mbNewSrc.value = ""; mbNewTags.value = ""; loadMoodboard(mbSelected.value); showToast("Added"); })
      .catch(() => showToast("Failed", "error"));
  });

  const togglePin = $((refId: string) => {
    const board = { ...mb.value, references: mb.value.references.map((r) => r.id === refId ? { ...r, pinned: !r.pinned } : r) };
    mb.value = board;
    fetch(`${apiBase.value}/moodboard/${mbSelected.value}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(board) });
  });

  const removeRef = $((refId: string) => {
    const board = { ...mb.value, references: mb.value.references.filter((r) => r.id !== refId) };
    mb.value = board;
    fetch(`${apiBase.value}/moodboard/${mbSelected.value}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(board) });
  });

  // ── Decompose ───────────────────────────────────────────────────────────────
  const runDecompose = $(() => {
    if (!decUrl.value) { showToast("Enter a URL", "error"); return; }
    decRunning.value = true; decError.value = ""; decResult.value = null;
    fetch(`${apiBase.value}/decompose`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: decUrl.value, id: decId.value || undefined, name: decName.value || undefined,
        seedMoodboard: decSeed.value, deep: decDeep.value,
        mirrorAssets: decMirror.value, initVersioning: decInit.value,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        decResult.value = d;
        decRunning.value = false;
        showToast(`Decomposed → ${d.persona.id}`);
        loadPersonas();
      })
      .catch((err) => { decRunning.value = false; decError.value = err.message ?? "Decompose failed"; showToast(decError.value, "error"); });
  });

  // ── Remix ───────────────────────────────────────────────────────────────────
  const runRemix = $(() => {
    if (!rxA.value || !rxB.value || !rxId.value) { showToast("Need A, B, and new ID", "warn"); return; }
    rxRunning.value = true;
    fetch(`${apiBase.value}/remix`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: rxA.value, b: rxB.value, id: rxId.value, name: rxName.value || undefined }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        rxRunning.value = false; rxResult.value = `Created: ${d.persona?.name ?? rxId.value}`;
        showToast(`Remixed → ${rxId.value}`); loadPersonas();
      })
      .catch((err) => { rxRunning.value = false; showToast(err.message, "error"); });
  });

  // ── Rank ────────────────────────────────────────────────────────────────────
  const submitRank = $((score: 1 | -1) => {
    if (!rankSelected.value || !rankAssetId.value) { showToast("Pick persona + asset", "warn"); return; }
    fetch(`${apiBase.value}/rank`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: rankAssetId.value, personaId: rankSelected.value, score, feedback: rankFeedback.value }),
    }).then(() => { rankFeedback.value = ""; loadRanks(rankSelected.value); showToast(score > 0 ? "Fire saved" : "Trash saved"); })
      .catch(() => showToast("Failed", "error"));
  });

  // ── Asset split ─────────────────────────────────────────────────────────────
  const splitImage = $(() => {
    if (!splitSrc.value) { showToast("Paste an image URL first", "warn"); return; }
    fetch(`${apiBase.value}/split`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src: splitSrc.value, cols: splitCols.value, rows: splitRows.value }),
    }).then((r) => r.json())
      .then((d) => { splitCells.value = d.cells ?? []; showToast(`Split into ${d.cells?.length ?? 0} regions`); })
      .catch(() => showToast("Split failed", "error"));
  });

  // ── OpenPencil actions ──────────────────────────────────────────────────────
  const loadOpenPencil = $((id: string) => {
    if (!id) return;
    opLoading.value = true;
    fetch(`${apiBase.value}/openpencil/${encodeURIComponent(id)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: OpenPencilDoc) => { opDoc.value = d; opLoading.value = false; })
      .catch(() => { opDoc.value = null; opLoading.value = false; showToast("Load failed", "error"); });
  });

  const saveOpenPencil = $(() => {
    if (!opSelected.value || !opDoc.value) return;
    opSaving.value = true;
    fetch(`${apiBase.value}/openpencil/${encodeURIComponent(opSelected.value)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: opDoc.value }),
    }).then((r) => r.json())
      .then((d) => {
        opSaving.value = false;
        if (d.error) throw new Error(d.error);
        showToast("Saved. Brand kit updated.");
      })
      .catch((err) => { opSaving.value = false; showToast(err.message ?? "Save failed", "error"); });
  });

  const exportOpenPencilFile = $(() => {
    if (!opSelected.value) return;
    fetch(`${apiBase.value}/openpencil/${encodeURIComponent(opSelected.value)}/file`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        opFilePath.value = d.path;
        opWatching.value = !!d.watching;
        showToast(`Wrote ${d.path}`);
      })
      .catch((err) => showToast(err.message ?? "Export failed", "error"));
  });

  const toggleOpenPencilWatch = $(() => {
    if (!opSelected.value) return;
    const next = !opWatching.value;
    fetch(`${apiBase.value}/openpencil/${encodeURIComponent(opSelected.value)}/watch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    }).then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        opWatching.value = !!d.watching;
        if (d.path) opFilePath.value = d.path;
        showToast(d.watching ? "Watching for external edits" : "Watch stopped");
      })
      .catch((err) => showToast(err.message ?? "Watch failed", "error"));
  });

  const updateToken = $((idx: number, value: string) => {
    if (!opDoc.value) return;
    const tokens = opDoc.value.tokens.slice();
    tokens[idx] = { ...tokens[idx], value };
    opDoc.value = { ...opDoc.value, tokens };
  });

  // ── Feedback ────────────────────────────────────────────────────────────────
  const loadFeedback = $((id: string) => {
    if (!id) return;
    fbLoading.value = true;
    fetch(`${apiBase.value}/feedback/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d: FeedbackSummary) => { fbData.value = d; fbLoading.value = false; })
      .catch(() => { fbData.value = null; fbLoading.value = false; showToast("Load failed", "error"); });
  });

  // ── Config save ──────────────────────────────────────────────────────────────
  const saveConfig = $(() => {
    // Update localStorage API URL
    if (typeof localStorage !== "undefined") localStorage.setItem("baste_api_url", cfgApiUrl.value);
    apiBase.value = cfgApiUrl.value;

    // Save generator prefs to server
    const patch: ServerConfig = {
      ...cfgData.value,
      generators: {
        ...cfgData.value.generators,
        image: { provider: cfgImgProvider.value, model: cfgImgModel.value },
      },
    };
    cfgSaving.value = true;
    fetch(`${apiBase.value}/config`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => { if (!r.ok) throw new Error(); cfgData.value = patch; cfgSaving.value = false; showToast("Config saved"); })
      .catch(() => { cfgSaving.value = false; showToast("Save failed", "error"); });
  });

  // ─── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: Array<{ id: Tab; label: string; emoji: string }> = [
    { id: "personas",  label: "Crew",       emoji: "✦" },
    { id: "brandkit",  label: "Brand Kit",  emoji: "✸" },
    { id: "moodboard", label: "Moodboard",  emoji: "✺" },
    { id: "decompose", label: "Decompose",  emoji: "◈" },
    { id: "remix",     label: "Remix",      emoji: "⟳" },
    { id: "create",    label: "Forge",      emoji: "✦" },
    { id: "generate",  label: "Generate",   emoji: "⚡" },
    { id: "rank",      label: "Rank",       emoji: "♥" },
    { id: "tokens",    label: "Tokens",     emoji: "▣" },
    { id: "editor",    label: "Editor",     emoji: "✎" },
    { id: "feedback",  label: "Feedback",   emoji: "♻" },
    { id: "config",    label: "Config",     emoji: "⚙" },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Nav />
      <main class={css({ pt: "84px", minH: "100vh", position: "relative" })}>
        {/* Header */}
        <div class={css({ position: "relative", mx: "auto", maxW: "7xl", px: 6, pt: 8, pb: 5, mb: 2, overflow: "hidden", rounded: "2xl", borderBottom: "2px solid token(colors.border)", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" })}>
          <div class="baste-bg-grid baste-bg-layer" style={{ opacity: 0.45 }} aria-hidden="true" />
          <div class={flex({ align: "center", justify: "space-between", wrap: "wrap", gap: 4 })}>
            <div class={hstack({ gap: 4 })}>
              <BasteLogo size={56} />
              <div>
                <h1 class={css({ fontFamily: "graffiti", fontSize: { base: "2xl", md: "4xl" }, lineHeight: 1, letterSpacing: "0.02em", textTransform: "uppercase" })}>
                  <span class="baste-drip-text" style={{ WebkitTextStroke: "2px #0A0A0A" }}>Baste Studio</span>
                </h1>
                <p class={css({ color: "text-muted", fontSize: "sm", mt: 1, maxW: "xl" })}>
                  Co-create brandkits, tokens, and custom SVGs. <span class={css({ color: "neon-fuchsia", fontWeight: "bold" })}>Make. Share. Slay.</span>
                </p>
              </div>
            </div>
            <div class={hstack({ gap: 2, fontSize: "xs", color: "text-muted" })}>
              <span class={css({ px: 2, py: 1, rounded: "sm", bg: "surface", border: "1px solid token(colors.electric-purple)" })}>
                API: {apiBase.value.replace("/api", "")}
              </span>
            </div>
          </div>

          {/* Tab strip — scrollable */}
          <div class={hstack({ gap: 1, mt: 5, p: 1.5, bg: "surface", rounded: "xl", border: "2px solid token(colors.electric-purple)", overflowX: "auto" })}>
            {tabs.map((t) => {
              const active = activeTab.value === t.id;
              return (
                <button
                  key={t.id}
                  onClick$={() => {
                    activeTab.value = t.id;
                    if (t.id === "create")    { resetForm(); editingId.value = null; }
                    if (t.id === "moodboard") { if (mbSelected.value) loadMoodboard(mbSelected.value); }
                    if (t.id === "config")    loadServerConfig();
                    if (t.id === "brandkit" && bkSelected.value) loadBrandKit(bkSelected.value);
                    if (t.id === "editor" && opSelected.value) loadOpenPencil(opSelected.value);
                    if (t.id === "feedback" && fbSelected.value) loadFeedback(fbSelected.value);
                  }}
                  class={css({
                    px: 3, py: 2, rounded: "lg", fontSize: "xs", fontWeight: "bold", fontFamily: "graffiti",
                    cursor: "pointer", border: "2px solid",
                    borderColor: active ? "ink-black" : "transparent",
                    bg: active ? "acid-lime" : "transparent",
                    color: active ? "ink-black" : "text-muted",
                    textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
                    boxShadow: active ? "3px 4px 0 #0A0A0A" : "none",
                    transition: "all 0.15s",
                    _hover: { color: active ? "ink-black" : "neon-fuchsia" },
                  })}
                >
                  <span class={css({ mr: 1 })}>{t.emoji}</span>{t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div class={css({ mx: "auto", maxW: "7xl", px: 6, pb: 16 })}>

          {/* ══ CREW / PERSONAS ═══════════════════════════════════════════════════ */}
          {activeTab.value === "personas" && (
            <section>
              <div class={flex({ align: "center", justify: "space-between", mb: 5 })}>
                <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "neon-fuchsia", textTransform: "uppercase" })}>The Crew</h2>
                <div class={hstack({ gap: 2 })}>
                  <button onClick$={loadPersonas} class={drippyButton("ghost")}>↻ Refresh</button>
                  <button onClick$={() => { resetForm(); activeTab.value = "create"; }} class={drippyButton("primary")}>+ New Persona</button>
                </div>
              </div>
              {personasLoading.value && personas.value.length === 0 && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 12 })}>Loading the crew…</div>
              )}
              {!personasLoading.value && personas.value.length === 0 && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 12 })}>No personas yet. Forge one or decompose a site!</div>
              )}
              <div class={grid({ columns: { base: 1, md: 2, lg: 3 }, gap: 5 })}>
                {personas.value.map((p, idx) => {
                  const accents = ["acid-lime", "electric-purple", "neon-fuchsia", "cyan-burst", "melt-orange"];
                  const accent = accents[idx % accents.length];
                  return (
                    <div key={p.id} class={css({
                      bg: "surface", rounded: "xl", p: 5, position: "relative",
                      border: "2px solid", borderColor: "ink-black",
                      boxShadow: `5px 6px 0 token(colors.${accent})`,
                      transition: "all 0.2s",
                      _hover: { transform: "translate(-3px,-3px)", boxShadow: `8px 9px 0 token(colors.${accent})` },
                    })}>
                      <div class={flex({ align: "center", justify: "space-between", mb: 3 })}>
                        <h3 class={css({ fontFamily: "graffiti", fontWeight: "bold", fontSize: "xl", textTransform: "uppercase" })}>{p.name}</h3>
                        <span class={css({ fontSize: "xs", px: 2, py: 0.5, rounded: "sm", bg: p._source === "base" ? "radioactive" : "melt-orange", color: "ink-black", fontWeight: "bold", textTransform: "uppercase" })}>{p._source ?? "base"}</span>
                      </div>
                      <p class={css({ color: "text-muted", fontSize: "sm", mb: 4, minH: "2.5em" })}>{p.summary || "No summary"}</p>
                      <div class={flex({ gap: 2, mb: 4, wrap: "wrap" })}>
                        {p.aesthetic?.colorTemperature && <span class={css({ fontSize: "xs", px: 2, py: 0.5, rounded: "sm", bg: "electric-purple", color: "off-white", fontWeight: "bold" })}>{p.aesthetic.colorTemperature}</span>}
                        {p.aesthetic?.density && <span class={css({ fontSize: "xs", px: 2, py: 0.5, rounded: "sm", bg: "neon-fuchsia", color: "off-white", fontWeight: "bold" })}>{p.aesthetic.density}</span>}
                      </div>
                      <div class={flex({ gap: 2, wrap: "wrap" })}>
                        <button onClick$={() => { genSelected.value = p.id; activeTab.value = "generate"; }} class={drippyButton("primary")}>⚡ Gen</button>
                        <button onClick$={() => { bkSelected.value = p.id; loadBrandKit(p.id); activeTab.value = "brandkit"; }} class={drippyButton("secondary")}>✸ Kit</button>
                        <button onClick$={() => { mbSelected.value = p.id; loadMoodboard(p.id); activeTab.value = "moodboard"; }} class={drippyButton("ghost")}>✺ Mood</button>
                        <button onClick$={() => { tokSelected.value = p.id; loadTokens(p.id, tokFormat.value); activeTab.value = "tokens"; }} class={drippyButton("ghost")}>▣ Tok</button>
                        {p._source !== "base" && (
                          <>
                            <button onClick$={() => { fetch(`${apiBase.value}/personas/${p.id}`).then((r) => r.json()).then((d) => { fillForm(d); editingId.value = p.id; activeTab.value = "create"; }); }} class={drippyButton("ghost")}>Edit</button>
                            <button onClick$={() => deletePersona(p.id)} class={drippyButton("danger")}>Del</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ══ BRAND KIT ═════════════════════════════════════════════════════════ */}
          {activeTab.value === "brandkit" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "acid-lime", textTransform: "uppercase", mb: 4 })}>Brand Kit</h2>
              <p class={css({ color: "text-muted", fontSize: "sm", mb: 5, maxW: "3xl" })}>
                Extracted palette, fonts, logo, and visual signals from a decomposed site. Each persona gets its own kit.
              </p>

              <div class={css({ mb: 6, maxW: "sm" })}>
                <label class={labelCls}>Persona</label>
                <select
                  value={bkSelected.value}
                  onChange$={(e) => { bkSelected.value = (e.target as HTMLSelectElement).value; loadBrandKit(bkSelected.value); }}
                  class={inputCls}
                >
                  <option value="">— Choose a persona —</option>
                  {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {bkLoading.value && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 12 })}>Loading brand kit…</div>
              )}

              {!bkLoading.value && bkError.value && (
                <div class={css({ p: 5, rounded: "xl", bg: "surface", border: "2px solid token(colors.neon-fuchsia)", maxW: "xl" })}>
                  <p class={css({ color: "neon-fuchsia", fontWeight: "bold", mb: 2 })}>No brand kit</p>
                  <p class={css({ color: "text-muted", fontSize: "sm", mb: 4 })}>{bkError.value}</p>
                  <button
                    onClick$={() => { decId.value = bkSelected.value; activeTab.value = "decompose"; }}
                    class={drippyButton("primary")}
                  >◈ Go to Decompose</button>
                </div>
              )}

              {!bkLoading.value && bkData.value && (
                <div class={vstack({ gap: 6, alignItems: "stretch" })}>
                  {/* Source info */}
                  <div class={css({ p: 4, rounded: "lg", bg: "surface", border: "1px solid token(colors.electric-purple)", fontSize: "sm" })}>
                    <div class={flex({ gap: 4, wrap: "wrap" })}>
                      <span><span class={css({ color: "text-muted" })}>Source: </span><a href={bkData.value.sourceUrl} target="_blank" rel="noopener" class={css({ color: "acid-lime" })}>{bkData.value.sourceUrl}</a></span>
                      <span class={css({ color: "text-muted" })}>Fetched: {new Date(bkData.value.fetchedAt).toLocaleDateString()}</span>
                    </div>
                    {bkData.value.description && <p class={css({ color: "text-muted", mt: 2 })}>{bkData.value.description}</p>}
                  </div>

                  <div class={grid({ columns: { base: 1, lg: 2 }, gap: 6 })}>
                    {/* Palette */}
                    <div class={css({ p: 5, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.acid-lime)" })}>
                      <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "acid-lime", mb: 3 })}>Palette ({bkData.value.palette.length} colors)</div>
                      <div class={flex({ gap: 2, wrap: "wrap", mb: 3 })}>
                        {bkData.value.palette.map((hex) => (
                          <div key={hex} title={hex} style={{ background: hex, width: "36px", height: "36px", borderRadius: "6px", border: "2px solid #0A0A0A", flexShrink: 0 }} />
                        ))}
                      </div>
                      {/* Palette roles */}
                      <div class={grid({ columns: 2, gap: 1 })}>
                        {Object.entries(bkData.value.paletteRoles).filter(([, v]) => v).map(([role, hex]) => (
                          <div key={role} class={flex({ align: "center", gap: 2 })}>
                            <div style={{ background: hex as string, width: "14px", height: "14px", borderRadius: "3px", border: "1px solid #0A0A0A", flexShrink: 0 }} />
                            <span class={css({ fontSize: "xs", color: "text-muted" })}>{role}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fonts & Signals */}
                    <div class={css({ p: 5, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.electric-purple)" })}>
                      <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "electric-purple", mb: 3 })}>Typography</div>
                      {bkData.value.fonts.length === 0
                        ? <p class={css({ color: "text-muted", fontSize: "sm" })}>No custom fonts detected.</p>
                        : bkData.value.fonts.map((f) => (
                          <div key={f} class={css({ fontFamily: "mono", fontSize: "sm", color: "acid-lime", mb: 1 })}>{f}</div>
                        ))
                      }
                      <div class={css({ mt: 4, fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "electric-purple", mb: 2 })}>Visual Signals</div>
                      <div class={grid({ columns: 2, gap: 1 })}>
                        <SignalRow label="Border radius" value={`${bkData.value.signals.borderRadiusAvg.toFixed(1)}px avg`} />
                        <SignalRow label="Layout" value={bkData.value.signals.hasGrid ? "grid" : "non-grid"} />
                        <SignalRow label="Body font" value={bkData.value.signals.bodyFontCategory} />
                        <SignalRow label="Images" value={String(bkData.value.signals.imageCount)} />
                      </div>
                    </div>

                    {/* Logo / OG */}
                    {(bkData.value.logo || bkData.value.ogImage) && (
                      <div class={css({ p: 5, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.neon-fuchsia)" })}>
                        <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "neon-fuchsia", mb: 3 })}>Logo / OG</div>
                        <div class={flex({ gap: 3, wrap: "wrap" })}>
                          {bkData.value.logo && (
                            <div>
                              <div class={css({ fontSize: "10px", color: "text-muted", mb: 1 })}>Logo</div>
                              <img src={`${apiBase.value.replace("/api", "")}/api/proxy?url=${encodeURIComponent(bkData.value.logo)}`} alt="logo" class={css({ maxH: "60px", maxW: "120px", objectFit: "contain", bg: "off-white", p: 1, rounded: "md" })} />
                            </div>
                          )}
                          {bkData.value.ogImage && (
                            <div>
                              <div class={css({ fontSize: "10px", color: "text-muted", mb: 1 })}>OG Image</div>
                              <img src={`${apiBase.value.replace("/api", "")}/api/proxy?url=${encodeURIComponent(bkData.value.ogImage)}`} alt="og" class={css({ maxH: "80px", maxW: "160px", objectFit: "cover", rounded: "md", border: "1px solid token(colors.border)" })} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Image inventory */}
                    {bkData.value.images.length > 0 && (
                      <div class={css({ p: 5, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.cyan-burst)" })}>
                        <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "cyan-burst", mb: 3 })}>
                          Image Inventory ({bkData.value.images.length})
                        </div>
                        <div class={grid({ columns: 4, gap: 2 })}>
                          {bkData.value.images.slice(0, 16).map((img, i) => (
                            <a key={i} href={img.url} target="_blank" rel="noopener" title={img.alt ?? img.url}>
                              <img
                                src={`${apiBase.value.replace("/api", "")}/api/proxy?url=${encodeURIComponent(img.url)}`}
                                alt={img.alt ?? ""}
                                loading="lazy"
                                class={css({ w: "full", aspectRatio: "1", objectFit: "cover", rounded: "md", border: "1px solid token(colors.border)", bg: "ink-black" })}
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ══ MOODBOARD ══════════════════════════════════════════════════════════ */}
          {activeTab.value === "moodboard" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "acid-lime", textTransform: "uppercase", mb: 4 })}>Moodboard</h2>
              <p class={css({ color: "text-muted", fontSize: "sm", mb: 5, maxW: "3xl" })}>
                Drop image URLs to teach Baste your aesthetic DNA. Pinned references are the primary inspiration for generation.
              </p>
              <div class={grid({ columns: { base: 1, md: 3 }, gap: 4, mb: 5 })}>
                <div>
                  <label class={labelCls}>Persona</label>
                  <select value={mbSelected.value} onChange$={(e) => { mbSelected.value = (e.target as HTMLSelectElement).value; loadMoodboard(mbSelected.value); }} class={inputCls}>
                    <option value="">— Pick crew member —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Image URL or data URI</label>
                  <input value={mbNewSrc.value} onInput$={(e) => { mbNewSrc.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="https://…" />
                </div>
                <div class={flex({ direction: "column" })}>
                  <label class={labelCls}>Tags (comma)</label>
                  <div class={hstack({ gap: 2 })}>
                    <input value={mbNewTags.value} onInput$={(e) => { mbNewTags.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="neon, rebel" />
                    <button onClick$={addReference} class={drippyButton("primary")}>Pin it</button>
                  </div>
                </div>
              </div>

              {/* Vibe palette from decompose */}
              {mb.value.vibe.length > 0 && (
                <div class={css({ mb: 5 })}>
                  <div class={css({ fontSize: "xs", color: "text-muted", mb: 2, textTransform: "uppercase" })}>Extracted vibe</div>
                  <div class={flex({ gap: 2, wrap: "wrap" })}>
                    {mb.value.vibe.map((hex) => (
                      <div key={hex} title={hex} style={{ background: hex, width: "28px", height: "28px", borderRadius: "4px", border: "1px solid #0A0A0A" }} />
                    ))}
                  </div>
                </div>
              )}

              {mbSelected.value && mb.value.references.length === 0 && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 12, border: "2px dashed", borderColor: "electric-purple", rounded: "xl" })}>
                  No references yet. Paste a URL above or decompose a site to seed automatically.
                </div>
              )}
              <div class={grid({ columns: { base: 2, md: 3, lg: 4 }, gap: 4 })}>
                {mb.value.references.map((ref) => (
                  <div key={ref.id} class={css({
                    position: "relative", rounded: "xl", overflow: "hidden",
                    border: "3px solid", borderColor: ref.pinned ? "acid-lime" : "ink-black",
                    boxShadow: ref.pinned ? "0 0 24px rgba(198,255,0,0.45)" : "4px 5px 0 #0A0A0A",
                    aspectRatio: "1", bg: "surface",
                  })}>
                    <img src={ref.src} alt="ref" class={css({ w: "full", h: "full", objectFit: "cover" })} />
                    <div class={css({ position: "absolute", inset: 0, display: "flex", flexDir: "column", justifyContent: "space-between", p: 2, bg: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.85) 100%)" })}>
                      <div class={flex({ justify: "space-between" })}>
                        <button onClick$={() => togglePin(ref.id)} class={css({ px: 2, py: 1, rounded: "sm", bg: ref.pinned ? "acid-lime" : "ink-black", color: ref.pinned ? "ink-black" : "off-white", fontSize: "xs", fontWeight: "bold", border: "none", cursor: "pointer" })}>{ref.pinned ? "★ PIN" : "☆ pin"}</button>
                        <button onClick$={() => removeRef(ref.id)} class={css({ px: 2, py: 1, rounded: "sm", bg: "neon-fuchsia", color: "off-white", fontSize: "xs", fontWeight: "bold", border: "none", cursor: "pointer" })}>✕</button>
                      </div>
                      <div class={flex({ gap: 1, wrap: "wrap" })}>
                        {ref.tags.map((t) => <span key={t} class={css({ fontSize: "10px", px: 1.5, py: 0.5, rounded: "sm", bg: "electric-purple", color: "off-white", fontWeight: "bold" })}>#{t}</span>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Asset splitter */}
              {mbSelected.value && (
                <div class={css({ mt: 8, p: 5, bg: "surface", rounded: "xl", border: "2px solid token(colors.cyan-burst)" })}>
                  <h3 class={sectionTitle}>Asset Splitter → QuiverAI Remake</h3>
                  <p class={css({ color: "text-muted", fontSize: "sm", mb: 4 })}>
                    Drop a sheet image, slice into a grid. Each cell can be ranked and fed to QuiverAI for re-render.
                  </p>
                  <div class={grid({ columns: { base: 1, md: 4 }, gap: 3, mb: 4 })}>
                    <div class={css({ gridColumn: { md: "span 2" } })}>
                      <label class={labelCls}>Sheet URL</label>
                      <input value={splitSrc.value} onInput$={(e) => { splitSrc.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="https://…/sprite-sheet.png" />
                    </div>
                    <div>
                      <label class={labelCls}>Cols</label>
                      <input type="number" min={1} max={10} value={splitCols.value} onInput$={(e) => { splitCols.value = parseInt((e.target as HTMLInputElement).value) || 4; }} class={inputCls} />
                    </div>
                    <div>
                      <label class={labelCls}>Rows</label>
                      <input type="number" min={1} max={10} value={splitRows.value} onInput$={(e) => { splitRows.value = parseInt((e.target as HTMLInputElement).value) || 4; }} class={inputCls} />
                    </div>
                  </div>
                  <button onClick$={splitImage} class={drippyButton("secondary")}>✂ Split & extract</button>
                  {splitCells.value.length > 0 && (
                    <div class={grid({ columns: { base: 4, md: splitCols.value as any }, gap: 2, mt: 4 })}>
                      {splitCells.value.map((c) => (
                        <div key={c.id} class={css({ position: "relative", aspectRatio: "1", overflow: "hidden", border: "2px solid token(colors.acid-lime)", rounded: "md" })}>
                          <div style={{ backgroundImage: `url(${c.src})`, backgroundSize: `${100 * splitCols.value}% ${100 * splitRows.value}%`, backgroundPosition: `${(c.x / (1 - c.w || 1)) * 100}% ${(c.y / (1 - c.h || 1)) * 100}%`, width: "100%", height: "100%" }} />
                          <button onClick$={() => { rankAssetId.value = c.id; rankSelected.value = mbSelected.value; activeTab.value = "rank"; }} class={css({ position: "absolute", bottom: 1, right: 1, fontSize: "10px", px: 1.5, py: 0.5, bg: "acid-lime", color: "ink-black", border: "none", rounded: "sm", fontWeight: "bold", cursor: "pointer" })}>rank →</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ══ DECOMPOSE ══════════════════════════════════════════════════════════ */}
          {activeTab.value === "decompose" && (
            <section class={css({ maxW: "900px" })}>
              <div class={flex({ align: "center", justify: "space-between", mb: 4, wrap: "wrap", gap: 2 })}>
                <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "cyan-burst", textTransform: "uppercase" })}>Decompose a Site</h2>
                <button onClick$={runDecompose} disabled={decRunning.value} class={drippyButton("primary")}>
                  {decRunning.value ? "Decomposing…" : "◈ Run Decompose"}
                </button>
              </div>
              <p class={css({ color: "text-muted", fontSize: "sm", mb: 5 })}>
                Fetch a live URL and extract its palette, fonts, logo, and visual signals into a persona + brand kit.
              </p>

              <div class={grid({ gap: 4 })}>
                <div>
                  <label class={labelCls}>URL *</label>
                  <input
                    value={decUrl.value}
                    onInput$={(e) => { decUrl.value = (e.target as HTMLInputElement).value; }}
                    class={inputCls}
                    placeholder="https://example.com"
                    type="url"
                  />
                </div>
                <div class={grid({ columns: { base: 1, md: 2 }, gap: 4 })}>
                  <div>
                    <label class={labelCls}>Persona ID (optional)</label>
                    <input value={decId.value} onInput$={(e) => { decId.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="auto from hostname" />
                  </div>
                  <div>
                    <label class={labelCls}>Display Name (optional)</label>
                    <input value={decName.value} onInput$={(e) => { decName.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="auto from &lt;title&gt;" />
                  </div>
                </div>
                <div class={grid({ columns: { base: 1, md: 2 }, gap: 3 })}>
                  <label class={checkRow}>
                    <input type="checkbox" checked={decSeed.value} onChange$={(e) => { decSeed.value = (e.target as HTMLInputElement).checked; }} />
                    Seed moodboard with extracted images
                  </label>
                  <label class={checkRow}>
                    <input type="checkbox" checked={decDeep.value} onChange$={(e) => { decDeep.value = (e.target as HTMLInputElement).checked; }} />
                    Deep mode (Playwright — needs install)
                  </label>
                  <label class={checkRow}>
                    <input type="checkbox" checked={decMirror.value} onChange$={(e) => { decMirror.value = (e.target as HTMLInputElement).checked; }} />
                    Mirror assets to disk (logo, OG, thumbnails)
                  </label>
                  <label class={checkRow}>
                    <input type="checkbox" checked={decInit.value} onChange$={(e) => { decInit.value = (e.target as HTMLInputElement).checked; }} />
                    Init design versioning + cultural refs
                  </label>
                </div>
              </div>

              {decError.value && (
                <div class={css({ mt: 4, p: 4, rounded: "lg", bg: "surface", border: "2px solid token(colors.neon-fuchsia)", color: "neon-fuchsia", fontSize: "sm", fontFamily: "mono" })}>
                  Error: {decError.value}
                </div>
              )}

              {decResult.value && (
                <div class={css({ mt: 6, p: 5, rounded: "xl", bg: "surface", border: "2px solid token(colors.acid-lime)", boxShadow: "5px 6px 0 token(colors.acid-lime)" })}>
                  <h3 class={css({ fontFamily: "graffiti", fontSize: "xl", color: "acid-lime", textTransform: "uppercase", mb: 3 })}>
                    ✓ Decomposed → {decResult.value.persona.name}
                  </h3>
                  <div class={css({ fontSize: "sm", color: "text-muted", mb: 4 })}>
                    ID: <code class={css({ color: "acid-lime" })}>{decResult.value.persona.id}</code>
                    {" · "}{decResult.value.brandKit.images.length} images
                    {" · "}{decResult.value.brandKit.fonts.length} fonts
                    {" · "}{decResult.value.brandKit.palette.length} colors
                  </div>

                  {/* Palette */}
                  <div class={css({ mb: 4 })}>
                    <div class={css({ fontSize: "xs", color: "text-muted", mb: 2, textTransform: "uppercase" })}>Palette</div>
                    <div class={flex({ gap: 2, wrap: "wrap" })}>
                      {decResult.value.brandKit.palette.map((hex) => (
                        <div key={hex} title={hex} style={{ background: hex, width: "32px", height: "32px", borderRadius: "4px", border: "2px solid #0A0A0A" }} />
                      ))}
                    </div>
                  </div>

                  {/* Fonts */}
                  {decResult.value.brandKit.fonts.length > 0 && (
                    <div class={css({ mb: 4, fontSize: "sm" })}>
                      <span class={css({ color: "text-muted" })}>Fonts: </span>
                      {decResult.value.brandKit.fonts.map((f) => (
                        <code key={f} class={css({ color: "acid-lime", mr: 2 })}>{f}</code>
                      ))}
                    </div>
                  )}

                  {/* Image grid */}
                  {decResult.value.brandKit.images.length > 0 && (
                    <div class={grid({ columns: { base: 4, md: 8 }, gap: 2, mb: 4 })}>
                      {[
                        ...(decResult.value.brandKit.logo ? [{ url: decResult.value.brandKit.logo, alt: "logo" }] : []),
                        ...(decResult.value.brandKit.ogImage ? [{ url: decResult.value.brandKit.ogImage, alt: "og" }] : []),
                        ...decResult.value.brandKit.images.slice(0, 14),
                      ].map((img, i) => (
                        <a key={i} href={img.url} target="_blank" rel="noopener">
                          <img
                            src={`${apiBase.value.replace("/api", "")}/api/proxy?url=${encodeURIComponent(img.url)}`}
                            alt={img.alt ?? ""}
                            loading="lazy"
                            class={css({ w: "full", aspectRatio: "1", objectFit: "cover", rounded: "md", border: "1px solid token(colors.border)", bg: "ink-black" })}
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  <div class={hstack({ gap: 3 })}>
                    <button onClick$={() => { bkSelected.value = decResult.value!.persona.id; loadBrandKit(decResult.value!.persona.id); activeTab.value = "brandkit"; }} class={drippyButton("primary")}>✸ View Brand Kit</button>
                    <button onClick$={() => { genSelected.value = decResult.value!.persona.id; activeTab.value = "generate"; }} class={drippyButton("secondary")}>⚡ Generate Assets</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ══ REMIX ══════════════════════════════════════════════════════════════ */}
          {activeTab.value === "remix" && (
            <section class={css({ maxW: "700px" })}>
              <div class={flex({ align: "center", justify: "space-between", mb: 4 })}>
                <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "melt-orange", textTransform: "uppercase" })}>Remix Personas</h2>
                <button onClick$={runRemix} disabled={rxRunning.value} class={drippyButton("primary")}>
                  {rxRunning.value ? "Remixing…" : "⟳ Remix"}
                </button>
              </div>
              <p class={css({ color: "text-muted", fontSize: "sm", mb: 5 })}>
                Cross two personas (and their brand kits) into a new one. B's culture overlays A's aesthetic density.
              </p>

              <div class={grid({ columns: { base: 1, md: 2 }, gap: 4 })}>
                <div>
                  <label class={labelCls}>Persona A (base)</label>
                  <select value={rxA.value} onChange$={(e) => { rxA.value = (e.target as HTMLSelectElement).value; }} class={inputCls}>
                    <option value="">— Choose A —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Persona B (overlay)</label>
                  <select value={rxB.value} onChange$={(e) => { rxB.value = (e.target as HTMLSelectElement).value; }} class={inputCls}>
                    <option value="">— Choose B —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label class={labelCls}>New ID</label>
                  <input value={rxId.value} onInput$={(e) => { rxId.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="my-remix" />
                </div>
                <div>
                  <label class={labelCls}>Display Name (optional)</label>
                  <input value={rxName.value} onInput$={(e) => { rxName.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="auto" />
                </div>
              </div>

              {rxResult.value && (
                <div class={css({ mt: 5, p: 4, rounded: "xl", bg: "surface", border: "2px solid token(colors.acid-lime)", color: "acid-lime", fontSize: "sm", fontFamily: "graffiti", textTransform: "uppercase" })}>
                  ✓ {rxResult.value}
                  <button onClick$={() => { activeTab.value = "personas"; }} class={css({ ml: 4, fontSize: "xs", color: "ink-black", bg: "acid-lime", border: "none", px: 3, py: 1, rounded: "md", cursor: "pointer", fontWeight: "bold" })}>View in Crew →</button>
                </div>
              )}
            </section>
          )}

          {/* ══ FORGE / CREATE ═════════════════════════════════════════════════════ */}
          {activeTab.value === "create" && (
            <section class={css({ maxW: "900px" })}>
              <div class={flex({ align: "center", justify: "space-between", mb: 5, wrap: "wrap", gap: 2 })}>
                <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "neon-fuchsia", textTransform: "uppercase" })}>{editingId.value ? "Edit Persona" : "Forge a Persona"}</h2>
                <div class={hstack({ gap: 2 })}>
                  <button onClick$={() => { resetForm(); activeTab.value = "personas"; }} class={drippyButton("ghost")}>Cancel</button>
                  <button onClick$={savePersona} class={drippyButton("primary")}>Save »</button>
                </div>
              </div>
              <div class={grid({ gap: 4 })}>
                <div><label class={labelCls}>ID (kebab-case)</label><input value={pId.value} onInput$={(e) => { pId.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="my-persona" /></div>
                <div><label class={labelCls}>Name</label><input value={pName.value} onInput$={(e) => { pName.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="Neon Drip Collective" /></div>
                <div><label class={labelCls}>Summary</label><textarea value={pSummary.value} onInput$={(e) => { pSummary.value = (e.target as HTMLTextAreaElement).value; }} class={inputCls} style={{ minHeight: "80px" }} /></div>

                <h3 class={sectionTitle}>Culture</h3>
                <div class={grid({ columns: { base: 1, md: 2 }, gap: 4 })}>
                  <div><label class={labelCls}>Region</label><input value={pRegion.value} onInput$={(e) => { pRegion.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="NYC subway, 1992" /></div>
                  <div><label class={labelCls}>Subcultures</label><input value={pSubcultures.value} onInput$={(e) => { pSubcultures.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="skate, graffiti, anime" /></div>
                </div>
                <div><label class={labelCls}>Values</label><input value={pValues.value} onInput$={(e) => { pValues.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="rebellion, fun, crew" /></div>

                <h3 class={sectionTitle}>Influences</h3>
                <div class={grid({ columns: { base: 1, md: 2 }, gap: 4 })}>
                  <div><label class={labelCls}>Films</label><input value={pFilms.value} onInput$={(e) => { pFilms.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="TMNT, Akira" /></div>
                  <div><label class={labelCls}>Anime</label><input value={pAnime.value} onInput$={(e) => { pAnime.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="Bebop" /></div>
                  <div><label class={labelCls}>Music Genres</label><input value={pMusicGenres.value} onInput$={(e) => { pMusicGenres.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="hip-hop, punk" /></div>
                  <div><label class={labelCls}>Music Artists</label><input value={pMusicArtists.value} onInput$={(e) => { pMusicArtists.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="Beastie Boys" /></div>
                </div>
                <div><label class={labelCls}>Visual Artists</label><input value={pVisualArtists.value} onInput$={(e) => { pVisualArtists.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="Basquiat, Haring" /></div>
                <div><label class={labelCls}>Spaces</label><input value={pSpaces.value} onInput$={(e) => { pSpaces.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="arcades, rooftops" /></div>
                <div><label class={labelCls}>Obsessions</label><input value={pObsessions.value} onInput$={(e) => { pObsessions.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="slime, drips, splatter" /></div>

                <h3 class={sectionTitle}>Behaviors</h3>
                <div class={grid({ columns: { base: 1, md: 2 }, gap: 4 })}>
                  <div><label class={labelCls}>Interface Values</label><input value={pInterfaceValues.value} onInput$={(e) => { pInterfaceValues.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="loud, fun, fast" /></div>
                  <div><label class={labelCls}>Pet Peeves</label><input value={pPetPeeves.value} onInput$={(e) => { pPetPeeves.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="default emojis, beige UI" /></div>
                </div>

                <h3 class={sectionTitle}>Aesthetic DNA</h3>
                <div class={grid({ columns: { base: 1, md: 2 }, gap: 4 })}>
                  {AESTHETIC_FIELDS.map((f) => {
                    const valMap: Record<string, any> = {
                      colorTemperature: pColorTemp, density: pDensity, edgeStyle: pEdge,
                      motionStyle: pMotion, typographyStyle: pTypography, textureStyle: pTexture,
                      iconStyle: pIcon, layoutStyle: pLayout,
                    };
                    const s = valMap[f.key];
                    return (
                      <div key={f.key}>
                        <label class={labelCls}>{f.label}</label>
                        <select value={s.value} onChange$={(e) => { s.value = (e.target as HTMLSelectElement).value; }} class={inputCls}>
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ══ GENERATE ═══════════════════════════════════════════════════════════ */}
          {activeTab.value === "generate" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "acid-lime", textTransform: "uppercase", mb: 4 })}>Generate Assets</h2>
              <div class={grid({ columns: { base: 1, md: 2, lg: 4 }, gap: 4, mb: 4 })}>
                <div>
                  <label class={labelCls}>Persona</label>
                  <select value={genSelected.value} onChange$={(e) => { genSelected.value = (e.target as HTMLSelectElement).value; }} class={inputCls}>
                    <option value="">— Choose —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Type</label>
                  <select value={genType.value} onChange$={(e) => { genType.value = (e.target as HTMLSelectElement).value; }} class={inputCls}>
                    <option value="suite">Asset Suite</option>
                    <option value="ui-kit">Full UI Kit</option>
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Image Provider</label>
                  <select value={genProvider.value} onChange$={(e) => {
                    genProvider.value = (e.target as HTMLSelectElement).value;
                    genModel.value = IMAGE_MODELS[genProvider.value]?.[0] ?? "";
                  }} class={inputCls}>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini (Google)</option>
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Model</label>
                  <select value={genModel.value} onChange$={(e) => { genModel.value = (e.target as HTMLSelectElement).value; }} class={inputCls}>
                    {(IMAGE_MODELS[genProvider.value] ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div class={css({ mb: 4, p: 3, rounded: "lg", bg: "surface", border: "1px solid token(colors.border)", fontSize: "xs", color: "text-muted" })}>
                <span class={css({ fontWeight: "bold", color: genProvider.value === "openai" ? "acid-lime" : "cyan-burst" })}>
                  {genProvider.value === "openai" ? "OpenAI" : "Gemini"}
                </span>
                {" image generation · model: "}
                <code class={css({ color: "off-white" })}>{genModel.value}</code>
                {" · SVG: QuiverAI (requires QUIVER_API_KEY)"}
              </div>

              <div class={flex({ align: "center", gap: 3, mb: 4 })}>
                <label class={css({ display: "flex", alignItems: "center", gap: 2, fontSize: "sm", color: "text-muted", cursor: "pointer" })}>
                  <input type="checkbox" checked={genDryRun.value} onChange$={(e) => { genDryRun.value = (e.target as HTMLInputElement).checked; }} />
                  Dry Run (prompts only, no API calls)
                </label>
                {genJobStatus.value && (
                  <span class={css({
                    fontSize: "sm", px: 3, py: 1, rounded: "sm", fontWeight: "bold", textTransform: "uppercase",
                    bg: genJobStatus.value === "completed" ? "radioactive" : genJobStatus.value === "error" ? "neon-fuchsia" : "melt-orange",
                    color: "ink-black",
                  })}>{genJobStatus.value}</span>
                )}
              </div>
              <div class={flex({ gap: 2, mb: 4, wrap: "wrap" })}>
                <button onClick$={startGeneration} disabled={genRunning.value} class={drippyButton("primary")}>{genRunning.value ? "Cooking…" : "⚡ Start"}</button>
                <button onClick$={previewPrompts} class={drippyButton("secondary")}>👁 Preview prompts</button>
                <button onClick$={() => { fetch(`${apiBase.value}/jobs`).then((r) => r.json()).then((d) => { genJobs.value = d; }); }} class={drippyButton("ghost")}>↻ Jobs</button>
              </div>

              {/* Terminal */}
              <div class={css({ bg: "ink-black", border: "2px solid token(colors.acid-lime)", rounded: "lg", overflow: "hidden", mb: 4 })}>
                <div class={css({ bg: "surface", px: 4, py: 2, fontSize: "xs", color: "acid-lime", fontFamily: "graffiti", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid token(colors.acid-lime)", display: "flex", justifyContent: "space-between" })}>
                  <span>▶ Logs</span>
                  <button onClick$={() => genLogs.value = []} class={css({ px: 2, py: 0.5, rounded: "sm", bg: "transparent", color: "text-muted", fontSize: "xs", border: "none", cursor: "pointer" })}>Clear</button>
                </div>
                <div class={css({ p: 4, fontFamily: "mono", fontSize: "xs", lineHeight: 1.6, maxH: "300px", overflowY: "auto", color: genJobStatus.value === "error" ? "neon-fuchsia" : "acid-lime" })}>
                  {genLogs.value.length === 0 && <div><span class={css({ color: "electric-purple" })}>$</span> ready. pick persona &amp; cook.</div>}
                  {genLogs.value.map((log, i) => (
                    <div key={i} class={css({ color: log.toLowerCase().startsWith("error") ? "neon-fuchsia" : undefined })}>
                      <span class={css({ color: "electric-purple" })}>$</span> {log}
                    </div>
                  ))}
                </div>
              </div>

              <h3 class={sectionTitle}>Recent jobs</h3>
              {genJobs.value.length === 0 && <div class={css({ color: "text-muted", fontSize: "sm" })}>No jobs yet.</div>}
              <div class={vstack({ gap: 1, alignItems: "stretch" })}>
                {genJobs.value.map((j) => (
                  <div key={j.id} class={css({ fontSize: "xs", px: 3, py: 2, rounded: "sm", bg: "surface", color: "text-muted", fontFamily: "mono", border: "1px solid token(colors.border)" })}>
                    {j.id} — {j.type} · {j.personaId} · <span class={css({ color: j.status === "completed" ? "radioactive" : j.status === "error" ? "neon-fuchsia" : "melt-orange", fontWeight: "bold" })}>{j.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ══ RANK ═══════════════════════════════════════════════════════════════ */}
          {activeTab.value === "rank" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "neon-fuchsia", textTransform: "uppercase", mb: 4 })}>Rank & Teach</h2>
              <p class={css({ color: "text-muted", fontSize: "sm", mb: 5, maxW: "3xl" })}>
                Fire or trash an asset by ID. Rankings are stored and will inform future generation quality scoring.
              </p>
              <div class={grid({ columns: { base: 1, md: 2 }, gap: 4, mb: 5 })}>
                <div>
                  <label class={labelCls}>Persona</label>
                  <select value={rankSelected.value} onChange$={(e) => { rankSelected.value = (e.target as HTMLSelectElement).value; loadRanks(rankSelected.value); }} class={inputCls}>
                    <option value="">— Choose —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Asset ID</label>
                  <input value={rankAssetId.value} onInput$={(e) => { rankAssetId.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="cell-2-3 or asset id" />
                </div>
              </div>
              <div class={css({ mb: 4 })}>
                <label class={labelCls}>Feedback (optional)</label>
                <textarea value={rankFeedback.value} onInput$={(e) => { rankFeedback.value = (e.target as HTMLTextAreaElement).value; }} class={inputCls} style={{ minHeight: "70px" }} placeholder="too clean. needs more drip." />
              </div>
              <div class={hstack({ gap: 3, mb: 6 })}>
                <button onClick$={() => submitRank(1)} class={drippyButton("primary")}>🔥 Fire</button>
                <button onClick$={() => submitRank(-1)} class={drippyButton("danger")}>🗑 Trash</button>
              </div>
              {rankSelected.value && (
                <div class={grid({ columns: { base: 2, md: 4 }, gap: 4, mb: 6 })}>
                  <StatCard label="Total" value={rankStats.value.total} color="electric-purple" />
                  <StatCard label="🔥 Fire" value={rankStats.value.positive} color="acid-lime" />
                  <StatCard label="🗑 Trash" value={rankStats.value.negative} color="neon-fuchsia" />
                  <StatCard label="Score" value={(rankStats.value.score * 100).toFixed(0) + "%"} color="cyan-burst" />
                </div>
              )}
              {rankSelected.value && rankStats.value.recent.length > 0 && (
                <div>
                  <h3 class={sectionTitle}>Recent verdicts</h3>
                  <div class={vstack({ gap: 2, alignItems: "stretch" })}>
                    {rankStats.value.recent.slice(0, 8).map((r, i) => (
                      <div key={i} class={css({ p: 3, rounded: "md", bg: "surface", border: "1px solid", borderColor: r.score > 0 ? "acid-lime" : "neon-fuchsia", fontFamily: "mono", fontSize: "xs" })}>
                        <span class={css({ color: r.score > 0 ? "acid-lime" : "neon-fuchsia", fontWeight: "bold" })}>{r.score > 0 ? "🔥" : "🗑"} {r.assetId}</span>
                        {r.feedback && <span class={css({ color: "text-muted", ml: 2 })}>— {r.feedback}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ══ TOKENS ═════════════════════════════════════════════════════════════ */}
          {activeTab.value === "tokens" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "cyan-burst", textTransform: "uppercase", mb: 4 })}>Export Tokens</h2>
              <div class={flex({ gap: 3, mb: 4, wrap: "wrap", alignItems: "flex-end" })}>
                <div>
                  <label class={labelCls}>Persona</label>
                  <select value={tokSelected.value} onChange$={(e) => { tokSelected.value = (e.target as HTMLSelectElement).value; if (tokSelected.value) loadTokens(tokSelected.value, tokFormat.value); else tokContent.value = ""; }} class={css({ w: "56", bg: "ink-black", border: "2px solid token(colors.electric-purple)", color: "off-white", px: 3, py: 2, rounded: "md", fontSize: "sm", fontFamily: "mono" })}>
                    <option value="">— Choose —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Format</label>
                  <select value={tokFormat.value} onChange$={(e) => { tokFormat.value = (e.target as HTMLSelectElement).value; if (tokSelected.value) loadTokens(tokSelected.value, tokFormat.value); }} class={css({ w: "48", bg: "ink-black", border: "2px solid token(colors.electric-purple)", color: "off-white", px: 3, py: 2, rounded: "md", fontSize: "sm", fontFamily: "mono" })}>
                    <option value="css">CSS Variables</option>
                    <option value="tailwind">Tailwind</option>
                    <option value="json">JSON</option>
                    <option value="panda">PandaCSS</option>
                  </select>
                </div>
                {tokContent.value && (
                  <button onClick$={() => {
                    const extMap: Record<string, string> = { css: "css", tailwind: "js", json: "json", panda: "ts" };
                    const ext = extMap[tokFormat.value] ?? "txt";
                    const blob = new Blob([tokContent.value], { type: "text/plain" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                    a.download = `${tokSelected.value}-tokens.${ext}`; a.click();
                    showToast(`Downloaded ${ext}`);
                  }} class={drippyButton("primary")}>↓ Download</button>
                )}
              </div>
              {tokLoading.value && <div class={css({ color: "text-muted", textAlign: "center", py: 8 })}>Cooking tokens…</div>}
              {!tokLoading.value && tokContent.value && (
                <pre class={css({ bg: "ink-black", border: "2px solid token(colors.cyan-burst)", rounded: "lg", p: 4, fontFamily: "mono", fontSize: "xs", color: "acid-lime", maxH: "500px", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" })}>{tokContent.value}</pre>
              )}
              {!tokLoading.value && !tokContent.value && tokSelected.value && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 8 })}>Pick a format to preview tokens.</div>
              )}
            </section>
          )}

          {/* ══ OPENPENCIL EDITOR ══════════════════════════════════════════════════ */}
          {activeTab.value === "editor" && (
            <section>
              <div class={flex({ align: "center", justify: "space-between", mb: 5, gap: 3, wrap: "wrap" })}>
                <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "cyan-burst", textTransform: "uppercase" })}>OpenPencil Editor</h2>
                <div class={flex({ gap: 2, wrap: "wrap", align: "center" })}>
                  <select
                    value={opSelected.value}
                    onChange$={(e) => {
                      opSelected.value = (e.target as HTMLSelectElement).value;
                      if (opSelected.value) loadOpenPencil(opSelected.value);
                    }}
                    class={inputCls}
                    style={{ maxWidth: "260px" }}
                  >
                    <option value="">— pick persona —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick$={() => opSelected.value && loadOpenPencil(opSelected.value)} disabled={!opSelected.value} class={drippyButton("ghost")}>↻ Reload</button>
                  <button onClick$={saveOpenPencil} disabled={!opDoc.value || opSaving.value} class={drippyButton("primary")}>
                    {opSaving.value ? "Saving…" : "💾 Save"}
                  </button>
                  <button onClick$={exportOpenPencilFile} disabled={!opSelected.value} class={drippyButton("secondary")}>📄 Export to disk</button>
                  <button onClick$={toggleOpenPencilWatch} disabled={!opSelected.value} class={drippyButton(opWatching.value ? "danger" : "ghost")}>
                    {opWatching.value ? "⏹ Stop watching" : "👁 Watch external edits"}
                  </button>
                </div>
              </div>

              {opFilePath.value && (
                <div class={css({ fontSize: "xs", color: "text-muted", mb: 3, fontFamily: "mono" })}>
                  File: <span class={css({ color: "acid-lime" })}>{opFilePath.value}</span>
                  {opWatching.value && <span class={css({ ml: 2, color: "neon-fuchsia", fontWeight: "bold" })}>● watching</span>}
                </div>
              )}

              {opLoading.value && <div class={css({ color: "text-muted", textAlign: "center", py: 6 })}>Loading…</div>}

              {!opLoading.value && !opSelected.value && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 10 })}>
                  Pick a persona to load its OpenPencil document. Edits round-trip into the brand kit.
                </div>
              )}

              {!opLoading.value && opDoc.value && (
                <div class={grid({ columns: { base: 1, lg: 2 }, gap: 5 })}>
                  {/* Tokens editor */}
                  <div>
                    <h3 class={sectionTitle}>Tokens · {opDoc.value.tokens.length}</h3>
                    <div class={css({
                      maxH: "560px", overflowY: "auto",
                      bg: "surface", border: "2px solid token(colors.electric-purple)",
                      rounded: "lg", p: 3,
                    })}>
                      {opDoc.value.tokens.map((tok, i) => (
                        <div key={tok.id} class={css({ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 2, alignItems: "center", py: 1.5, borderBottom: "1px solid token(colors.border)" })}>
                          <span class={css({
                            fontSize: "10px", px: 1.5, py: 0.5, rounded: "sm",
                            bg: "ink-black", color: tok.type === "color" ? "neon-fuchsia" : tok.type === "font" ? "acid-lime" : "cyan-burst",
                            fontFamily: "mono", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "bold",
                            minW: "60px", textAlign: "center",
                          })}>{tok.type}</span>
                          <div>
                            <div class={css({ fontSize: "xs", color: "off-white", fontFamily: "mono" })}>{tok.name}</div>
                            <div class={css({ fontSize: "10px", color: "text-muted" })}>{tok.category}</div>
                          </div>
                          {tok.type === "color" ? (
                            <div class={hstack({ gap: 1 })}>
                              <input
                                type="color"
                                value={tok.value}
                                onInput$={(e) => updateToken(i, (e.target as HTMLInputElement).value)}
                                class={css({ w: "32px", h: "32px", p: 0, border: "1px solid token(colors.border)", rounded: "sm", bg: "transparent", cursor: "pointer" })}
                              />
                              <input
                                value={tok.value}
                                onInput$={(e) => updateToken(i, (e.target as HTMLInputElement).value)}
                                class={css({ w: "100px", bg: "ink-black", border: "1px solid token(colors.border)", color: "off-white", px: 2, py: 1, rounded: "sm", fontSize: "xs", fontFamily: "mono" })}
                              />
                            </div>
                          ) : (
                            <input
                              value={tok.value}
                              onInput$={(e) => updateToken(i, (e.target as HTMLInputElement).value)}
                              class={css({ w: "180px", bg: "ink-black", border: "1px solid token(colors.border)", color: "off-white", px: 2, py: 1, rounded: "sm", fontSize: "xs", fontFamily: "mono" })}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview / webview */}
                  <div>
                    <h3 class={sectionTitle}>Preview</h3>
                    <div class={hstack({ gap: 2, mb: 3 })}>
                      <input
                        value={opWebviewUrl.value}
                        onInput$={(e) => { opWebviewUrl.value = (e.target as HTMLInputElement).value; }}
                        placeholder="https://openpencil.app"
                        class={inputCls}
                      />
                      <button onClick$={() => { opShowWebview.value = !opShowWebview.value; }} class={drippyButton(opShowWebview.value ? "danger" : "ghost")}>
                        {opShowWebview.value ? "Hide" : "Open"}
                      </button>
                    </div>
                    {opShowWebview.value ? (
                      <iframe
                        src={opWebviewUrl.value}
                        class={css({ w: "full", h: "560px", border: "2px solid token(colors.cyan-burst)", rounded: "lg", bg: "off-white" })}
                        title="OpenPencil webview"
                      />
                    ) : (
                      <div class={css({ p: 4, rounded: "lg", bg: "surface", border: "1px dashed token(colors.border)", fontSize: "sm", color: "text-muted" })}>
                        <p class={css({ mb: 2 })}>Embed any OpenPencil-compatible editor in the iframe, or use the in-place token editor on the left.</p>
                        <p class={css({ mb: 2 })}>Saved edits update the persona's brand kit (palette, fonts) and snapshot a new design version.</p>
                        <p>External editing: click <strong>Export to disk</strong>, edit the JSON in your editor of choice, then toggle <strong>Watch external edits</strong> so changes auto-import on save.</p>
                      </div>
                    )}

                    <h3 class={sectionTitle}>Metadata</h3>
                    <div class={css({ p: 3, rounded: "lg", bg: "surface", border: "1px solid token(colors.border)", fontSize: "xs", fontFamily: "mono", color: "text-muted" })}>
                      <SignalRow label="persona" value={opDoc.value.metadata.personaName} />
                      <SignalRow label="version" value={opDoc.value.version} />
                      <SignalRow label="exported" value={new Date(opDoc.value.metadata.exportedAt).toLocaleString()} />
                      <SignalRow label="pages" value={String(opDoc.value.pages.length)} />
                      <SignalRow label="components" value={String(opDoc.value.components.length)} />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ══ FEEDBACK ═══════════════════════════════════════════════════════════ */}
          {activeTab.value === "feedback" && (
            <section>
              <div class={flex({ align: "center", justify: "space-between", mb: 5, gap: 3, wrap: "wrap" })}>
                <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "neon-fuchsia", textTransform: "uppercase" })}>Learned Preferences</h2>
                <div class={hstack({ gap: 2 })}>
                  <select
                    value={fbSelected.value}
                    onChange$={(e) => {
                      fbSelected.value = (e.target as HTMLSelectElement).value;
                      if (fbSelected.value) loadFeedback(fbSelected.value);
                    }}
                    class={inputCls}
                    style={{ maxWidth: "260px" }}
                  >
                    <option value="">— pick persona —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick$={() => fbSelected.value && loadFeedback(fbSelected.value)} disabled={!fbSelected.value} class={drippyButton("ghost")}>↻ Reload</button>
                </div>
              </div>

              {fbLoading.value && <div class={css({ color: "text-muted", textAlign: "center", py: 6 })}>Loading…</div>}

              {!fbLoading.value && !fbSelected.value && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 10 })}>
                  Pick a persona to see what the judge LLM has learned from your rankings.
                </div>
              )}

              {!fbLoading.value && fbData.value && (
                <>
                  <div class={grid({ columns: { base: 2, md: 4 }, gap: 4, mb: 5 })}>
                    <StatCard label="Total" value={fbData.value.total} color="cyan-burst" />
                    <StatCard label="Upvoted" value={fbData.value.positive} color="acid-lime" />
                    <StatCard label="Downvoted" value={fbData.value.negative} color="neon-fuchsia" />
                    <StatCard
                      label="Up:Down"
                      value={fbData.value.negative ? (fbData.value.positive / fbData.value.negative).toFixed(2) : fbData.value.positive ? "∞" : "—"}
                      color="melt-orange"
                    />
                  </div>

                  <div class={grid({ columns: { base: 1, lg: 2 }, gap: 5 })}>
                    <div>
                      <h3 class={sectionTitle}>Top Upvoted Tags</h3>
                      {fbData.value.topUpTags.length === 0 ? (
                        <p class={css({ fontSize: "sm", color: "text-muted" })}>No upvoted tags yet — rank some assets in the Rank tab.</p>
                      ) : (
                        <div class={flex({ gap: 1.5, wrap: "wrap", align: "center" })}>
                          {fbData.value.topUpTags.map((t) => (
                            <span key={t.tag} class={css({ px: 2, py: 1, rounded: "sm", bg: "acid-lime", color: "ink-black", fontSize: "xs", fontWeight: "bold", fontFamily: "mono" })}>
                              {t.tag} · {t.count}
                            </span>
                          ))}
                        </div>
                      )}

                      <h3 class={sectionTitle}>Top Downvoted Tags</h3>
                      {fbData.value.topDownTags.length === 0 ? (
                        <p class={css({ fontSize: "sm", color: "text-muted" })}>No downvoted tags yet.</p>
                      ) : (
                        <div class={flex({ gap: 1.5, wrap: "wrap", align: "center" })}>
                          {fbData.value.topDownTags.map((t) => (
                            <span key={t.tag} class={css({ px: 2, py: 1, rounded: "sm", bg: "neon-fuchsia", color: "off-white", fontSize: "xs", fontWeight: "bold", fontFamily: "mono" })}>
                              {t.tag} · {t.count}
                            </span>
                          ))}
                        </div>
                      )}

                      <h3 class={sectionTitle}>Recent Feedback</h3>
                      <div class={vstack({ gap: 2, alignItems: "stretch" })}>
                        {fbData.value.recent.length === 0 && (
                          <p class={css({ fontSize: "sm", color: "text-muted" })}>No recent feedback.</p>
                        )}
                        {fbData.value.recent.map((r, i) => (
                          <div key={i} class={css({
                            p: 3, rounded: "lg", bg: "surface",
                            border: "1px solid", borderColor: r.score > 0 ? "acid-lime" : r.score < 0 ? "neon-fuchsia" : "border",
                            fontSize: "xs",
                          })}>
                            <div class={flex({ align: "center", justify: "space-between", mb: 1 })}>
                              <span class={css({ fontFamily: "mono", color: r.score > 0 ? "acid-lime" : r.score < 0 ? "neon-fuchsia" : "text-muted", fontWeight: "bold" })}>
                                {r.score > 0 ? "▲ UP" : r.score < 0 ? "▼ DOWN" : "—"} · {r.assetId ?? "anon"}
                              </span>
                              <span class={css({ color: "text-muted", fontSize: "10px" })}>{new Date(r.ts).toLocaleString()}</span>
                            </div>
                            {r.feedback && <div class={css({ color: "off-white" })}>{r.feedback}</div>}
                            {r.tags && r.tags.length > 0 && (
                              <div class={flex({ gap: 1, mt: 1, wrap: "wrap", align: "center" })}>
                                {r.tags.map((t) => (
                                  <span key={t} class={css({ fontSize: "9px", px: 1, py: 0.5, rounded: "sm", bg: "ink-black", color: "cyan-burst", fontFamily: "mono" })}>{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 class={sectionTitle}>Judge Prompt Injection</h3>
                      <p class={css({ fontSize: "xs", color: "text-muted", mb: 2 })}>
                        This is exactly what gets prepended to the judge's system prompt on every evaluation. Edits to this come from rankings — change behavior by ranking more assets.
                      </p>
                      <pre class={css({
                        bg: "ink-black", border: "2px solid token(colors.electric-purple)",
                        rounded: "lg", p: 3, fontFamily: "mono", fontSize: "xs",
                        color: "acid-lime", maxH: "640px", overflow: "auto",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      })}>{fbData.value.document || "(no learned preferences yet — rank some assets to seed)"}</pre>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ══ CONFIG ═════════════════════════════════════════════════════════════ */}
          {activeTab.value === "config" && (
            <section class={css({ maxW: "700px" })}>
              <div class={flex({ align: "center", justify: "space-between", mb: 5 })}>
                <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "melt-orange", textTransform: "uppercase" })}>Config</h2>
                <button onClick$={saveConfig} disabled={cfgSaving.value} class={drippyButton("primary")}>
                  {cfgSaving.value ? "Saving…" : "Save"}
                </button>
              </div>

              <h3 class={sectionTitle}>Connection</h3>
              <div class={grid({ gap: 4 })}>
                <div>
                  <label class={labelCls}>Baste API URL</label>
                  <input value={cfgApiUrl.value} onInput$={(e) => { cfgApiUrl.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="http://localhost:3456/api" />
                  <p class={css({ fontSize: "xs", color: "text-muted", mt: 1 })}>Saved to localStorage. Start the server with <code>baste gui</code>.</p>
                </div>
              </div>

              <h3 class={sectionTitle}>Image Generation</h3>
              <div class={grid({ columns: { base: 1, md: 2 }, gap: 4 })}>
                <div>
                  <label class={labelCls}>Provider</label>
                  <select value={cfgImgProvider.value} onChange$={(e) => {
                    cfgImgProvider.value = (e.target as HTMLSelectElement).value;
                    cfgImgModel.value = IMAGE_MODELS[cfgImgProvider.value]?.[0] ?? "";
                  }} class={inputCls}>
                    <option value="openai">OpenAI (gpt-image-2 / DALL·E 3)</option>
                    <option value="gemini">Gemini / Imagen (Google)</option>
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Model</label>
                  <select value={cfgImgModel.value} onChange$={(e) => { cfgImgModel.value = (e.target as HTMLSelectElement).value; }} class={inputCls}>
                    {(IMAGE_MODELS[cfgImgProvider.value] ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <h3 class={sectionTitle}>SVG Generation</h3>
              <div class={css({ p: 4, rounded: "lg", bg: "surface", border: "1px solid token(colors.border)", fontSize: "sm" })}>
                <p class={css({ color: "text-muted", mb: 2 })}>SVG generation requires a QuiverAI API key. No fallback is used.</p>
                <p class={css({ color: "text-muted" })}>Set <code class={css({ color: "acid-lime" })}>QUIVER_API_KEY</code> as an environment variable before starting <code>baste gui</code>. Optionally set <code class={css({ color: "acid-lime" })}>QUIVER_BASE_URL</code> to override the API endpoint.</p>
              </div>

              <h3 class={sectionTitle}>API Keys</h3>
              <div class={css({ p: 4, rounded: "lg", bg: "surface", border: "1px solid token(colors.border)", fontSize: "sm", color: "text-muted" })}>
                <p class={css({ mb: 2 })}>API keys are read from environment variables on the server — never stored in the browser.</p>
                <div class={grid({ columns: 1, gap: 2 })}>
                  <code class={css({ color: "acid-lime" })}>OPENAI_API_KEY</code>
                  <code class={css({ color: "acid-lime" })}>GOOGLE_API_KEY</code>
                  <code class={css({ color: "acid-lime" })}>QUIVER_API_KEY</code>
                </div>
              </div>

              <h3 class={sectionTitle}>QD Parameters</h3>
              <div class={grid({ columns: { base: 1, md: 2 }, gap: 4 })}>
                <div>
                  <label class={labelCls}>Iterations</label>
                  <input type="number" min={1} max={50} value={cfgData.value.qd?.iterations ?? 5} onInput$={(e) => { cfgData.value = { ...cfgData.value, qd: { ...cfgData.value.qd, iterations: parseInt((e.target as HTMLInputElement).value) } }; }} class={inputCls} />
                </div>
                <div>
                  <label class={labelCls}>Batch Size</label>
                  <input type="number" min={1} max={20} value={cfgData.value.qd?.batchSize ?? 3} onInput$={(e) => { cfgData.value = { ...cfgData.value, qd: { ...cfgData.value.qd, batchSize: parseInt((e.target as HTMLInputElement).value) } }; }} class={inputCls} />
                </div>
                <div>
                  <label class={labelCls}>Mutation Rate (0–1)</label>
                  <input type="number" min={0} max={1} step={0.1} value={cfgData.value.qd?.mutationRate ?? 0.4} onInput$={(e) => { cfgData.value = { ...cfgData.value, qd: { ...cfgData.value.qd, mutationRate: parseFloat((e.target as HTMLInputElement).value) } }; }} class={inputCls} />
                </div>
                <div>
                  <label class={labelCls}>Quality Threshold (0–1)</label>
                  <input type="number" min={0} max={1} step={0.1} value={cfgData.value.qd?.qualityThreshold ?? 0.5} onInput$={(e) => { cfgData.value = { ...cfgData.value, qd: { ...cfgData.value.qd, qualityThreshold: parseFloat((e.target as HTMLInputElement).value) } }; }} class={inputCls} />
                </div>
              </div>
            </section>
          )}

        </div>
      </main>
      <Footer />

      {/* Toast */}
      {toastShow.value && (
        <div class={css({
          position: "fixed", bottom: 6, right: 6, zIndex: 200,
          bg: "ink-black", fontFamily: "graffiti", textTransform: "uppercase",
          letterSpacing: "0.05em", px: 5, py: 3, rounded: "lg", fontSize: "sm", fontWeight: "bold",
          border: "2px solid",
          color: toastType.value === "error" ? "neon-fuchsia" : toastType.value === "warn" ? "melt-orange" : "acid-lime",
          borderColor: toastType.value === "error" ? "neon-fuchsia" : toastType.value === "warn" ? "melt-orange" : "acid-lime",
          boxShadow: "5px 6px 0 rgba(138,0,255,0.8)",
        })}>{toastMsg.value}</div>
      )}
    </>
  );
});

// ─── Subcomponents ────────────────────────────────────────────────────────────

const StatCard = component$<{ label: string; value: string | number; color: string }>(({ label, value, color }) => (
  <div class={css({ p: 4, rounded: "xl", bg: "surface", border: "2px solid", borderColor: "ink-black", boxShadow: `4px 5px 0 token(colors.${color as any})` })}>
    <div class={css({ fontSize: "xs", color: "text-muted", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: "bold", mb: 1 })}>{label}</div>
    <div class={css({ fontSize: "3xl", fontFamily: "graffiti", color: color as any, lineHeight: 1 })}>{value}</div>
  </div>
));

const SignalRow = component$<{ label: string; value: string }>(({ label, value }) => (
  <div class={css({ fontSize: "xs" })}>
    <span class={css({ color: "text-muted" })}>{label}: </span>
    <span class={css({ color: "off-white", fontFamily: "mono" })}>{value}</span>
  </div>
));

export const head: DocumentHead = {
  title: "Baste Studio — Co-create great designs",
};
