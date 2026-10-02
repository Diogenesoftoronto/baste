import { z } from "zod";
import { PROJECT_LIMITS } from "./contracts.js";

export const projectIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const commandId = z.string().min(1).max(PROJECT_LIMITS.commandId).regex(/^[a-zA-Z0-9_-]+$/);
const name = z.string().trim().min(1).max(PROJECT_LIMITS.name);
const brief = z.string().max(PROJECT_LIMITS.brief);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const personaId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const text = z.string().max(20000);
const texts = z.array(text).max(200);

export const personaSchema = z.object({
  id: personaId, name: text, summary: text,
  culture: z.object({
    region: text.optional(), subcultures: texts, values: texts,
    language: z.object({ primary: text, vernacular: texts }).strict().optional(),
  }).strict(),
  influences: z.object({
    films: texts, shows: texts, anime: texts,
    music: z.object({ genres: texts, artists: texts }).strict(),
    games: texts, visualArtists: texts, fashion: texts, spaces: texts, tools: texts, obsessions: texts,
  }).strict(),
  behaviors: z.object({ discovery: texts, interfaceValues: texts, platforms: texts, expression: texts, petPeeves: texts }).strict(),
  aesthetic: z.object({
    colorTemperature: z.enum(["warm", "cool", "neutral", "high-contrast", "muted"]),
    density: z.enum(["minimal", "dense", "rich", "maximalist"]),
    edgeStyle: z.enum(["sharp", "soft", "organic", "geometric", "brutalist"]),
    motionStyle: z.enum(["smooth", "snappy", "liquid", "mechanical"]),
    typographyStyle: z.enum(["clean", "expressive", "retro", "futuristic", "handcrafted"]),
    textureStyle: z.enum(["flat", "textured", "noisy", "clean", "grainy"]),
    iconStyle: z.enum(["line", "filled", "hand-drawn", "geometric", "abstract"]),
    layoutStyle: z.enum(["grid", "organic", "asymmetric", "brutalist", "editorial"]),
    visualKeywords: texts, moodKeywords: texts,
  }).strict(),
}).strict();

export const createProjectSchema = z.object({ commandId, name, brief, personaId: personaId.optional() }).strict();
const base = { commandId, baseRevision: revision };
export const projectCommandSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("update_details"), name, brief }).strict(),
  z.object({ ...base, kind: z.literal("select_audience"), personaId: personaId.nullable() }).strict(),
  z.object({ ...base, kind: z.literal("restore_revision"), targetRevision: revision }).strict(),
]);

const timestamp = z.string().datetime();
const projectSchema = z.object({
  schemaVersion: z.literal(1), id: projectIdSchema, name, brief,
  audience: personaSchema.nullable(),
  partner: z.object({
    id: z.string().min(1).max(100), name: text, personaRevision: revision,
    introduction: text, likes: texts, dislikes: texts, portraitAssetId: z.string().max(200).optional(),
  }).strict().nullable(),
  revision, createdAt: timestamp, updatedAt: timestamp,
}).strict();

export const recordSchema = z.object({
  schemaVersion: z.literal(1),
  snapshots: z.array(z.object({
    project: projectSchema,
    entry: z.object({
      revision, kind: z.enum(["created", "details_updated", "audience_selected", "revision_restored"]),
      summary: z.string().max(500), createdAt: timestamp, restoredFrom: revision.optional(),
    }).strict(),
  }).strict()).min(1),
  receipts: z.array(z.object({ commandId, fingerprint: z.string().regex(/^[0-9a-f]{64}$/), revision }).strict()).min(1),
}).strict();

export type ProjectRecord = z.infer<typeof recordSchema>;
