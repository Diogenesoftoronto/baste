/**
 * Baste Configuration System
 *
 * Flexible, unopinionated config that lets users customize every aspect:
 * - Generators (SVG, Image, Video providers)
 * - Evaluators (LLM-as-judge settings)
 * - QD parameters (feature space, iterations, thresholds)
 *
 * Supports loading from JSON config files, env vars, and programmatic overrides.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { QDConfig, FeatureDescriptor } from "../generation/qd.js";
import type { GenerationConfig } from "../assets/generators.js";

export interface GeneratorConfig {
  /** SVG generator settings */
  svg?: {
    provider: "quiver" | "fal" | "openai" | "local";
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };

  /** Image generator settings */
  image?: {
    provider: "openai" | "gemini" | "notorganic" | "fal" | "stability" | "local";
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    size?: string;
    quality?: "standard" | "high";
    style?: "vivid" | "natural";
  };

  /** Video generator settings */
  video?: {
    provider: "seedance" | "veo" | "fal" | "runway" | "local";
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    duration?: number;
    ratio?: string;
    quality?: string;
  };
}

export interface EvaluatorConfig {
  /**
   * Omitted: TypeSafe when TYPESAFE_API_KEY is set, otherwise OpenAI.
   * "fal" judges the generated pixels with a vision model through fal (FAL_KEY).
   */
  provider?: "typesafe" | "openai" | "notorganic" | "fal";
  /** Server-only, request-scoped authorization; not part of saved configuration. */
  notOrganicFetch?: GenerationConfig["notOrganicFetch"];
  /** LLM model for judging assets */
  model: string;
  /** API key (falls back to env vars) */
  apiKey?: string;
  /** Custom base URL for the model API */
  baseUrl?: string;
  /** Temperature for evaluation responses */
  temperature?: number;
  /** Custom system prompt override */
  systemPrompt?: string;
  /** Weights for scoring criteria */
  weights?: {
    personaAlignment?: number;
    visualQuality?: number;
    uniqueness?: number;
    coherence?: number;
    usability?: number;
  };
}

export interface BasteUserConfig {
  /** Output directory for generated assets */
  outputDir?: string;

  /** Custom persona directory */
  personaDir?: string;

  /** Generator provider configs */
  generators?: GeneratorConfig;

  /** Evaluator (judge) config */
  evaluator?: EvaluatorConfig;

  /** QD (Quality Diversity) parameters */
  qd?: {
    /** Feature dimensions to explore */
    features?: FeatureDescriptor[];
    /** Number of evolution iterations */
    iterations?: number;
    /** Children per iteration */
    batchSize?: number;
    /** Mutation rate (0-1) */
    mutationRate?: number;
    /** Minimum quality to enter archive */
    qualityThreshold?: number;
  };

  /** Number of final assets to output per type */
  outputCount?: number;

  /** Asset type preferences */
  assetTypes?: Array<{
    kind: "svg" | "image" | "video";
    purpose: string;
    description: string;
    constraints?: {
      style?: string;
      aspectRatio?: string;
      size?: string;
      colors?: string[];
    };
  }>;
}

/**
 * Default QD feature descriptors.
 */
export const defaultQDFeatures: FeatureDescriptor[] = [
  { name: "color_temperature", min: -1, max: 1, bins: 5 },
  { name: "visual_density", min: 0, max: 1, bins: 5 },
  { name: "abstractness", min: 0, max: 1, bins: 3 },
];

/**
 * Default evaluator weights.
 */
export const defaultEvaluatorWeights = {
  personaAlignment: 0.3,
  visualQuality: 0.2,
  uniqueness: 0.2,
  coherence: 0.15,
  usability: 0.15,
};

/**
 * Default full configuration.
 */
export const defaultConfig: Required<BasteUserConfig> = {
  outputDir: "./assets/output",
  personaDir: "./personas",
  generators: {
    svg: { provider: "quiver" },
    image: { provider: "openai" as const, model: "gpt-image-2.5", size: "1024x1024", quality: "high" as const, style: "vivid" as const },
    video: { provider: "seedance", model: "seedance-1-0-pro-250528", duration: 5, ratio: "16:9", quality: "1080p" },
  },
  evaluator: {
    model: "gpt-4o",
    temperature: 0.3,
    weights: { ...defaultEvaluatorWeights },
  },
  qd: {
    features: [...defaultQDFeatures],
    iterations: 5,
    batchSize: 3,
    mutationRate: 0.4,
    qualityThreshold: 0.5,
  },
  outputCount: 3,
  assetTypes: [
    { kind: "svg", purpose: "icon", description: "App icon" },
    { kind: "image", purpose: "hero", description: "Hero banner", constraints: { aspectRatio: "21:9" } },
    { kind: "image", purpose: "background", description: "Ambient background", constraints: { aspectRatio: "16:9" } },
  ],
};

export function resolveEvaluatorProvider(config: Pick<EvaluatorConfig, "provider"> = {}): "typesafe" | "openai" | "notorganic" | "fal" {
  return config.provider ?? (process.env.TYPESAFE_API_KEY ? "typesafe" : "openai");
}

export interface GenerationOverrides {
  imageProvider?: string;
  imageModel?: string;
  videoProvider?: string;
  videoModel?: string;
  svgProvider?: string;
  evaluatorProvider?: EvaluatorConfig["provider"];
}

/**
 * Build a complete BasteConfig (for the orchestrator) from a user config.
 * Optional overrides allow per-request provider/model selection from the GUI.
 */
export function toBasteConfig(
  userConfig: BasteUserConfig,
  overrides?: GenerationOverrides
): {
  generation: GenerationConfig;
  qd: QDConfig;
  outputCount: number;
  evaluator: EvaluatorConfig;
} {
  const qdCfg = { ...defaultConfig.qd, ...(userConfig.qd || {}) };
  const evalCfg = { ...defaultConfig.evaluator, ...(userConfig.evaluator || {}) };
  const imgCfg = userConfig.generators?.image ?? defaultConfig.generators.image;
  const svgCfg = userConfig.generators?.svg ?? defaultConfig.generators.svg;
  const vidCfg = userConfig.generators?.video ?? defaultConfig.generators.video;

  const imageProvider = (overrides?.imageProvider ?? imgCfg?.provider ?? "openai") as "openai" | "gemini" | "notorganic" | "fal";
  if (!["openai", "gemini", "notorganic", "fal"].includes(imageProvider)) throw new Error(`Unsupported image provider: ${imageProvider}`);
  // Saved configs may name SVG providers that were never implemented; those keep using QuiverAI.
  if (overrides?.svgProvider && !["quiver", "fal"].includes(overrides.svgProvider)) throw new Error(`Unsupported SVG provider: ${overrides.svgProvider}`);
  const svgProvider: "quiver" | "fal" = (overrides?.svgProvider ?? svgCfg?.provider) === "fal" ? "fal" : "quiver";
  const imageModel = overrides?.imageModel ?? (imageProvider === imgCfg?.provider ? imgCfg.model : undefined);
  const videoProvider = overrides?.videoProvider ?? vidCfg?.provider ?? "seedance";
  if (!["seedance", "veo", "fal", "runway", "local"].includes(videoProvider)) {
    throw new Error(`Unsupported video provider: ${videoProvider}`);
  }
  const videoModel = overrides?.videoModel ?? (videoProvider === vidCfg?.provider ? vidCfg.model : undefined);
  const videoApiKey = (videoProvider === vidCfg?.provider ? vidCfg.apiKey : undefined) ??
    (videoProvider === "seedance" ? process.env.ARK_API_KEY : videoProvider === "veo" ? process.env.GOOGLE_API_KEY : videoProvider === "fal" ? process.env.FAL_KEY : undefined);
  const evaluatorProvider = overrides?.evaluatorProvider ?? resolveEvaluatorProvider(userConfig.evaluator);
  // A saved model or key belongs to the saved provider; never hand it to a different one.
  const savedEvaluator = !overrides?.evaluatorProvider || overrides.evaluatorProvider === userConfig.evaluator?.provider;

  // Resolve the right API key for the chosen image provider
  const imageApiKey = (imageProvider === imgCfg?.provider ? imgCfg.apiKey : undefined) ??
    (imageProvider === "gemini"
      ? process.env.GOOGLE_API_KEY
      : imageProvider === "fal" ? process.env.FAL_KEY : process.env.OPENAI_API_KEY);
  // fal-backed providers share one key; the first configured one wins.
  const falApiKey = [
    imageProvider === "fal" && imgCfg?.provider === "fal" ? imgCfg.apiKey : undefined,
    svgProvider === "fal" && svgCfg?.provider === "fal" ? svgCfg.apiKey : undefined,
    videoProvider === "fal" && vidCfg?.provider === "fal" ? vidCfg.apiKey : undefined,
  ].find(Boolean) ?? process.env.FAL_KEY;

  return {
    generation: {
      outputDir: userConfig.outputDir ?? defaultConfig.outputDir,
      imageProvider,
      imageModel,
      imageSize: imgCfg?.size,
      imageQuality: imgCfg?.quality,
      imageStyle: imgCfg?.style,
      openaiApiKey: imageProvider === "openai" ? imageApiKey : undefined,
      googleApiKey: imageProvider === "gemini" ? imageApiKey : process.env.GOOGLE_API_KEY,
      falApiKey,
      svgProvider,
      svgModel: svgProvider === svgCfg?.provider ? svgCfg?.model : undefined,
      videoProvider: videoProvider as GenerationConfig["videoProvider"],
      videoModel,
      videoApiKey,
      videoBaseUrl: videoProvider === vidCfg?.provider ? vidCfg.baseUrl : undefined,
      videoDuration: vidCfg?.duration,
      videoRatio: vidCfg?.ratio,
      videoResolution: vidCfg?.quality,
      quiverApiKey: svgCfg?.apiKey ?? process.env.QUIVER_API_KEY,
      quiverBaseUrl: svgCfg?.baseUrl,
    },
    qd: {
      features: qdCfg.features!,
      iterations: qdCfg.iterations!,
      batchSize: qdCfg.batchSize!,
      mutationRate: qdCfg.mutationRate!,
      qualityThreshold: qdCfg.qualityThreshold!,
    },
    outputCount: userConfig.outputCount ?? defaultConfig.outputCount,
    evaluator: {
      provider: evaluatorProvider,
      model: (savedEvaluator ? userConfig.evaluator?.model : undefined)
        ?? { notorganic: "judgement", typesafe: "jev-latest", fal: "google/gemini-2.5-flash" }[evaluatorProvider as string]
        ?? defaultConfig.evaluator.model,
      apiKey: (savedEvaluator ? evalCfg.apiKey : undefined)
        ?? (evaluatorProvider === "typesafe" ? process.env.TYPESAFE_API_KEY : evaluatorProvider === "fal" ? falApiKey : process.env.OPENAI_API_KEY),
      baseUrl: savedEvaluator ? evalCfg.baseUrl : undefined,
      temperature: evalCfg.temperature,
      weights: evalCfg.weights,
    },
  };
}

/**
 * Load config from a JSON file.
 */
export function loadConfigFile(path: string): BasteUserConfig {
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(resolved, "utf-8"));
  } catch {
    console.warn(`Failed to parse config file: ${resolved}`);
    return {};
  }
}

/**
 * Load config with standard resolution order:
 * 1. Explicit file (if provided)
 * 2. baste.config.json in cwd
 * 3. .bastec.json in cwd
 * 4. Default config
 */
export function resolveConfig(explicitPath?: string): BasteUserConfig {
  if (explicitPath) {
    return loadConfigFile(explicitPath);
  }
  const fromJson = loadConfigFile("./baste.config.json");
  if (Object.keys(fromJson).length > 0) return fromJson;
  const fromDot = loadConfigFile("./.bastec.json");
  if (Object.keys(fromDot).length > 0) return fromDot;
  return {};
}

/**
 * Save config to a JSON file.
 */
export function saveConfigFile(config: BasteUserConfig, path: string): void {
  const resolved = resolve(path);
  writeFileSync(resolved, JSON.stringify(config, null, 2));
}
