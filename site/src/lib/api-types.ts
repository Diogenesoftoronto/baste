/** JSON contracts for src/gui/api.ts. Kept local so the site is standalone. */
export interface Persona {
  id: string;
  name: string;
  summary: string;
  culture: CulturalIdentity;
  influences: Influences;
  behaviors: Behaviors;
  aesthetic: AestheticProfile;
}

export type PersonaRecord = Persona & { _source?: 'base' | 'custom' };

export interface CulturalIdentity {
  region?: string;
  subcultures: string[];
  values: string[];
  language?: { primary: string; vernacular: string[] };
}

export interface Influences {
  films: string[];
  shows: string[];
  anime: string[];
  music: { genres: string[]; artists: string[] };
  games: string[];
  visualArtists: string[];
  fashion: string[];
  spaces: string[];
  tools: string[];
  obsessions: string[];
}

export interface Behaviors {
  discovery: string[];
  interfaceValues: string[];
  platforms: string[];
  expression: string[];
  petPeeves: string[];
}

export interface AestheticProfile {
  colorTemperature: 'warm' | 'cool' | 'neutral' | 'high-contrast' | 'muted';
  density: 'minimal' | 'dense' | 'rich' | 'maximalist';
  edgeStyle: 'sharp' | 'soft' | 'organic' | 'geometric' | 'brutalist';
  motionStyle: 'smooth' | 'snappy' | 'liquid' | 'mechanical';
  typographyStyle: 'clean' | 'expressive' | 'retro' | 'futuristic' | 'handcrafted';
  textureStyle: 'flat' | 'textured' | 'noisy' | 'clean' | 'grainy';
  iconStyle: 'line' | 'filled' | 'hand-drawn' | 'geometric' | 'abstract';
  layoutStyle: 'grid' | 'organic' | 'asymmetric' | 'brutalist' | 'editorial';
  visualKeywords: string[];
  moodKeywords: string[];
}

export interface DesignTokens {
  colors: ColorPalette;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borders: BorderTokens;
  shadows: ShadowTokens;
  motion: MotionTokens;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  warm: string;
  cool: string;
  density: AestheticProfile['density'];
}

export interface TypographyTokens {
  fontFamily: { heading: string; body: string; mono: string };
  fontSize: {
    xs: string; sm: string; base: string; lg: string; xl: string;
    '2xl': string; '3xl': string; '4xl': string;
  };
  fontWeight: { normal: number; medium: number; semibold: number; bold: number };
  lineHeight: { tight: number; normal: number; relaxed: number };
}

export interface SpacingTokens {
  scale: Record<string, string>;
  density: AestheticProfile['density'];
}

export interface BorderTokens {
  radius: { none: string; sm: string; base: string; lg: string; xl: string; full: string };
  width: { thin: string; base: string; thick: string };
  style: string;
}

export interface ShadowTokens {
  sm: string; base: string; lg: string; xl: string; glow: string;
}

export interface MotionTokens {
  duration: { fast: string; base: string; slow: string; slower: string };
  easing: { default: string; smooth: string; snappy: string; bounce: string };
}

export interface BrandKit {
  sourceUrl: string;
  fetchedAt: string;
  title: string;
  description: string;
  palette: string[];
  paletteRoles: PaletteRoles;
  fonts: string[];
  fontFaces: FontFaceRef[];
  logo?: string;
  logoSvg?: string;
  ogImage?: string;
  background?: string;
  images: { url: string; alt?: string }[];
  rawText: string;
  signals: ExtractedSignals;
  localAssets?: LocalAssetMap;
}

export interface PaletteRoles {
  background?: string; surface?: string; text?: string; textMuted?: string;
  border?: string; primary?: string; secondary?: string; accent?: string;
}

export interface FontFaceRef {
  family: string; src?: string; weight?: string; style?: string;
}

export interface ExtractedSignals {
  borderRadiusMax: number;
  borderRadiusAvg: number;
  transitionTimings: string[];
  hasGrid: boolean;
  hasMonoFont: boolean;
  bodyFontCategory: 'sans' | 'serif' | 'mono' | 'display' | 'unknown';
  imageCount: number;
  ratingPalette: number;
}

export interface LocalAssetMap {
  dir: string;
  logo?: string;
  ogImage?: string;
  paletteSwatch?: string;
  thumbnails: { source: string; local: string }[];
}

export interface MoodboardReference {
  id: string;
  src: string;
  tags: string[];
  pinned: boolean;
  addedAt: number;
}

export interface Moodboard {
  personaId: string;
  references: MoodboardReference[];
  notes: string;
  vibe: string[];
}

export interface AddReferenceRequest { src: string; tags?: string[] }

export interface JobSummary {
  id: string;
  personaId: string;
  type: 'suite' | 'ui-kit';
  status: 'running' | 'completed' | 'error';
}

export interface DryRunResult { dryRun: true; samplePrompt: string }
export interface GeneratedAssetSummary { id: string; purpose: string; path: string; url?: string }
export interface GenerationResult {
  svgs: GeneratedAssetSummary[];
  images: GeneratedAssetSummary[];
  videos: GeneratedAssetSummary[];
  metadata: { generationDuration: number; totalIterations: number; coverage: number };
}
export interface Job extends JobSummary {
  logs: string[];
  result?: DryRunResult | GenerationResult;
  error?: string;
}

/** GET /config returns the user config, which may be an empty object. */
export interface ServerConfig {
  outputDir?: string;
  personaDir?: string;
  generators?: GeneratorConfig;
  evaluator?: EvaluatorConfig;
  qd?: {
    features?: FeatureDescriptor[];
    iterations?: number;
    batchSize?: number;
    mutationRate?: number;
    qualityThreshold?: number;
  };
  outputCount?: number;
  assetTypes?: AssetType[];
}

export interface GeneratorConfig {
  svg?: {
    provider: 'quiver' | 'openai' | 'local';
    model?: string; apiKey?: string; baseUrl?: string;
  };
  image?: {
    provider: 'openai' | 'gemini' | 'stability' | 'local' | 'notorganic';
    model?: string; apiKey?: string; baseUrl?: string; size?: string;
    quality?: 'standard' | 'high'; style?: 'vivid' | 'natural';
  };
  video?: {
    provider: 'veo' | 'runway' | 'local';
    model?: string; apiKey?: string; baseUrl?: string;
    duration?: number; quality?: string;
  };
}

export interface EvaluatorConfig {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  systemPrompt?: string;
  weights?: {
    personaAlignment?: number; visualQuality?: number; uniqueness?: number;
    coherence?: number; usability?: number;
  };
}

export interface FeatureDescriptor { name: string; min: number; max: number; bins: number }

export interface OpenPencilDoc {
  version: string;
  type: 'baste_design';
  metadata: { personaId: string; personaName: string; exportedAt: number; basteVersion: string };
  tokens: OpenPencilToken[];
  pages: OpenPencilPage[];
  culturalContext: { references: CulturalReference[]; rationale: string };
  components: OpenPencilComponent[];
}

export interface OpenPencilToken {
  id: string;
  name: string;
  type: 'color' | 'font' | 'spacing' | 'radius' | 'shadow' | 'duration' | 'easing';
  value: string;
  description?: string;
  category: string;
}

export interface OpenPencilPage {
  id: string; name: string; width: number; height: number; frames: OpenPencilFrame[];
}
export interface OpenPencilFrame {
  id: string; name: string; type: 'frame' | 'group' | 'component';
  x: number; y: number; width: number; height: number;
  fill?: OpenPencilFill;
  children: OpenPencilNode[];
}
export interface OpenPencilNode {
  id: string; name: string; type: 'rectangle' | 'text' | 'image' | 'svg' | 'component' | 'group';
  x: number; y: number; width: number; height: number;
  fill?: OpenPencilFill;
  stroke?: OpenPencilStroke;
  text?: OpenPencilText;
  componentId?: string;
  clip?: boolean;
  /** The bridge emits nested visual-reference labels, despite omitting this in its interface. */
  children?: OpenPencilNode[];
}
export interface OpenPencilFill {
  type: 'solid' | 'gradient' | 'image' | 'pattern';
  color?: string;
  gradient?: { stops: { offset: number; color: string }[] };
  imageRef?: string;
}
export interface OpenPencilStroke { color: string; width: number; style: 'solid' | 'dashed' | 'dotted' }
export interface OpenPencilText {
  content: string; fontFamily: string; fontSize: number; fontWeight: number;
  color: string; lineHeight: number; alignment: 'left' | 'center' | 'right';
}
export interface OpenPencilComponent {
  id: string; name: string; description?: string; tokens: string[];
  frame: OpenPencilFrame;
  variants?: OpenPencilComponent[];
}
export interface CulturalReference {
  id: string;
  type: 'film' | 'show' | 'anime' | 'music_genre' | 'music_artist' | 'game' |
    'visual_artist' | 'fashion' | 'space' | 'tool' | 'obsession' | 'subculture' |
    'value' | 'image' | 'screenshot' | 'logo' | 'meme' | 'custom';
  value: string;
  description?: string;
  designRationale: string;
  source?: string;
  personaId: string;
  componentId?: string;
  createdAt: number;
}

export interface AssetRank {
  assetId: string; personaId: string;
  /** Server clamps to [-1, 1]; fractional scores are accepted. */
  score: number;
  feedback: string;
  ts: number;
}
export interface RankRequest {
  assetId: string; personaId: string; score: number;
  feedback?: string;
  ts?: number; // Accepted but replaced by the server's timestamp.
  assetType?: 'svg' | 'image' | 'video';
  prompt?: string;
  features?: number[];
  tags?: string[];
}
export interface FeedbackEntry {
  personaId: string; score: number; feedback: string; ts: number;
  assetId?: string;
  assetType?: 'svg' | 'image' | 'video';
  prompt?: string;
  features?: number[];
  tags?: string[];
}
export interface FeedbackSummary {
  total: number; positive: number; negative: number;
  topUpTags: { tag: string; count: number }[];
  topDownTags: { tag: string; count: number }[];
  recent: FeedbackEntry[];
  document: string;
}
export interface RankStats {
  personaId: string;
  total: number; positive: number; negative: number; score: number;
  trend: number[];
  recent: AssetRank[];
}

export interface GeneratedPrompt {
  prompt: string;
  negativePrompt?: string;
  parameters: Record<string, unknown>;
  systemContext: string;
}
export interface PromptPreview {
  personaId: string;
  image: GeneratedPrompt;
  svg: GeneratedPrompt;
  video: GeneratedPrompt;
}

export interface SplitRequest {
  src: string;
  cols?: number; rows?: number;
  strategy?: 'detect' | 'grid' | 'auto';
  saveTo?: string;
  minRegionPx?: number;
  threshold?: number;
}
export interface SplitCell {
  id: string; x: number; y: number; w: number; h: number;
  src: string;
  format?: string;
  label: string;
  localPath?: string;
}
export interface ImageDimensions { width: number; height: number; format: string }
/** With detected=null, grid cell coordinates are normalized rather than pixels. */
export type SplitResult = {
  src: string; strategy: 'auto'; detected: ImageDimensions;
  regions: number; cells: SplitCell[];
} | {
  src: string; strategy: 'grid'; cols: number; rows: number;
  detected: ImageDimensions | null; cells: SplitCell[];
};

export interface DecomposeRequest {
  url: string;
  id?: string; name?: string;
  seedMoodboard?: boolean; deep?: boolean; mirrorAssets?: boolean; initVersioning?: boolean;
}
export interface DecomposeResult { persona: Persona; brandKit: BrandKit }
export interface RemixRequest { a: string; b: string; id: string; name?: string }
export interface RemixResult { success: true; persona: Persona }
export interface AssetType {
  kind: 'svg' | 'image' | 'video';
  purpose: string;
  description: string;
  constraints?: { style?: string; aspectRatio?: string; size?: string; colors?: string[] };
}
export interface GenerateRequest {
  type?: 'suite' | 'ui-kit';
  assetTypes?: AssetType[];
  dryRun?: boolean;
  imageProvider?: string;
  imageModel?: string;
  maxCostMicrousd?: number;
  qd?: { iterations: number; batchSize: number };
  outputCount?: number;
}

export interface GenerationPlan {
  imageCalls: number;
  judgementCalls: number;
  minimumBudgetMicrousd: number;
  operatorMaxCostMicrousd: number;
  requestedMaxCostMicrousd: number;
  withinOperatorLimit: boolean;
  withinRequestedBudget: boolean;
  perImageMaxCostMicrousd: number;
  perJudgementMaxCostMicrousd: number;
}

export type TokenFormat = 'css' | 'tailwind' | 'json' | 'panda';
export interface TokenExport { format: TokenFormat; ext: string; content: string; personaId: string }
export interface SuccessResult { success: true }
export interface PersonaWriteResult extends SuccessResult { id: string }
export interface GenerateResponse { jobId: string; status: 'started' }
export interface RankResult extends SuccessResult { total: number }
export interface HealthResult { status: 'ok'; version: string }
export interface OpenPencilFileResult { path: string; watching: boolean }
export interface OpenPencilWatchResult { watching: boolean; path?: string }
