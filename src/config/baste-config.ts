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
    provider: "quiver" | "openai" | "local";
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };

  /** Image generator settings */
  image?: {
    provider: "openai" | "gemini" | "stability" | "local";
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    size?: string;
    quality?: "standard" | "high";
    style?: "vivid" | "natural";
  };

  /** Video generator settings */
  video?: {
    provider: "veo" | "runway" | "local";
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    duration?: number;
    quality?: string;
  };
}

export interface EvaluatorConfig {
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
    image: { provider: "openai" as const, model: "gpt-image-2", size: "1024x1024", quality: "high" as const, style: "vivid" as const },
    video: { provider: "veo", model: "veo-3", duration: 5, quality: "1080p" },
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

/**
 * Resolve API keys from environment variables.
 */
function resolveEnvKeys(config: BasteUserConfig): BasteUserConfig {
  const resolved: BasteUserConfig = { ...config };

  if (!resolved.generators) resolved.generators = {};

  if (!resolved.generators.svg?.apiKey && process.env.QUIVER_API_KEY) {
    resolved.generators.svg = { ...(resolved.generators.svg || {}), apiKey: process.env.QUIVER_API_KEY } as GeneratorConfig["svg"];
  }
  // OpenAI key for OpenAI image provider
  if (!resolved.generators.image?.apiKey && resolved.generators.image?.provider !== "gemini" && process.env.OPENAI_API_KEY) {
    resolved.generators.image = { ...(resolved.generators.image || {}), apiKey: process.env.OPENAI_API_KEY } as GeneratorConfig["image"];
  }
  // Google key for Gemini image provider
  if (!resolved.generators.image?.apiKey && resolved.generators.image?.provider === "gemini" && process.env.GOOGLE_API_KEY) {
    resolved.generators.image = { ...(resolved.generators.image || {}), apiKey: process.env.GOOGLE_API_KEY } as GeneratorConfig["image"];
  }
  if (!resolved.generators.video?.apiKey && process.env.GOOGLE_API_KEY) {
    resolved.generators.video = { ...(resolved.generators.video || {}), apiKey: process.env.GOOGLE_API_KEY } as GeneratorConfig["video"];
  }
  if (!resolved.evaluator?.apiKey && process.env.OPENAI_API_KEY) {
    resolved.evaluator = { ...(resolved.evaluator || {}), apiKey: process.env.OPENAI_API_KEY } as EvaluatorConfig;
  }

  return resolved;
}

export interface GenerationOverrides {
  imageProvider?: string;
  imageModel?: string;
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
  evaluator: { model: string; apiKey?: string; baseUrl?: string; temperature?: number; weights?: Record<string, number> };
} {
  const envResolved = resolveEnvKeys(userConfig);
  const qdCfg = { ...defaultConfig.qd, ...(envResolved.qd || {}) };
  const evalCfg = { ...defaultConfig.evaluator, ...(envResolved.evaluator || {}) };
  const imgCfg = envResolved.generators?.image ?? defaultConfig.generators.image;
  const svgCfg = envResolved.generators?.svg ?? defaultConfig.generators.svg;
  const vidCfg = envResolved.generators?.video ?? defaultConfig.generators.video;

  const imageProvider = (overrides?.imageProvider ?? imgCfg?.provider ?? "openai") as "openai" | "gemini";
  const imageModel = overrides?.imageModel ?? imgCfg?.model;

  // Resolve the right API key for the chosen image provider
  const imageApiKey = imgCfg?.apiKey ??
    (imageProvider === "gemini"
      ? (vidCfg?.apiKey ?? process.env.GOOGLE_API_KEY)
      : process.env.OPENAI_API_KEY);

  return {
    generation: {
      outputDir: envResolved.outputDir ?? defaultConfig.outputDir,
      imageProvider,
      imageModel,
      imageSize: imgCfg?.size,
      imageQuality: imgCfg?.quality,
      imageStyle: imgCfg?.style,
      openaiApiKey: imageProvider === "openai" ? imageApiKey : undefined,
      googleApiKey: imageProvider === "gemini" ? imageApiKey : (vidCfg?.apiKey ?? process.env.GOOGLE_API_KEY),
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
    outputCount: envResolved.outputCount ?? defaultConfig.outputCount,
    evaluator: {
      model: evalCfg.model!,
      apiKey: evalCfg.apiKey,
      baseUrl: evalCfg.baseUrl,
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
