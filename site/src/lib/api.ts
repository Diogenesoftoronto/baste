import type {
  AddReferenceRequest, BrandKit, DecomposeRequest, DecomposeResult, DesignTokens,
  FeedbackSummary, GenerateRequest, GenerateResponse, GenerationPlan, HealthResult, Job, JobSummary,
  Moodboard, MoodboardReference, OpenPencilDoc, OpenPencilFileResult, OpenPencilWatchResult,
  Persona, PersonaRecord, PersonaWriteResult, PromptPreview, RankRequest, RankResult,
  RankStats, RemixRequest, RemixResult, ServerConfig, SplitRequest, SplitResult,
  SuccessResult, TokenExport, TokenFormat,
} from './api-types';
import { createDemoClient } from './demo-client';

export type * from './api-types';
export { createDemoClient } from './demo-client';
export const DEFAULT_API = '/api';

export interface BasteClient {
  readonly mode: 'live' | 'demo';
  setCsrfToken?(token?: string): void;
  health(): Promise<HealthResult>;
  listPersonas(): Promise<PersonaRecord[]>;
  getPersona(id: string): Promise<PersonaRecord>;
  createPersona(p: Persona): Promise<PersonaWriteResult>;
  updatePersona(id: string, p: Partial<Persona>): Promise<PersonaWriteResult>;
  deletePersona(id: string): Promise<SuccessResult>;
  exportTokens(id: string, format: TokenFormat): Promise<TokenExport>;
  designTokens(id: string): Promise<DesignTokens>;
  previewPrompts(id: string): Promise<PromptPreview>;
  generate(id: string, req: GenerateRequest): Promise<GenerateResponse>;
  planGeneration?(id: string, req: GenerateRequest): Promise<GenerationPlan>;
  listJobs(): Promise<JobSummary[]>;
  getJob(id: string): Promise<Job>;
  getBrandKit(id: string): Promise<BrandKit | null>;
  getMoodboard(id: string): Promise<Moodboard>;
  putMoodboard(id: string, board: Partial<Moodboard>): Promise<SuccessResult>;
  addReference(id: string, ref: AddReferenceRequest): Promise<MoodboardReference>;
  decompose(req: DecomposeRequest): Promise<DecomposeResult>;
  remix(req: RemixRequest): Promise<RemixResult>;
  rank(req: RankRequest): Promise<RankResult>;
  getRanks(id: string): Promise<RankStats>;
  getFeedback(id: string): Promise<FeedbackSummary>;
  getOpenPencil(id: string): Promise<OpenPencilDoc>;
  saveOpenPencil(id: string, doc: OpenPencilDoc): Promise<SuccessResult>;
  writeOpenPencilFile(id: string): Promise<OpenPencilFileResult>;
  toggleOpenPencilWatch(id: string, on: boolean): Promise<OpenPencilWatchResult>;
  split(req: SplitRequest): Promise<SplitResult>;
  getConfig(): Promise<ServerConfig>;
  saveConfig(cfg: ServerConfig): Promise<SuccessResult>;
  proxyUrl(url: string): string;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function liveClient(base: string, healthSignal?: AbortSignal): BasteClient {
  const root = base.replace(/\/+$/, '');
  let csrfToken: string | undefined;
  const idPath = (resource: string, id: string) => `/${resource}/${encodeURIComponent(id)}`;

  async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(csrfToken && !['GET', 'HEAD'].includes(method) ? { 'X-Baste-CSRF': csrfToken } : {}),
      },
      ...(body === undefined ? {} : {
        body: JSON.stringify(body),
      }),
      signal,
    });
    const raw = await response.text();
    let data: unknown;
    try { data = raw ? JSON.parse(raw) : undefined; }
    catch {
      if (response.ok) throw new Error('Baste server returned invalid JSON');
    }
    if (!response.ok) {
      const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : raw || `Baste request failed (${response.status})`;
      throw new ApiError(message, response.status);
    }
    return data as T;
  }

  const client: BasteClient = {
    mode: 'live',
    setCsrfToken: (token) => { csrfToken = token; },
    health: () => request('/health', 'GET', undefined, healthSignal),
    listPersonas: () => request('/personas'),
    getPersona: (id) => request(idPath('personas', id)),
    createPersona: (p) => request('/personas', 'POST', p),
    updatePersona: (id, p) => request(idPath('personas', id), 'PUT', p),
    deletePersona: (id) => request(idPath('personas', id), 'DELETE'),
    exportTokens: (id, format) => request(idPath('tokens', id), 'POST', { format }),
    designTokens: async (id) => JSON.parse((await client.exportTokens(id, 'json')).content) as DesignTokens,
    previewPrompts: (id) => request(idPath('prompts', id), 'POST'),
    generate: (id, req) => request(idPath('generate', id), 'POST', req),
    planGeneration: (id, req) => request(`${idPath('generate', id)}/plan`, 'POST', req),
    listJobs: () => request('/jobs'),
    getJob: (id) => request(idPath('jobs', id)),
    getBrandKit: async (id) => {
      try { return await request<BrandKit>(idPath('brandkit', id)); }
      catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    getMoodboard: (id) => request(idPath('moodboard', id)),
    putMoodboard: (id, board) => request(idPath('moodboard', id), 'PUT', board),
    addReference: (id, ref) => request(`${idPath('moodboard', id)}/reference`, 'POST', ref),
    decompose: (req) => request('/decompose', 'POST', req),
    remix: (req) => request('/remix', 'POST', req),
    rank: (req) => request('/rank', 'POST', req),
    getRanks: (id) => request(idPath('rank', id)),
    getFeedback: (id) => request(idPath('feedback', id)),
    getOpenPencil: (id) => request(idPath('openpencil', id)),
    saveOpenPencil: (id, doc) => request(idPath('openpencil', id), 'POST', { document: doc }),
    writeOpenPencilFile: (id) => request(`${idPath('openpencil', id)}/file`, 'POST'),
    toggleOpenPencilWatch: (id, on) => request(`${idPath('openpencil', id)}/watch`, 'POST', { enabled: on }),
    split: (req) => request('/split', 'POST', req),
    getConfig: () => request('/config'),
    saveConfig: (cfg) => request('/config', 'POST', cfg),
    proxyUrl: (url) => `${root}/proxy?url=${encodeURIComponent(url)}`,
  };
  return client;
}

export function createClient(base: string): BasteClient {
  return liveClient(base);
}

/** Probe once, abort after 1.5 seconds, and keep all fallback state in this client. */
export async function connect(base: string): Promise<BasteClient> {
  const controller = new AbortController();
  const client = liveClient(base, controller.signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Baste health check timed out'));
      }, 1500);
    });
    const health = await Promise.race([client.health(), timeout]);
    if (health.status !== 'ok') throw new Error('Baste health check failed');
    return client;
  } catch {
    return createDemoClient();
  } finally {
    clearTimeout(timer);
  }
}
