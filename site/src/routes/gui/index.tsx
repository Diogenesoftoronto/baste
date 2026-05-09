import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { flex, grid, hstack, vstack } from "styled-system/patterns";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { BasteLogo } from "~/components/layout/baste-logo";

const API_BASE = "http://localhost:3456/api";

type Tab = "personas" | "moodboard" | "brandkit" | "create" | "generate" | "rank" | "tokens";

interface PersonaShort {
  id: string;
  name: string;
  summary: string;
  _source?: string;
  aesthetic?: { colorTemperature?: string; density?: string };
}

interface Moodboard {
  personaId: string;
  references: Array<{ id: string; src: string; tags: string[]; pinned: boolean; addedAt: number }>;
  notes: string;
  vibe: string[];
}

const AESTHETIC_FIELDS = [
  { key: "colorTemperature", label: "Color Temperature", options: ["warm", "cool", "neutral", "high-contrast", "muted"] },
  { key: "density", label: "Density", options: ["minimal", "dense", "rich", "maximalist"] },
  { key: "edgeStyle", label: "Edge Style", options: ["sharp", "soft", "organic", "geometric", "brutalist"] },
  { key: "motionStyle", label: "Motion Style", options: ["smooth", "snappy", "liquid", "mechanical"] },
  { key: "typographyStyle", label: "Typography", options: ["clean", "expressive", "retro", "futuristic", "handcrafted"] },
  { key: "textureStyle", label: "Texture", options: ["flat", "textured", "noisy", "clean", "grainy"] },
  { key: "iconStyle", label: "Icon Style", options: ["line", "filled", "hand-drawn", "geometric", "abstract"] },
  { key: "layoutStyle", label: "Layout", options: ["grid", "organic", "asymmetric", "brutalist", "editorial"] },
];

// === Reusable TMNT styles =================================================

const drippyButton = (variant: "primary" | "secondary" | "ghost" | "danger" = "primary") => {
  const palette = {
    primary: { bg: "acid-lime", color: "ink-black", border: "ink-black", hover: "neon-fuchsia", hoverColor: "off-white" },
    secondary: { bg: "electric-purple", color: "off-white", border: "ink-black", hover: "neon-fuchsia", hoverColor: "off-white" },
    ghost: { bg: "transparent", color: "acid-lime", border: "acid-lime", hover: "acid-lime", hoverColor: "ink-black" },
    danger: { bg: "neon-fuchsia", color: "off-white", border: "ink-black", hover: "danger", hoverColor: "off-white" },
  }[variant];
  return css({
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    px: 5,
    py: 2.5,
    rounded: "lg",
    bg: palette.bg,
    color: palette.color,
    fontSize: "sm",
    fontWeight: "bold",
    fontFamily: "graffiti",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    border: "2px solid",
    borderColor: palette.border,
    boxShadow: "4px 5px 0 #0A0A0A",
    cursor: "pointer",
    transition: "all 0.15s",
    _hover: { bg: palette.hover, color: palette.hoverColor, transform: "translate(-2px,-2px)", boxShadow: "6px 7px 0 #0A0A0A" },
    _active: { transform: "translate(2px,2px)", boxShadow: "0 0 0 #0A0A0A" },
    _disabled: { opacity: 0.4, cursor: "not-allowed" },
  });
};

const inputCls = css({
  w: "full",
  bg: "ink-black",
  border: "2px solid",
  borderColor: "electric-purple",
  color: "off-white",
  px: 3,
  py: 2,
  rounded: "md",
  fontSize: "sm",
  fontFamily: "mono",
  transition: "all 0.2s",
  _focus: { outline: "none", borderColor: "acid-lime", boxShadow: "0 0 12px rgba(198,255,0,0.5)" },
});
const labelCls = css({ display: "block", fontSize: "xs", color: "acid-lime", mb: 1, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" });
const sectionTitle = css({ mt: 4, mb: 2, fontSize: "lg", fontWeight: "bold", fontFamily: "graffiti", color: "neon-fuchsia", textTransform: "uppercase", letterSpacing: "0.04em" });

// === Component ============================================================

export default component$(() => {
  const activeTab = useSignal<Tab>("personas");
  const toastMsg = useSignal("");
  const toastType = useSignal("success");
  const toastShow = useSignal(false);

  const personas = useSignal<PersonaShort[]>([]);
  const personasLoading = useSignal(true);

  // Persona form
  const editingId = useSignal<string | null>(null);
  const pId = useSignal("");
  const pName = useSignal("");
  const pSummary = useSignal("");
  const pRegion = useSignal("");
  const pSubcultures = useSignal("");
  const pValues = useSignal("");
  const pFilms = useSignal("");
  const pAnime = useSignal("");
  const pMusicGenres = useSignal("");
  const pMusicArtists = useSignal("");
  const pVisualArtists = useSignal("");
  const pSpaces = useSignal("");
  const pObsessions = useSignal("");
  const pInterfaceValues = useSignal("");
  const pPetPeeves = useSignal("");
  const pColorTemp = useSignal("high-contrast");
  const pDensity = useSignal("maximalist");
  const pEdge = useSignal("brutalist");
  const pMotion = useSignal("snappy");
  const pTypography = useSignal("expressive");
  const pTexture = useSignal("noisy");
  const pIcon = useSignal("hand-drawn");
  const pLayout = useSignal("asymmetric");

  // Generate
  const genSelected = useSignal("");
  const genType = useSignal("suite");
  const genDryRun = useSignal(false);
  const genRunning = useSignal(false);
  const genLogs = useSignal<string[]>([]);
  const genJobStatus = useSignal("");
  const genJobs = useSignal<Array<{ id: string; personaId: string; type: string; status: string }>>([]);

  // Tokens
  const tokSelected = useSignal("");
  const tokFormat = useSignal("css");
  const tokContent = useSignal("");
  const tokLoading = useSignal(false);

  // Moodboard
  const mbSelected = useSignal("");
  const mb = useSignal<Moodboard>({ personaId: "", references: [], notes: "", vibe: [] });
  const mbNewSrc = useSignal("");
  const mbNewTags = useSignal("");

  // Split / QuiverAI
  const splitSrc = useSignal("");
  const splitCols = useSignal(4);
  const splitRows = useSignal(4);
  const splitCells = useSignal<Array<{ id: string; x: number; y: number; w: number; h: number; src: string }>>([]);

  // Rank
  const rankSelected = useSignal("");
  const rankStats = useSignal<{ total: number; positive: number; negative: number; score: number; trend: number[]; recent: Array<{ assetId: string; score: number; feedback: string; ts: number }> }>({ total: 0, positive: 0, negative: 0, score: 0, trend: [], recent: [] });
  const rankAssetId = useSignal("");
  const rankFeedback = useSignal("");

  const showToast = $((msg: string, type = "success") => {
    toastMsg.value = msg;
    toastType.value = type;
    toastShow.value = true;
    setTimeout(() => (toastShow.value = false), 3000);
  });

  const loadPersonas = $(() => {
    personasLoading.value = true;
    fetch(`${API_BASE}/personas`)
      .then((r) => r.json())
      .then((data) => { personas.value = data; personasLoading.value = false; })
      .catch(() => { personasLoading.value = false; });
  });

  const loadMoodboard = $((id: string) => {
    if (!id) return;
    fetch(`${API_BASE}/moodboard/${id}`)
      .then((r) => r.json())
      .then((data) => { mb.value = data; })
      .catch(() => {});
  });

  const loadRanks = $((id: string) => {
    if (!id) return;
    fetch(`${API_BASE}/rank/${id}`)
      .then((r) => r.json())
      .then((data) => { rankStats.value = data; })
      .catch(() => {});
  });

  useVisibleTask$(() => {
    loadPersonas();
    fetch(`${API_BASE}/jobs`).then((r) => r.json()).then((d) => { genJobs.value = d; }).catch(() => {});
  });

  const resetForm = $(() => {
    pId.value = "";
    pName.value = "";
    pSummary.value = "";
    pRegion.value = "";
    pSubcultures.value = "";
    pValues.value = "";
    pFilms.value = "";
    pAnime.value = "";
    pMusicGenres.value = "";
    pMusicArtists.value = "";
    pVisualArtists.value = "";
    pSpaces.value = "";
    pObsessions.value = "";
    pInterfaceValues.value = "";
    pPetPeeves.value = "";
    pColorTemp.value = "high-contrast";
    pDensity.value = "maximalist";
    pEdge.value = "brutalist";
    pMotion.value = "snappy";
    pTypography.value = "expressive";
    pTexture.value = "noisy";
    pIcon.value = "hand-drawn";
    pLayout.value = "asymmetric";
    editingId.value = null;
  });

  const fillForm = $((p: any) => {
    pId.value = p.id;
    pName.value = p.name;
    pSummary.value = p.summary || "";
    pRegion.value = p.culture?.region || "";
    pSubcultures.value = (p.culture?.subcultures || []).join(", ");
    pValues.value = (p.culture?.values || []).join(", ");
    pFilms.value = (p.influences?.films || []).join(", ");
    pAnime.value = (p.influences?.anime || []).join(", ");
    pMusicGenres.value = (p.influences?.music?.genres || []).join(", ");
    pMusicArtists.value = (p.influences?.music?.artists || []).join(", ");
    pVisualArtists.value = (p.influences?.visualArtists || []).join(", ");
    pSpaces.value = (p.influences?.spaces || []).join(", ");
    pObsessions.value = (p.influences?.obsessions || []).join(", ");
    pInterfaceValues.value = (p.behaviors?.interfaceValues || []).join(", ");
    pPetPeeves.value = (p.behaviors?.petPeeves || []).join(", ");
    pColorTemp.value = p.aesthetic?.colorTemperature || "high-contrast";
    pDensity.value = p.aesthetic?.density || "maximalist";
    pEdge.value = p.aesthetic?.edgeStyle || "brutalist";
    pMotion.value = p.aesthetic?.motionStyle || "snappy";
    pTypography.value = p.aesthetic?.typographyStyle || "expressive";
    pTexture.value = p.aesthetic?.textureStyle || "noisy";
    pIcon.value = p.aesthetic?.iconStyle || "hand-drawn";
    pLayout.value = p.aesthetic?.layoutStyle || "asymmetric";
  });

  const savePersona = $(() => {
    const split = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
    const persona = {
      id: pId.value.trim(),
      name: pName.value.trim() || pId.value.trim(),
      summary: pSummary.value.trim(),
      culture: { region: pRegion.value.trim() || undefined, subcultures: split(pSubcultures.value), values: split(pValues.value) },
      influences: {
        films: split(pFilms.value), shows: [], anime: split(pAnime.value),
        music: { genres: split(pMusicGenres.value), artists: split(pMusicArtists.value) },
        games: [], visualArtists: split(pVisualArtists.value), fashion: [], spaces: split(pSpaces.value),
        tools: [], obsessions: split(pObsessions.value),
      },
      behaviors: {
        discovery: [], interfaceValues: split(pInterfaceValues.value), platforms: [],
        expression: [], petPeeves: split(pPetPeeves.value),
      },
      aesthetic: {
        colorTemperature: pColorTemp.value, density: pDensity.value, edgeStyle: pEdge.value,
        motionStyle: pMotion.value, typographyStyle: pTypography.value, textureStyle: pTexture.value,
        iconStyle: pIcon.value, layoutStyle: pLayout.value,
        visualKeywords: [...split(pFilms.value), ...split(pAnime.value), ...split(pVisualArtists.value)].slice(0, 8),
        moodKeywords: [...split(pValues.value), ...split(pInterfaceValues.value)].slice(0, 6),
      },
    };
    const url = editingId.value ? `${API_BASE}/personas/${editingId.value}` : `${API_BASE}/personas`;
    const method = editingId.value ? "PUT" : "POST";
    fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(persona) })
      .then((r) => { if (!r.ok) throw new Error(); showToast(editingId.value ? "Updated. Slay." : "Created. Slay."); resetForm(); activeTab.value = "personas"; loadPersonas(); })
      .catch(() => showToast("Save failed", "error"));
  });

  const loadTokens = $((id: string, fmt: string) => {
    if (!id) return;
    tokLoading.value = true;
    fetch(`${API_BASE}/tokens/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: fmt }) })
      .then((r) => r.json())
      .then((data) => { tokContent.value = data.content || ""; tokLoading.value = false; })
      .catch(() => { tokLoading.value = false; });
  });

  const deletePersona = $((id: string) => {
    if (!confirm("Delete this persona?")) return;
    fetch(`${API_BASE}/personas/${id}`, { method: "DELETE" })
      .then(() => { showToast("Deleted"); loadPersonas(); })
      .catch(() => showToast("Delete failed", "error"));
  });

  const startGeneration = $(() => {
    if (!genSelected.value) { showToast("Pick a persona first", "warn"); return; }
    genRunning.value = true;
    genLogs.value = [];
    genJobStatus.value = "running";
    fetch(`${API_BASE}/generate/${genSelected.value}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: genType.value, dryRun: genDryRun.value }),
    })
      .then((r) => r.json())
      .then((data) => {
        genLogs.value = [`>>> Job ${data.jobId} cooking...`];
        const iv = setInterval(() => {
          fetch(`${API_BASE}/jobs/${data.jobId}`)
            .then((r) => r.json())
            .then((job) => {
              genJobStatus.value = job.status;
              genLogs.value = job.logs || [];
              if (job.status === "completed" || job.status === "error") {
                clearInterval(iv);
                genRunning.value = false;
                if (job.status === "completed") showToast("Cooked. Make. Share. Slay.");
                else showToast(job.error || "Generation crashed", "error");
                fetch(`${API_BASE}/jobs`).then((r) => r.json()).then((d) => { genJobs.value = d; }).catch(() => {});
              }
            })
            .catch(() => { clearInterval(iv); genRunning.value = false; });
        }, 1500);
      })
      .catch((err) => { genRunning.value = false; showToast(err.message, "error"); });
  });

  const previewPrompts = $(() => {
    if (!genSelected.value) { showToast("Pick a persona first", "warn"); return; }
    fetch(`${API_BASE}/prompts/${genSelected.value}`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        genLogs.value = ["── PROMPT PREVIEW ──", `IMG: ${data.image?.prompt?.slice(0, 220)}...`, `SVG: ${data.svg?.prompt?.slice(0, 220)}...`];
      })
      .catch(() => showToast("Preview failed", "error"));
  });

  const addReference = $(() => {
    if (!mbSelected.value || !mbNewSrc.value) return;
    fetch(`${API_BASE}/moodboard/${mbSelected.value}/reference`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src: mbNewSrc.value, tags: mbNewTags.value.split(",").map((s) => s.trim()).filter(Boolean) }),
    })
      .then(() => { mbNewSrc.value = ""; mbNewTags.value = ""; loadMoodboard(mbSelected.value); showToast("Reference added"); })
      .catch(() => showToast("Failed", "error"));
  });

  const togglePin = $((refId: string) => {
    const board = { ...mb.value, references: mb.value.references.map((r) => r.id === refId ? { ...r, pinned: !r.pinned } : r) };
    mb.value = board;
    fetch(`${API_BASE}/moodboard/${mbSelected.value}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(board),
    });
  });

  const removeRef = $((refId: string) => {
    const board = { ...mb.value, references: mb.value.references.filter((r) => r.id !== refId) };
    mb.value = board;
    fetch(`${API_BASE}/moodboard/${mbSelected.value}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(board),
    });
  });

  const splitImage = $(() => {
    if (!splitSrc.value) { showToast("Paste an image URL first", "warn"); return; }
    fetch(`${API_BASE}/split`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src: splitSrc.value, cols: splitCols.value, rows: splitRows.value }),
    })
      .then((r) => r.json())
      .then((data) => { splitCells.value = data.cells || []; showToast(`Split into ${data.cells?.length || 0} regions`); })
      .catch(() => showToast("Split failed", "error"));
  });

  const submitRank = $((score: 1 | -1) => {
    if (!rankSelected.value || !rankAssetId.value) { showToast("Pick persona + asset", "warn"); return; }
    fetch(`${API_BASE}/rank`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: rankAssetId.value, personaId: rankSelected.value, score, feedback: rankFeedback.value }),
    })
      .then(() => { rankFeedback.value = ""; loadRanks(rankSelected.value); showToast(score > 0 ? "🔥 fire saved" : "trash saved"); })
      .catch(() => showToast("Failed", "error"));
  });

  const tabs: Array<{ id: Tab; label: string; emoji: string }> = [
    { id: "personas", label: "Crew", emoji: "✦" },
    { id: "moodboard", label: "Moodboard", emoji: "✺" },
    { id: "brandkit", label: "Brand Kit", emoji: "✸" },
    { id: "create", label: "Forge", emoji: "✦" },
    { id: "generate", label: "Generate", emoji: "⚡" },
    { id: "rank", label: "Rank", emoji: "♥" },
    { id: "tokens", label: "Tokens", emoji: "▣" },
  ];

  return (
    <>
      <Nav />
      <main class={css({ pt: "84px", minH: "100vh", position: "relative" })}>
        {/* Drippy header banner with layered grid floor */}
        <div class={css({ position: "relative", mx: "auto", maxW: "7xl", px: 6, pt: 8, pb: 6, overflow: "hidden", rounded: "2xl" })}>
          <div class="baste-bg-grid baste-bg-layer" style={{ opacity: 0.45 }} aria-hidden="true" />
          <div class={flex({ align: "center", justify: "space-between", wrap: "wrap", gap: 4 })}>
            <div class={hstack({ gap: 4 })}>
              <BasteLogo size={64} />
              <div>
                <h1 class={css({ fontFamily: "graffiti", fontSize: { base: "3xl", md: "5xl" }, lineHeight: 1, letterSpacing: "0.02em", textTransform: "uppercase" })}>
                  <span class="baste-drip-text" style={{ WebkitTextStroke: "2px #0A0A0A" }}>Baste Studio</span>
                </h1>
                <p class={css({ color: "text-muted", fontSize: "sm", mt: 2, maxW: "2xl" })}>
                  Co-create with your AI agent. Brandkits, icons, logos, custom SVGs — no more default emojis, no more cursed clipart. <span class={css({ color: "neon-fuchsia", fontWeight: "bold" })}>Make. Share. Slay.</span>
                </p>
              </div>
            </div>
            <div class={hstack({ gap: 2, fontSize: "xs", color: "text-muted" })}>
              <span class={css({ px: 2, py: 1, rounded: "sm", bg: "surface", border: "1px solid token(colors.electric-purple)" })}>Built with Flue agent SDK</span>
              <span class={css({ px: 2, py: 1, rounded: "sm", bg: "surface", border: "1px solid token(colors.neon-fuchsia)" })}>Powered by QuiverAI</span>
            </div>
          </div>

          {/* Tab strip */}
          <div class={hstack({ gap: 1, mt: 6, p: 1.5, bg: "surface", rounded: "xl", border: "2px solid token(colors.electric-purple)", overflow: "auto" })}>
            {tabs.map((t) => {
              const active = activeTab.value === t.id;
              return (
                <button
                  key={t.id}
                  onClick$={() => {
                    activeTab.value = t.id;
                    if (t.id === "create") { resetForm(); editingId.value = null; }
                  }}
                  class={css({
                    px: 4, py: 2, rounded: "lg", fontSize: "sm", fontWeight: "bold", fontFamily: "graffiti",
                    cursor: "pointer", border: "2px solid",
                    borderColor: active ? "ink-black" : "transparent",
                    bg: active ? "acid-lime" : "transparent",
                    color: active ? "ink-black" : "text-muted",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                    boxShadow: active ? "3px 4px 0 #0A0A0A" : "none",
                    transition: "all 0.15s",
                    _hover: { color: active ? "ink-black" : "neon-fuchsia" },
                  })}
                >
                  <span class={css({ mr: 1.5 })}>{t.emoji}</span>{t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div class={css({ mx: "auto", maxW: "7xl", px: 6, pb: 16 })}>
          {/* === CREW / PERSONAS === */}
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
                <div class={css({ color: "text-muted", textAlign: "center", py: 12 })}>Loading the crew...</div>
              )}
              {!personasLoading.value && personas.value.length === 0 && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 12 })}>No personas yet. Forge one!</div>
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
                        <span class={css({ fontSize: "xs", px: 2, py: 0.5, rounded: "sm", bg: p._source === "base" ? "radioactive" : "melt-orange", color: "ink-black", fontWeight: "bold", textTransform: "uppercase" })}>{p._source || "base"}</span>
                      </div>
                      <p class={css({ color: "text-muted", fontSize: "sm", mb: 4, minH: "2.5em" })}>{p.summary || "No summary"}</p>
                      <div class={flex({ gap: 2, mb: 4, wrap: "wrap" })}>
                        {p.aesthetic?.colorTemperature && <span class={css({ fontSize: "xs", px: 2, py: 0.5, rounded: "sm", bg: "electric-purple", color: "off-white", fontWeight: "bold" })}>{p.aesthetic.colorTemperature}</span>}
                        {p.aesthetic?.density && <span class={css({ fontSize: "xs", px: 2, py: 0.5, rounded: "sm", bg: "neon-fuchsia", color: "off-white", fontWeight: "bold" })}>{p.aesthetic.density}</span>}
                      </div>
                      <div class={flex({ gap: 2, wrap: "wrap" })}>
                        <button onClick$={() => { genSelected.value = p.id; activeTab.value = "generate"; }} class={drippyButton("primary")}>⚡ Generate</button>
                        <button onClick$={() => { mbSelected.value = p.id; loadMoodboard(p.id); activeTab.value = "moodboard"; }} class={drippyButton("secondary")}>✺ Mood</button>
                        <button onClick$={() => { tokSelected.value = p.id; loadTokens(p.id, tokFormat.value); activeTab.value = "tokens"; }} class={drippyButton("ghost")}>▣ Tokens</button>
                        {p._source !== "base" && (
                          <>
                            <button onClick$={() => { fetch(`${API_BASE}/personas/${p.id}`).then((r) => r.json()).then((data) => { fillForm(data); editingId.value = p.id; activeTab.value = "create"; }); }} class={drippyButton("ghost")}>Edit</button>
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

          {/* === MOODBOARD === */}
          {activeTab.value === "moodboard" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "acid-lime", textTransform: "uppercase", mb: 4 })}>Moodboard</h2>
              <p class={css({ color: "text-muted", fontSize: "sm", mb: 5, maxW: "3xl" })}>
                Drop image URLs to teach Baste your aesthetic DNA. Pin the ones that hit hardest. The agent uses pinned references as primary inspiration when it generates brandkits & assets.
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
                  <input value={mbNewSrc.value} onInput$={(e) => { mbNewSrc.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="https://... or data:image/png;base64,..." />
                </div>
                <div class={flex({ direction: "column" })}>
                  <label class={labelCls}>Tags (comma)</label>
                  <div class={hstack({ gap: 2 })}>
                    <input value={mbNewTags.value} onInput$={(e) => { mbNewTags.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="slime, rebel, neon" />
                    <button onClick$={addReference} class={drippyButton("primary")}>Pin it</button>
                  </div>
                </div>
              </div>
              {mbSelected.value && mb.value.references.length === 0 && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 12, border: "2px dashed", borderColor: "electric-purple", rounded: "xl" })}>
                  No references yet. Paste a URL above to start the board.
                </div>
              )}
              <div class={grid({ columns: { base: 2, md: 3, lg: 4 }, gap: 4 })}>
                {mb.value.references.map((ref) => (
                  <div key={ref.id} class={css({
                    position: "relative", rounded: "xl", overflow: "hidden",
                    border: "3px solid", borderColor: ref.pinned ? "acid-lime" : "ink-black",
                    boxShadow: ref.pinned ? "0 0 24px rgba(198,255,0,0.45)" : "4px 5px 0 #0A0A0A",
                    aspectRatio: "1",
                    bg: "surface",
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
                    Drop a sheet image and slice it into a grid. Each cell becomes a candidate icon QuiverAI can re-render as a clean SVG. Cells with thumbs-up feed back into the agent's preference model.
                  </p>
                  <div class={grid({ columns: { base: 1, md: 4 }, gap: 3, mb: 4 })}>
                    <div class={css({ gridColumn: { md: "span 2" } })}>
                      <label class={labelCls}>Sheet image URL</label>
                      <input value={splitSrc.value} onInput$={(e) => { splitSrc.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="https://...generated-sheet.png" />
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
                          <div style={{
                            backgroundImage: `url(${c.src})`,
                            backgroundSize: `${100 * splitCols.value}% ${100 * splitRows.value}%`,
                            backgroundPosition: `${(c.x / (1 - c.w || 1)) * 100}% ${(c.y / (1 - c.h || 1)) * 100}%`,
                            width: "100%", height: "100%",
                          }} />
                          <button onClick$={() => { rankAssetId.value = c.id; rankSelected.value = mbSelected.value; activeTab.value = "rank"; }} class={css({ position: "absolute", bottom: 1, right: 1, fontSize: "10px", px: 1.5, py: 0.5, bg: "acid-lime", color: "ink-black", border: "none", rounded: "sm", fontWeight: "bold", cursor: "pointer" })}>rank →</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* === BRAND KIT === */}
          {activeTab.value === "brandkit" && (
            <section>
              <BrandKitView />
            </section>
          )}

          {/* === CREATE / FORGE === */}
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
                <div><label class={labelCls}>Summary</label><textarea value={pSummary.value} onInput$={(e) => { pSummary.value = (e.target as HTMLTextAreaElement).value; }} class={inputCls} placeholder="One-liner DNA..." style={{ minHeight: "80px" }} /></div>

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
                <div><label class={labelCls}>Spaces</label><input value={pSpaces.value} onInput$={(e) => { pSpaces.value = (e.target as HTMLInputElement).value; }} class={inputCls} placeholder="arcades, sewers, rooftops" /></div>
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
                      colorTemperature: pColorTemp, density: pDensity, edgeStyle: pEdge, motionStyle: pMotion,
                      typographyStyle: pTypography, textureStyle: pTexture, iconStyle: pIcon, layoutStyle: pLayout,
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

          {/* === GENERATE === */}
          {activeTab.value === "generate" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "acid-lime", textTransform: "uppercase", mb: 4 })}>Generate Assets</h2>
              <div class={grid({ columns: { base: 1, md: 2 }, gap: 4, mb: 4 })}>
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
              </div>
              <div class={flex({ align: "center", gap: 3, mb: 4 })}>
                <label class={css({ display: "flex", alignItems: "center", gap: 2, fontSize: "sm", color: "text-muted", cursor: "pointer" })}>
                  <input type="checkbox" checked={genDryRun.value} onChange$={(e) => { genDryRun.value = (e.target as HTMLInputElement).checked; }} />
                  Dry Run
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
                <button onClick$={startGeneration} disabled={genRunning.value} class={drippyButton("primary")}>{genRunning.value ? "Cooking..." : "⚡ Start"}</button>
                <button onClick$={previewPrompts} class={drippyButton("secondary")}>👁 Preview prompts</button>
                <button onClick$={() => { fetch(`${API_BASE}/jobs`).then((r) => r.json()).then((d) => { genJobs.value = d; }); }} class={drippyButton("ghost")}>↻ Jobs</button>
              </div>
              <div class={css({ bg: "ink-black", border: "2px solid token(colors.acid-lime)", rounded: "lg", overflow: "hidden", mb: 4 })}>
                <div class={css({ bg: "surface", px: 4, py: 2, fontSize: "xs", color: "acid-lime", fontFamily: "graffiti", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid token(colors.acid-lime)", display: "flex", justifyContent: "space-between", alignItems: "center" })}>
                  <span>▶ Logs</span>
                  <button onClick$={() => genLogs.value = []} class={css({ px: 2, py: 0.5, rounded: "sm", bg: "transparent", color: "text-muted", fontSize: "xs", border: "none", cursor: "pointer", _hover: { color: "neon-fuchsia" } })}>Clear</button>
                </div>
                <div class={css({ p: 4, fontFamily: "mono", fontSize: "xs", lineHeight: 1.6, maxH: "300px", overflowY: "auto", color: "acid-lime" })}>
                  {genLogs.value.length === 0 && <div><span class={css({ color: "electric-purple" })}>$</span> ready. pick persona & cook.</div>}
                  {genLogs.value.map((log, i) => <div key={i}><span class={css({ color: "electric-purple" })}>$</span> {log}</div>)}
                </div>
              </div>
              <h3 class={sectionTitle}>Recent jobs</h3>
              {genJobs.value.length === 0 && <div class={css({ color: "text-muted", fontSize: "sm" })}>No jobs yet.</div>}
              <div class={vstack({ gap: 1, alignItems: "stretch" })}>
                {genJobs.value.map((j) => <div key={j.id} class={css({ fontSize: "xs", px: 3, py: 2, rounded: "sm", bg: "surface", color: "text-muted", fontFamily: "mono", border: "1px solid token(colors.border)" })}>{j.id} — {j.type} · {j.personaId} · <span class={css({ color: j.status === "completed" ? "radioactive" : j.status === "error" ? "neon-fuchsia" : "melt-orange", fontWeight: "bold" })}>{j.status}</span></div>)}
              </div>
            </section>
          )}

          {/* === RANK === */}
          {activeTab.value === "rank" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "neon-fuchsia", textTransform: "uppercase", mb: 4 })}>Rank & Teach</h2>
              <p class={css({ color: "text-muted", fontSize: "sm", mb: 5, maxW: "3xl" })}>
                Thumbs up the assets that hit, trash the ones that don't. The agent uses these signals to bias future generations toward your taste.
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
                <textarea value={rankFeedback.value} onInput$={(e) => { rankFeedback.value = (e.target as HTMLTextAreaElement).value; }} class={inputCls} placeholder="too clean. needs more drip." style={{ minHeight: "70px" }} />
              </div>
              <div class={hstack({ gap: 3, mb: 6 })}>
                <button onClick$={() => submitRank(1)} class={drippyButton("primary")}>🔥 Fire — keep this energy</button>
                <button onClick$={() => submitRank(-1)} class={drippyButton("danger")}>🗑 Trash — never again</button>
              </div>

              {rankSelected.value && (
                <div class={grid({ columns: { base: 2, md: 4 }, gap: 4, mb: 6 })}>
                  <StatCard label="Total" value={rankStats.value.total} color="electric-purple" />
                  <StatCard label="🔥 Fire" value={rankStats.value.positive} color="acid-lime" />
                  <StatCard label="🗑 Trash" value={rankStats.value.negative} color="neon-fuchsia" />
                  <StatCard label="Vibe Score" value={(rankStats.value.score * 100).toFixed(0) + "%"} color="cyan-burst" />
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

          {/* === TOKENS === */}
          {activeTab.value === "tokens" && (
            <section>
              <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "cyan-burst", textTransform: "uppercase", mb: 4 })}>Export Tokens</h2>
              <div class={flex({ gap: 3, mb: 4, wrap: "wrap", alignItems: "flex-end" })}>
                <div>
                  <label class={labelCls}>Persona</label>
                  <select value={tokSelected.value} onChange$={(e) => { tokSelected.value = (e.target as HTMLSelectElement).value; if (tokSelected.value) loadTokens(tokSelected.value, tokFormat.value); else tokContent.value = ""; }} class={css({ w: "64", bg: "ink-black", border: "2px solid token(colors.electric-purple)", color: "off-white", px: 3, py: 2, rounded: "md", fontSize: "sm", fontFamily: "mono" })}>
                    <option value="">— Choose —</option>
                    {personas.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label class={labelCls}>Format</label>
                  <select value={tokFormat.value} onChange$={(e) => { tokFormat.value = (e.target as HTMLSelectElement).value; if (tokSelected.value) loadTokens(tokSelected.value, tokFormat.value); }} class={css({ w: "56", bg: "ink-black", border: "2px solid token(colors.electric-purple)", color: "off-white", px: 3, py: 2, rounded: "md", fontSize: "sm", fontFamily: "mono" })}>
                    <option value="css">CSS</option>
                    <option value="tailwind">Tailwind</option>
                    <option value="json">JSON</option>
                    <option value="panda">PandaCSS</option>
                  </select>
                </div>
                {tokContent.value && (
                  <button onClick$={() => { if (!tokContent.value || !tokSelected.value) return; const extMap: Record<string, string> = { css: "css", tailwind: "js", json: "json", panda: "ts" }; const ext = extMap[tokFormat.value] || "txt"; const blob = new Blob([tokContent.value], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${tokSelected.value}-tokens.${ext}`; a.click(); showToast(`Got ${ext}`); }} class={drippyButton("primary")}>↓ Download</button>
                )}
              </div>
              {tokLoading.value && <div class={css({ color: "text-muted", textAlign: "center", py: 8 })}>Cooking tokens...</div>}
              {!tokLoading.value && tokContent.value && (
                <pre class={css({ bg: "ink-black", border: "2px solid token(colors.cyan-burst)", rounded: "lg", p: 4, fontFamily: "mono", fontSize: "xs", color: "acid-lime", maxH: "500px", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" })}>{tokContent.value}</pre>
              )}
              {!tokLoading.value && !tokContent.value && tokSelected.value && (
                <div class={css({ color: "text-muted", textAlign: "center", py: 8 })}>Pick a format to preview tokens.</div>
              )}
            </section>
          )}
        </div>
      </main>
      <Footer />
      {toastShow.value && (
        <div class={css({
          position: "fixed", bottom: 6, right: 6, zIndex: 200,
          bg: "ink-black", color: toastType.value === "error" ? "neon-fuchsia" : toastType.value === "warn" ? "melt-orange" : "acid-lime",
          fontFamily: "graffiti", textTransform: "uppercase", letterSpacing: "0.05em",
          px: 5, py: 3, rounded: "lg", fontSize: "sm", fontWeight: "bold",
          border: "2px solid",
          borderColor: toastType.value === "error" ? "neon-fuchsia" : toastType.value === "warn" ? "melt-orange" : "acid-lime",
          boxShadow: "5px 6px 0 rgba(138,0,255,0.8)",
        })}>{toastMsg.value}</div>
      )}
    </>
  );
});

// === Subcomponents ========================================================

const StatCard = component$<{ label: string; value: string | number; color: string }>(({ label, value, color }) => {
  return (
    <div class={css({
      p: 4, rounded: "xl", bg: "surface",
      border: "2px solid", borderColor: "ink-black",
      boxShadow: `4px 5px 0 token(colors.${color as any})`,
    })}>
      <div class={css({ fontSize: "xs", color: "text-muted", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: "bold", mb: 1 })}>{label}</div>
      <div class={css({ fontSize: "3xl", fontFamily: "graffiti", color: color as any, lineHeight: 1 })}>{value}</div>
    </div>
  );
});

const BrandKitView = component$(() => {
  const palette = [
    { name: "Acid Lime", hex: "#C6FF00", token: "acid-lime" },
    { name: "Toxic Green", hex: "#7BFF36", token: "toxic-green" },
    { name: "Radioactive", hex: "#00E676", token: "radioactive" },
    { name: "Melt Orange", hex: "#FF9B21", token: "melt-orange" },
    { name: "Electric Purple", hex: "#8A00FF", token: "electric-purple" },
    { name: "Neon Fuchsia", hex: "#FF00B8", token: "neon-fuchsia" },
    { name: "Cyan Burst", hex: "#00F0FF", token: "cyan-burst" },
    { name: "Ink Black", hex: "#0A0A0A", token: "ink-black" },
    { name: "Off White", hex: "#F5F5F2", token: "off-white" },
  ];
  const icons = ["✦", "⚡", "★", "☺", "♥", "✺", "▣", "✸", "♪"];
  const moods = ["BOLD", "PLAYFUL", "REBELLIOUS", "CREATIVE", "COMMUNITY"];
  const textures = ["SLIME DRIP", "SPLATTER", "GRAFFITI STROKE", "HALFTONE", "SKATE GRIP", "NEON GLOW"];

  return (
    <>
      <h2 class={css({ fontFamily: "graffiti", fontSize: "2xl", color: "acid-lime", textTransform: "uppercase", mb: 1 })}>Brand Kit</h2>
      <p class={css({ color: "text-muted", fontSize: "sm", mb: 6 })}>The Baste system bible. Every persona generates its own.</p>

      <div class={grid({ columns: { base: 1, lg: 3 }, gap: 5 })}>
        {/* Logo */}
        <div class={css({ p: 6, rounded: "xl", bg: "off-white", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.electric-purple)" })}>
          <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "electric-purple", mb: 4 })}>Primary Logo</div>
          <div class={flex({ justify: "center", py: 4 })}>
            <BasteLogo size={140} withWord />
          </div>
          <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "electric-purple", mt: 6, mb: 2 })}>Icon / Avatar</div>
          <div class={flex({ justify: "center", py: 2 })}>
            <BasteLogo size={88} />
          </div>
        </div>

        {/* Palette */}
        <div class={css({ p: 6, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.acid-lime)" })}>
          <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "acid-lime", mb: 4 })}>Palette</div>
          <div class={grid({ columns: 3, gap: 2 })}>
            {palette.map((c) => (
              <div key={c.token} class={css({ rounded: "md", overflow: "hidden", border: "2px solid token(colors.ink-black)" })}>
                <div style={{ background: c.hex, height: "60px" }} />
                <div class={css({ p: 2, fontSize: "10px", bg: "ink-black", fontFamily: "mono" })}>
                  <div class={css({ fontWeight: "bold", color: "off-white", textTransform: "uppercase" })}>{c.name}</div>
                  <div class={css({ color: "text-muted" })}>{c.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* UI Elements */}
        <div class={css({ p: 6, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.neon-fuchsia)" })}>
          <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "neon-fuchsia", mb: 4 })}>UI Elements</div>
          <div class={vstack({ gap: 3, alignItems: "stretch" })}>
            <div>
              <div class={css({ fontSize: "10px", color: "text-muted", mb: 1, textTransform: "uppercase" })}>Primary</div>
              <button class={css({ w: "full", py: 2.5, bg: "acid-lime", color: "ink-black", fontFamily: "graffiti", textTransform: "uppercase", fontWeight: "bold", border: "2px solid token(colors.ink-black)", rounded: "lg", boxShadow: "4px 5px 0 #0A0A0A", cursor: "pointer" })}>Launch project »</button>
            </div>
            <div>
              <div class={css({ fontSize: "10px", color: "text-muted", mb: 1, textTransform: "uppercase" })}>Secondary</div>
              <button class={css({ w: "full", py: 2.5, bg: "electric-purple", color: "off-white", fontFamily: "graffiti", textTransform: "uppercase", fontWeight: "bold", border: "2px solid token(colors.ink-black)", rounded: "lg", boxShadow: "4px 5px 0 #0A0A0A", cursor: "pointer" })}>View drop »</button>
            </div>
            <div>
              <div class={css({ fontSize: "10px", color: "text-muted", mb: 1, textTransform: "uppercase" })}>Ghost</div>
              <button class={css({ w: "full", py: 2.5, bg: "transparent", color: "acid-lime", fontFamily: "graffiti", textTransform: "uppercase", fontWeight: "bold", border: "2px solid token(colors.acid-lime)", rounded: "lg", cursor: "pointer" })}>Learn more »</button>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div class={css({ p: 6, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.cyan-burst)" })}>
          <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "cyan-burst", mb: 4 })}>Typography</div>
          <div class={css({ fontFamily: "graffiti", fontSize: "3xl", textTransform: "uppercase", lineHeight: 1 })}><span class="baste-drip-text">Baste Mode</span></div>
          <div class={css({ fontFamily: "graffiti", fontStyle: "italic", color: "electric-purple", mt: 2, mb: 4 })}>Racing Fuel</div>
          <div class={css({ fontFamily: "body", color: "text-muted", fontSize: "sm" })}>Inter Regular — clean & readable for UI text</div>
          <div class={css({ fontFamily: "mono", color: "acid-lime", fontSize: "xs", mt: 2 })}>JetBrains Mono — for code & system output</div>
        </div>

        {/* Mood Tags */}
        <div class={css({ p: 6, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.melt-orange)" })}>
          <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "melt-orange", mb: 4 })}>Mood Tags</div>
          <div class={flex({ gap: 2, wrap: "wrap" })}>
            {moods.map((m, i) => {
              const colors = ["acid-lime", "electric-purple", "neon-fuchsia", "cyan-burst", "melt-orange"];
              return (
                <span key={m} class={css({ px: 3, py: 1.5, rounded: "lg", bg: colors[i] as any, color: "ink-black", fontFamily: "graffiti", fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", border: "2px solid token(colors.ink-black)" })}>{m}</span>
              );
            })}
          </div>
          <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "melt-orange", mt: 6, mb: 2 })}>Textures & Patterns</div>
          <div class={flex({ gap: 2, wrap: "wrap" })}>
            {textures.map((t) => (
              <span key={t} class={css({ px: 2, py: 1, rounded: "sm", bg: "ink-black", color: "off-white", fontFamily: "mono", fontSize: "10px", border: "1px solid token(colors.electric-purple)" })}>{t}</span>
            ))}
          </div>
        </div>

        {/* Icon set */}
        <div class={css({ p: 6, rounded: "xl", bg: "surface", border: "2px solid token(colors.ink-black)", boxShadow: "5px 6px 0 token(colors.radioactive)" })}>
          <div class={css({ fontSize: "xs", fontWeight: "bold", textTransform: "uppercase", color: "radioactive", mb: 4 })}>Icon System</div>
          <div class={grid({ columns: 3, gap: 3 })}>
            {icons.map((ic, i) => {
              const colors = ["acid-lime", "neon-fuchsia", "cyan-burst", "melt-orange", "electric-purple", "radioactive", "toxic-green", "off-white", "neon-fuchsia"];
              return (
                <div key={i} class={css({ aspectRatio: "1", rounded: "md", bg: "ink-black", border: "2px solid", borderColor: colors[i] as any, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2xl", color: colors[i] as any })}>{ic}</div>
              );
            })}
          </div>
          <div class={css({ mt: 4, fontSize: "10px", color: "text-muted", textAlign: "center", fontStyle: "italic" })}>Replace placeholders with QuiverAI-generated SVGs.</div>
        </div>
      </div>

      {/* Footer banner */}
      <div class={css({ mt: 8, p: 6, rounded: "xl", bg: "ink-black", border: "2px solid token(colors.acid-lime)", textAlign: "center" })}>
        <div class={css({ fontFamily: "graffiti", fontSize: { base: "2xl", md: "4xl" }, textTransform: "uppercase", letterSpacing: "0.04em" })}>
          <span class={css({ color: "acid-lime" })}>Make.</span> <span class={css({ color: "electric-purple" })}>Share.</span> <span class={css({ color: "neon-fuchsia" })}>Slay.</span>
        </div>
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "Baste Studio — Co-create great designs",
};
