/**
 * What a looking judge is shown besides the candidate: images of the persona's
 * world, and assets the user has rated. Loaded once per run, already converted
 * to stills, so each judgment only adds its own candidate.
 *
 * - References: moodboard pins first, then `baste culture` images, then a
 *   decomposed site's mirrored share image and palette swatch, then the board's
 *   unpinned references.
 * - Examples: the latest upvoted and downvoted SVG and image assets that are
 *   still on disk, grouped by kind so an icon is compared with icons.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Persona } from "../persona/types.js";
import { readMoodboard } from "../persona/moodboard.js";
import { loadBrandKit } from "../notorganic/brandkits.js";
import { accountScope } from "../notorganic/scope.js";
import { safeFetchBuffer } from "../shared/url.js";
import { stillFromBuffer, stillFromFile, type Still } from "../shared/stills.js";
import { parseImageDimensionsFromBuffer } from "../shared/img-dims.js";
import { loadFeedback } from "./feedback-memory.js";

export interface JudgeImage {
  still: Still;
  /** Where it came from, as the judge reads it: "moodboard pin", "culture reference", ... */
  origin: string;
  /** Tags, feedback or a description, when the user gave one. */
  note?: string;
}

export interface RatedExamples { liked: JudgeImage[]; disliked: JudgeImage[] }

export interface JudgeContext {
  references: JudgeImage[];
  examples: { image: RatedExamples; svg: RatedExamples };
}

export const MAX_REFERENCES = 4;
export const MAX_EXAMPLES = 3;
/** Smaller sources are favicons, spacers and tracking pixels, not references. */
const MIN_REFERENCE_SIDE = 128;
const REFERENCE_SIDE = 512;
const EXAMPLE_SIDE = 448;

interface Source { origin: string; note?: string; url?: string; path?: string }

/** Read one source into a still, or nothing when it cannot be fetched or decoded. */
async function load(source: Source): Promise<JudgeImage | undefined> {
  try {
    const data = source.url
      ? (await safeFetchBuffer(source.url, { timeoutMs: 10_000, maxBytes: 16 * 1024 * 1024 })).data
      : source.path && statSync(source.path).isFile() && statSync(source.path).size <= 16 * 1024 * 1024
        ? readFileSync(source.path)
        : undefined;
    if (!data) return undefined;
    const size = parseImageDimensionsFromBuffer(data);
    if (size && Math.min(size.width, size.height) < MIN_REFERENCE_SIDE) return undefined;
    const still = await stillFromBuffer(data, REFERENCE_SIDE);
    return still ? { still, origin: source.origin, ...(source.note ? { note: source.note } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

/** Culture references added with `baste culture`, when this workspace has a design history. */
async function cultureSources(personaId: string): Promise<Source[]> {
  // Hosted accounts keep their own history; the workstation's file is not theirs.
  if (accountScope.getStore() || !existsSync(resolve(".baste", "versions.db"))) return [];
  try {
    const { getDB } = await import("../versioning/database.js");
    // Decomposed sites record image URLs; `baste culture` records local files.
    return getDB().getCulturalRefs(personaId)
      .filter((ref) => ref.type === "image" && ref.source)
      .map((ref) => /^https?:\/\//i.test(ref.source!)
        ? { origin: "culture reference", url: ref.source, note: ref.description ?? ref.designRationale }
        : { origin: "culture reference", path: ref.source, note: ref.description ?? ref.designRationale })
      .filter((source) => source.url || /\.(png|jpe?g|webp|gif|svg)$/i.test(source.path!));
  } catch {
    return [];
  }
}

/** Images a decomposed site left on disk: its share image, and its palette as a swatch. */
function brandSources(personaId: string): { sources: Source[]; mirrored: Set<string> } {
  try {
    const kit = loadBrandKit(personaId);
    const local = kit?.localAssets;
    if (!kit || !local) return { sources: [], mirrored: new Set() };
    const sources: Source[] = [];
    const mirrored = new Set<string>();
    if (local.ogImage) {
      sources.push({ origin: "brand share image", path: local.ogImage, note: kit.title });
      if (kit.ogImage) mirrored.add(kit.ogImage);
    }
    if (local.paletteSwatch) sources.push({ origin: "brand palette", path: local.paletteSwatch, note: kit.palette.slice(0, 8).join(" ") });
    for (const thumb of local.thumbnails) mirrored.add(thumb.source);
    return { sources, mirrored };
  } catch {
    return { sources: [], mirrored: new Set() };
  }
}

/** The persona's own images, best first, until `limit` load. */
export async function loadReferences(persona: Persona, limit = MAX_REFERENCES): Promise<JudgeImage[]> {
  const board = readMoodboard(persona.id);
  const brand = brandSources(persona.id);
  // A brand image already read from disk is not fetched again from the board.
  const refs = [...(board?.references ?? [])].filter((r) => /^https?:\/\//i.test(r.src)).sort((a, b) => b.addedAt - a.addedAt);
  const note = (tags: string[]) => tags.filter((t) => !/^https?:/i.test(t)).join(", ") || undefined;
  const sources: Source[] = [
    ...refs.filter((r) => r.pinned).map((r) => ({ origin: "moodboard pin", url: r.src, note: note(r.tags) })),
    ...await cultureSources(persona.id),
    ...brand.sources,
    ...refs.filter((r) => !r.pinned && !brand.mirrored.has(r.src)).map((r) => ({ origin: "moodboard reference", url: r.src, note: note(r.tags) })),
  ];
  const found: JudgeImage[] = [];
  // Fetch a few at a time and stop once enough have loaded; dead links cannot stall a run.
  for (let i = 0; i < Math.min(sources.length, limit * 3) && found.length < limit; i += limit) {
    const batch = await Promise.all(sources.slice(i, i + limit).map(load));
    for (const image of batch) if (image && found.length < limit) found.push(image);
  }
  return found;
}

const ASSET_ID = /^[a-zA-Z0-9_.-]{1,200}$/;
const KINDS = [["image", "images", ["png", "jpg", "jpeg", "webp"]], ["svg", "svg", ["svg"]]] as const;

/** A rated asset's file in the output directory, and which kind it is. */
function findAsset(outputDir: string, assetId: string): { kind: "image" | "svg"; path: string } | undefined {
  if (!ASSET_ID.test(assetId) || assetId.includes("..")) return undefined;
  for (const [kind, dir, extensions] of KINDS) {
    for (const extension of extensions) {
      const path = join(outputDir, dir, `${assetId}.${extension}`);
      if (existsSync(path)) return { kind, path };
    }
  }
  return undefined;
}

/** The latest liked and disliked assets per kind, each asset counted once at its latest rating. */
export async function loadExamples(personaId: string, outputDir: string, limit = MAX_EXAMPLES): Promise<JudgeContext["examples"]> {
  const examples: JudgeContext["examples"] = { image: { liked: [], disliked: [] }, svg: { liked: [], disliked: [] } };
  const seen = new Set<string>();
  const picked: Array<{ kind: "image" | "svg"; side: "liked" | "disliked"; path: string; note?: string }> = [];
  let feedback: ReturnType<typeof loadFeedback> = [];
  try { feedback = loadFeedback(personaId); } catch { return examples; }
  for (const entry of feedback.reverse()) {
    if (!entry.assetId || seen.has(entry.assetId)) continue;
    seen.add(entry.assetId);
    if (entry.score === 0) continue;
    const asset = findAsset(outputDir, entry.assetId);
    if (!asset) continue;
    const side = entry.score > 0 ? "liked" : "disliked";
    if (picked.filter((p) => p.kind === asset.kind && p.side === side).length >= limit) continue;
    picked.push({ ...asset, side, note: entry.feedback || undefined });
  }
  const loaded = await Promise.all(picked.map(async (p) => ({ ...p, still: await stillFromFile(p.path, EXAMPLE_SIDE) })));
  for (const p of loaded) {
    if (p.still) examples[p.kind][p.side].push({ still: p.still, origin: p.side === "liked" ? "upvoted asset" : "downvoted asset", ...(p.note ? { note: p.note } : {}) });
  }
  return examples;
}

export async function loadJudgeContext(persona: Persona, outputDir: string): Promise<JudgeContext> {
  const [references, examples] = await Promise.all([loadReferences(persona), loadExamples(persona.id, outputDir)]);
  return { references, examples };
}
