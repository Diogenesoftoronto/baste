/**
 * Baste Core Orchestrator
 * 
 * Main engine that coordinates:
 * 1. Persona loading
 * 2. Prompt generation
 * 3. Quality-Diversity evolution
 * 4. Asset generation (SVG, Image, Video)
 * 5. LLM-as-a-judge evaluation
 * 6. Archive management and output
 */

import type { Persona } from "./persona/types.js";
import type { AssetType, GeneratedPrompt } from "./generation/prompts.js";
import { generatePrompts, mutatePrompt } from "./generation/prompts.js";
import {
  runQD,
  defaultAssetFeatures,
  getDiverseSamples,
  type QDConfig,
  type QDSolution,
  type QDArchive,
} from "./generation/qd.js";
import {
  evaluateBatch,
  createScorer,
  type EvaluationResult,
} from "./evaluation/judge.js";
import {
  AssetGenerator,
  type GenerationConfig,
  type GeneratedAsset,
} from "./assets/generators.js";

export interface BasteConfig {
  // Generation services config
  generation: GenerationConfig;

  // QD parameters
  qd: QDConfig;

  // Number of final assets to produce per type
  outputCount: number;

  // LLM evaluator config
  evaluator: {
    model: string;
    apiKey?: string;
  };
}

export interface AssetSuite {
  persona: Persona;
  assets: {
    svgs: GeneratedAsset[];
    images: GeneratedAsset[];
    videos: GeneratedAsset[];
  };
  archive: QDArchive<string>; // genome = prompt string
  evaluations: EvaluationResult[];
  metadata: {
    generationDuration: number;
    totalIterations: number;
    coverage: number;
  };
}

/**
 * Generate a complete asset suite for a persona
 */
export async function generateAssetSuite(
  persona: Persona,
  assetTypes: AssetType[],
  config: BasteConfig
): Promise<AssetSuite> {
  const startTime = Date.now();
  const generator = new AssetGenerator(config.generation);

  console.log(`\n🎨 Baste: Generating assets for "${persona.name}"`);
  console.log(`   Persona: ${persona.summary}`);
  console.log(`   Asset types: ${assetTypes.map((a) => a.kind).join(", ")}`);

  // Generate prompts for each asset type
  const promptsByAsset = new Map<AssetType, Record<string, GeneratedPrompt>>();
  for (const asset of assetTypes) {
    promptsByAsset.set(asset, generatePrompts(persona, asset));
  }

  // Run QD evolution for image assets (most impactful for UI)
  const imageAssets = assetTypes.filter((a) => a.kind === "image");
  let archive: QDArchive<string> = createArchive(config.qd);

  if (imageAssets.length > 0) {
    console.log("\n🧬 Starting QD evolution for images...");

    const imageAsset = imageAssets[0];
    const prompts = promptsByAsset.get(imageAsset)!;

    archive = await runQD<string>(
      config.qd,
      // Seed generation
      async () => ({
        genome: prompts.image.prompt,
        quality: 0,
        features: [0, 0, 0],
        generation: 0,
      }),
      // Mutation
      async (parent, rate) => ({
        genome: mutatePrompt(parent.genome, persona, rate),
        quality: 0,
        features: [0, 0, 0],
        generation: 0,
      }),
      // Evaluation
      async (genome) => {
        // Generate the asset
        const asset = await generator.generate(persona, imageAsset, {
          ...prompts.image,
          prompt: genome,
        });

        // Evaluate with LLM judge
        const evalResults = await evaluateBatch(
          persona,
          [
            {
              type: "image",
              prompt: genome,
              content: asset.content,
            },
          ],
          // Evaluation function using OpenAI
          async (system, user) => {
            const apiKey = config.evaluator.apiKey || process.env.OPENAI_API_KEY;
            if (!apiKey) {
              // Fallback: random evaluation for demo
              return JSON.stringify({
                overall: 0.6 + Math.random() * 0.3,
                criteria: {
                  personaAlignment: 0.6 + Math.random() * 0.3,
                  visualQuality: 0.6 + Math.random() * 0.3,
                  uniqueness: 0.6 + Math.random() * 0.3,
                  coherence: 0.6 + Math.random() * 0.3,
                  usability: 0.6 + Math.random() * 0.3,
                },
                features: [
                  Math.random() * 2 - 1, // color temp
                  Math.random(), // density
                  Math.random(), // abstractness
                ],
                feedback: "Generated evaluation (no API key provided)",
                improvements: ["Add API key for real evaluation"],
                tags: ["demo", "placeholder"],
              });
            }

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: config.evaluator.model,
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: user },
                ],
                temperature: 0.3,
              }),
            });

            const data = await response.json();
            return data.choices[0]?.message?.content || "";
          }
        );

        const result = evalResults[0];
        const scorer = createScorer();
        const quality = scorer(result);

        return {
          quality,
          features: result.features,
        };
      }
    );
  }

  // Generate final diverse assets from archive
  console.log("\n🎯 Generating final assets...");
  const diversePrompts = getDiverseSamples(archive, config.outputCount);

  const finalAssets: GeneratedAsset[] = [];
  const evaluations: EvaluationResult[] = [];

  for (const solution of diversePrompts) {
    for (const assetType of assetTypes) {
      try {
        const asset = await generator.generate(persona, assetType, {
          prompt: solution.genome,
          systemContext: `Generate ${assetType.kind} for ${persona.name}`,
          parameters: {},
        });
        finalAssets.push(asset);
      } catch (error) {
        console.error(`Failed to generate ${assetType.kind}:`, error);
      }
    }
  }

  // Categorize by type
  const svgs = finalAssets.filter((a) => a.type === "svg");
  const images = finalAssets.filter((a) => a.type === "image");
  const videos = finalAssets.filter((a) => a.type === "video");

  const duration = Date.now() - startTime;

  console.log(`\n✅ Asset suite complete for "${persona.name}"`);
  console.log(`   Generated: ${svgs.length} SVGs, ${images.length} images, ${videos.length} videos`);
  console.log(`   Time: ${(duration / 1000).toFixed(1)}s`);

  return {
    persona,
    assets: { svgs, images, videos },
    archive,
    evaluations,
    metadata: {
      generationDuration: duration,
      totalIterations: config.qd.iterations,
      coverage: archive.coverage,
    },
  };
}

function createArchive(config: QDConfig) {
  const cells = new Map<string, QDSolution<string>>();
  return {
    cells,
    descriptors: config.features,
    coverage: 0,
    maxQuality: 0,
    averageQuality: 0,
  };
}

/**
 * Generate UI kit from persona
 * Creates a coordinated set of components
 */
export async function generateUIKit(
  persona: Persona,
  config: BasteConfig
): Promise<AssetSuite> {
  const uiComponents: AssetType[] = [
    {
      kind: "svg",
      purpose: "icon",
      description: `App icon inspired by ${persona.aesthetic.visualKeywords[0]}`,
    },
    {
      kind: "svg",
      purpose: "illustration",
      description: `Hero illustration reflecting ${persona.culture.values[0]}`,
    },
    {
      kind: "image",
      purpose: "background",
      description: `Ambient background texture evoking ${persona.influences.spaces[0] || "dreamlike atmosphere"}`,
      constraints: { aspectRatio: "16:9" },
    },
    {
      kind: "image",
      purpose: "hero",
      description: `Hero banner image in the style of ${persona.influences.films[0] || "concept art"}`,
      constraints: { aspectRatio: "21:9" },
    },
    {
      kind: "video",
      purpose: "animation",
      description: `Ambient motion background loop inspired by ${persona.influences.music.genres[0] || "ambient music"}`,
      constraints: { aspectRatio: "16:9" },
    },
  ];

  return generateAssetSuite(persona, uiComponents, config);
}
