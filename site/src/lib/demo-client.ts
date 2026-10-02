import type { BasteClient } from './api';
import type {
  AssetRank, FeedbackEntry, FeedbackSummary, Job, Moodboard,
  OpenPencilDoc, Persona, PersonaRecord, PromptPreview, ServerConfig,
} from './api-types';
import { DEMO_PERSONAS, DEMO_TOKENS, DEMO_TOKEN_EXPORTS, DEMO_PROMPTS, DEMO_OPENPENCIL } from './demo-data';

const REQUIRES_SERVER = 'Requires the local Baste server — run: baste gui';
const clone = <T>(value: T): T => structuredClone(value);

/** Each instance owns its data. Demo writes never mutate the generated fixtures. */
export function createDemoClient(): BasteClient {
  const personas = new Map(DEMO_PERSONAS.map((p) => [p.id, clone(p)]));
  const baseIds = new Set(DEMO_PERSONAS.map((p) => p.id));
  const boards = new Map<string, Moodboard>();
  const ranks: AssetRank[] = [];
  const feedback: FeedbackEntry[] = [];
  const documents = new Map<string, OpenPencilDoc>();
  const jobs = new Map<string, { job: Job; startedAt: number; samplePrompt: string }>();
  let counter = 0;
  let config: ServerConfig = {
    outputDir: './assets/output', personaDir: './personas', outputCount: 3,
    generators: {
      svg: { provider: 'quiver' },
      image: { provider: 'openai', model: 'gpt-image-2', size: '1024x1024', quality: 'high', style: 'vivid' },
      video: { provider: 'veo', model: 'veo-3', duration: 5, quality: '1080p' },
    },
    evaluator: {
      model: 'gpt-4o', temperature: 0.3,
      weights: { personaAlignment: 0.3, visualQuality: 0.2, uniqueness: 0.2, coherence: 0.15, usability: 0.15 },
    },
    qd: {
      features: [
        { name: 'color_temperature', min: -1, max: 1, bins: 5 },
        { name: 'visual_density', min: 0, max: 1, bins: 5 },
        { name: 'abstractness', min: 0, max: 1, bins: 3 },
      ],
      iterations: 5, batchSize: 3, mutationRate: 0.4, qualityThreshold: 0.5,
    },
    assetTypes: [
      { kind: 'svg', purpose: 'icon', description: 'App icon' },
      { kind: 'image', purpose: 'hero', description: 'Hero banner', constraints: { aspectRatio: '21:9' } },
      { kind: 'image', purpose: 'background', description: 'Ambient background', constraints: { aspectRatio: '16:9' } },
    ],
  };

  const requirePersona = (id: string): PersonaRecord => {
    const p = personas.get(id);
    if (!p) throw new Error('Persona not found');
    return p;
  };
  const boardFor = (id: string): Moodboard => {
    let board = boards.get(id);
    if (!board) {
      board = { personaId: id, references: [], notes: '', vibe: [] };
      boards.set(id, board);
    }
    return board;
  };
  // Custom demo personas borrow a generated fixture with the closest aesthetic.
  // Fresh prompt/token generation for arbitrary personas belongs to the local server.
  const templateFor = (p: Persona): PersonaRecord => {
    if (baseIds.has(p.id)) return DEMO_PERSONAS.find((base) => base.id === p.id)!;
    const score = (base: Persona) => [
      base.aesthetic.colorTemperature === p.aesthetic.colorTemperature,
      base.aesthetic.density === p.aesthetic.density,
      base.aesthetic.typographyStyle === p.aesthetic.typographyStyle,
      base.aesthetic.edgeStyle === p.aesthetic.edgeStyle,
      base.aesthetic.motionStyle === p.aesthetic.motionStyle,
    ].filter(Boolean).length;
    return [...DEMO_PERSONAS].sort((a, b) => score(b) - score(a))[0];
  };
  const previewFor = (id: string): PromptPreview => {
    const p = requirePersona(id);
    const base = templateFor(p);
    const preview = clone(DEMO_PROMPTS[base.id]);
    preview.personaId = id;
    for (const kind of ['image', 'svg', 'video'] as const) {
      preview[kind].prompt = preview[kind].prompt.replaceAll(base.name, p.name);
    }
    return preview;
  };
  const progressJob = (id: string): Job => {
    const entry = jobs.get(id);
    if (!entry) throw new Error('Job not found');
    const elapsed = Date.now() - entry.startedAt;
    const messages = [
      entry.job.logs[0],
      '[DRY RUN] Prompts would be generated but no API calls made.',
      `Sample image prompt: ${entry.samplePrompt.slice(0, 120)}...`,
      'Demo dry run complete.',
    ];
    entry.job.logs = messages.slice(0, Math.min(4, 1 + Math.floor(elapsed / 1000)));
    if (elapsed >= 3000) {
      entry.job.status = 'completed';
      entry.job.result = { dryRun: true, samplePrompt: entry.samplePrompt };
    }
    return clone(entry.job);
  };
  const unsupported = async (): Promise<never> => { throw new Error(REQUIRES_SERVER); };

  const client: BasteClient = {
    mode: 'demo',
    health: async () => ({ status: 'ok', version: '0.2.0' }),
    listPersonas: async () => clone([...personas.values()]),
    getPersona: async (id) => clone(requirePersona(id)),
    createPersona: async (p) => {
      if (!p.id || !p.name) throw new Error('id and name are required');
      if (baseIds.has(p.id)) throw new Error(`Cannot overwrite base persona "${p.id}"`);
      personas.set(p.id, { ...clone(p), _source: 'custom' });
      documents.delete(p.id);
      return { success: true, id: p.id };
    },
    updatePersona: async (id, p) => {
      const existing = requirePersona(id);
      if (baseIds.has(id)) throw new Error('Cannot modify base personas');
      personas.set(id, { ...existing, ...clone(p), id, _source: 'custom' });
      documents.delete(id);
      return { success: true, id };
    },
    deletePersona: async (id) => {
      if (baseIds.has(id) || !personas.delete(id)) throw new Error('Cannot delete base persona or not found');
      documents.delete(id);
      return { success: true };
    },
    exportTokens: async (id, format) => {
      const p = requirePersona(id);
      const base = templateFor(p);
      const extensions = { css: 'css', tailwind: 'js', json: 'json', panda: 'ts' };
      if (!(format in extensions)) throw new Error('Unknown format. Use css, tailwind, json, or panda');
      const content = format === 'json'
        ? JSON.stringify(await client.designTokens(id), null, 2)
        : DEMO_TOKEN_EXPORTS[base.id][format].replaceAll(base.name, p.name);
      return { format, ext: extensions[format], content, personaId: id };
    },
    designTokens: async (id) => {
      const p = requirePersona(id);
      return clone(DEMO_TOKENS[templateFor(p).id]);
    },
    previewPrompts: async (id) => previewFor(id),
    generate: async (id, req) => {
      const p = requirePersona(id);
      const jobId = `job-${++counter}-${Date.now()}`;
      jobs.set(jobId, {
        startedAt: Date.now(), samplePrompt: previewFor(id).image.prompt,
        job: {
          id: jobId, personaId: id, type: req.type === 'ui-kit' ? 'ui-kit' : 'suite', status: 'running',
          logs: [`Starting generation for "${p.name}"...`],
        },
      });
      return { jobId, status: 'started' };
    },
    listJobs: async () => [...jobs.keys()].reverse().map((id) => {
      const job = progressJob(id);
      return { id: job.id, personaId: job.personaId, type: job.type, status: job.status };
    }),
    getJob: async (id) => progressJob(id),
    getBrandKit: async () => null,
    getMoodboard: async (id) => clone(boardFor(id)),
    putMoodboard: async (id, board) => {
      boards.set(id, {
        personaId: id, references: clone(board.references || []), notes: board.notes || '', vibe: clone(board.vibe || []),
      });
      return { success: true };
    },
    addReference: async (id, ref) => {
      if (!ref.src) throw new Error('src required');
      const reference = {
        id: `ref-${Date.now()}-${++counter}`, src: ref.src, tags: clone(ref.tags || []), pinned: false, addedAt: Date.now(),
      };
      boardFor(id).references.push(reference);
      return clone(reference);
    },
    decompose: unsupported,
    remix: unsupported,
    rank: async (req) => {
      if (!req.assetId || !req.personaId || typeof req.score !== 'number') {
        throw new Error('assetId, personaId, score required');
      }
      const entry: AssetRank = {
        assetId: req.assetId, personaId: req.personaId,
        score: Math.max(-1, Math.min(1, req.score)), feedback: req.feedback || '', ts: Date.now(),
      };
      ranks.push(entry);
      feedback.push({
        ...entry, assetType: req.assetType, prompt: req.prompt,
        features: clone(req.features), tags: clone(req.tags),
      });
      return { success: true, total: ranks.length };
    },
    getRanks: async (id) => {
      const entries = ranks.filter((r) => r.personaId === id);
      const positive = entries.filter((r) => r.score > 0).length;
      const negative = entries.filter((r) => r.score < 0).length;
      return {
        personaId: id, total: entries.length, positive, negative,
        score: entries.length ? (positive - negative) / entries.length : 0,
        trend: entries.slice(-10).map((r) => r.score), recent: clone(entries.slice(-20).reverse()),
      };
    },
    getFeedback: async (id) => summarizeDemoFeedback(feedback.filter((e) => e.personaId === id)),
    getOpenPencil: async (id) => {
      const p = requirePersona(id);
      const saved = documents.get(id);
      if (saved) return clone(saved);
      const base = templateFor(p);
      const doc = clone(DEMO_OPENPENCIL[base.id]);
      doc.metadata = { ...doc.metadata, personaId: id, personaName: p.name, exportedAt: Date.now() };
      doc.culturalContext.rationale = doc.culturalContext.rationale.replaceAll(base.name, p.name);
      return doc;
    },
    saveOpenPencil: async (id, doc) => {
      requirePersona(id);
      if (!doc) throw new Error('document required');
      documents.set(id, clone(doc));
      return { success: true };
    },
    writeOpenPencilFile: unsupported,
    toggleOpenPencilWatch: unsupported,
    split: unsupported,
    getConfig: async () => clone(config),
    saveConfig: async (cfg) => { config = clone(cfg); return { success: true }; },
    proxyUrl: (url) => url,
  };
  return client;
}

function summarizeDemoFeedback(entries: FeedbackEntry[]): FeedbackSummary {
  const ups = entries.filter((e) => e.score > 0);
  const downs = entries.filter((e) => e.score < 0);
  const topTags = (list: FeedbackEntry[]) => {
    const counts = new Map<string, number>();
    for (const tag of list.flatMap((e) => e.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count }));
  };
  const recent = entries.slice(-40);
  return {
    total: entries.length, positive: ups.length, negative: downs.length,
    topUpTags: topTags(ups), topDownTags: topTags(downs), recent: clone(entries.slice(-15).reverse()),
    document: recent.length ? [
      `## Learned Preferences (${recent.length} feedback events)`,
      ...recent.map((e) => `${e.score > 0 ? '+' : e.score < 0 ? '−' : '0'} ${e.feedback || e.prompt || e.assetId || ''}`),
    ].join('\n') : '',
  };
}
