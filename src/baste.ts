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
import { resolveEvaluatorProvider, type EvaluatorConfig } from "./config/baste-config.js";
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
  evaluator: EvaluatorConfig;
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
  const evaluations: EvaluationResult[] = [];
  const evaluatorProvider = resolveEvaluatorProvider(config.evaluator);
  // Surface missing video credentials to the GUI before generating paid assets.
  if (assetTypes.some(a => a.kind === "video") && (config.generation.videoProvider ?? "seedance") === "seedance"
      && !config.generation.videoApiKey && !process.env.ARK_API_KEY) {
    throw new Error("Seedance needs ARK_API_KEY");
  }

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
              purpose: imageAsset.purpose,
              metadata: asset.metadata,
              suite: assetTypes.map(a => ({ type: a.kind, purpose: a.purpose, prompt: promptsByAsset.get(a)![a.kind].prompt })),
            },
          ],
          // Evaluation function using OpenAI
          async (system, user) => {
            const apiKey = config.evaluator.apiKey || process.env.OPENAI_API_KEY;
            if (!apiKey) {
              console.warn("[baste] No OPENAI_API_KEY set — using rule-based heuristic evaluation (set OPENAI_API_KEY or evaluator.apiKey for LLM judge)");
              // Local heuristic: score based on prompt richness and persona keyword overlap.
              // Ensures the archive is still useful even without an LLM API key.
              const keywords = [...persona.aesthetic.visualKeywords, ...persona.aesthetic.moodKeywords];
              const promptWords = genome.toLowerCase().split(/[^a-z]+/);
              const overlap = keywords.filter(k => promptWords.includes(k.toLowerCase())).length;
              const normOverlap = keywords.length ? Math.min(1, overlap / Math.max(1, keywords.length * 0.3)) : 0.5;
              const richness = Math.min(1, promptWords.filter(w => w.length > 3).length / 20);
              const baseScore = 0.4 + (normOverlap * 0.35) + (richness * 0.15);
              const paScore = Math.min(1, baseScore + 0.05 * Math.random());
              const vqScore = Math.min(1, 0.5 + richness * 0.4 + 0.05 * Math.random());
              const unScore = Math.min(1, 0.45 + normOverlap * 0.45 + 0.05 * Math.random());
              const coScore = Math.min(1, 0.5 + 0.3 * richness + 0.05 * Math.random());
              const usScore = Math.min(1, 0.55 + 0.3 * normOverlap + 0.05 * Math.random());
              const overall = paScore * 0.3 + vqScore * 0.2 + unScore * 0.2 + coScore * 0.15 + usScore * 0.15;
              return JSON.stringify({
                overall,
                criteria: {
                  personaAlignment: +paScore.toFixed(3),
                  visualQuality: +vqScore.toFixed(3),
                  uniqueness: +unScore.toFixed(3),
                  coherence: +coScore.toFixed(3),
                  usability: +usScore.toFixed(3),
                },
                features: [
                  +(Math.random() * 2 - 1).toFixed(3),
                  +richness.toFixed(3),
                  +normOverlap.toFixed(3),
                ],
                feedback: `Local heuristic evaluation: prompt-keyword overlap=${(normOverlap * 100).toFixed(0)}%, prompt richness=${(richness * 100).toFixed(0)}%. ` +
                  (normOverlap > 0.5 ? "Strong persona alignment" : normOverlap > 0.2 ? "Moderate persona alignment, consider more persona keywords" : "Weak persona alignment, refine prompt"),
                improvements: [
                  "Add API key for LLM judge (OPENAI_API_KEY)",
                  normOverlap < 0.5 ? `Inject more ${persona.aesthetic.visualKeywords.slice(0,3).join(", ")} keywords` : "Explore contrasting moods for diversity",
                  richness < 0.5 ? "Expand prompt with detail: lighting, materials, composition" : "Experiment with shorter, punchier prompts",
                ],
                tags: ["heuristic", normOverlap > 0.5 ? "aligned" : "needs-work", richness > 0.5 ? "rich" : "sparse", "local-eval"],
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
          },
          config.evaluator
        );

        const result = evalResults[0];
        evaluations.push(result);
        const scorer = createScorer(config.evaluator.weights);
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
  const diversePrompts = imageAssets.length > 0 ? getDiverseSamples(archive, config.outputCount)
    : [{ genome: "", quality: 0, features: [0, 0, 0], generation: 0 }];

  const finalAssets: GeneratedAsset[] = [];

  for (const solution of diversePrompts) {
    for (const assetType of assetTypes) {
      try {
        const originalPrompt = promptsByAsset.get(assetType)![assetType.kind];
        const asset = await generator.generate(persona, assetType, {
          ...originalPrompt,
          prompt: assetType.kind === "image" ? solution.genome : originalPrompt.prompt,
        });
        if (evaluatorProvider === "typesafe" || evaluatorProvider === "notorganic") {
          const [evaluation] = await evaluateBatch(persona, [{
            type: asset.type, prompt: asset.prompt, content: asset.content,
            purpose: assetType.purpose, metadata: asset.metadata,
            suite: finalAssets.map(a => ({ type: a.type, purpose: a.metadata.assetPurpose, prompt: a.prompt, metadata: a.metadata })),
          }], async () => { throw new Error("Unexpected OpenAI evaluator selection"); }, config.evaluator);
          evaluations.push(evaluation);
          if (evaluation.gate?.accepted === false) continue;
        }
        finalAssets.push(asset);
      } catch (error) {
        console.error(`Failed to generate ${assetType.kind}:`, error);
        if (assetType.kind === "video" || evaluatorProvider === "typesafe" || evaluatorProvider === "notorganic" || config.generation.imageProvider === "notorganic") throw error;
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
