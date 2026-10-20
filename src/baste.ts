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
import { basename } from "node:path";
import {
  DEFAULT_ANIMATE_MODEL,
  DEFAULT_EDIT_MODEL,
  DEFAULT_SEGMENT_MODEL,
  resolveEvaluatorProvider,
  type AnimateMode,
  type EvaluatorConfig,
} from "./config/baste-config.js";
import type { AssetType, GeneratedPrompt } from "./generation/prompts.js";
import { axisStep, generatePrompts, mutatePrompt } from "./generation/prompts.js";
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
import { judgeWithFal, svgPreview } from "./evaluation/fal-judge.js";
import { animationFor } from "./assets/motion.js";
import { buildLayers, editImage, rankSubjects, type EditLineage, type EditPlan, type LayerConfig } from "./assets/layers.js";
import { buildParallax, buildVideoLoop, loopPrompt } from "./assets/animate.js";
import { loadJudgeContext, type JudgeContext } from "./evaluation/visual-context.js";
import { ffmpegAvailable } from "./shared/stills.js";

export interface BasteConfig {
  // Generation services config
  generation: GenerationConfig;

  // QD parameters
  qd: QDConfig;

  // Number of final assets to produce per type
  outputCount: number;

  // LLM evaluator config
  evaluator: EvaluatorConfig;

  /** Repaint QD candidates with the edit model and cut final images into layers. */
  edit?: boolean;

  /** Animated loops from each final image. */
  animate?: AnimateMode;
}

/** One image the QD search generated and judged, kept or not. */
export interface QDCandidate {
  generation: number;
  path: string;
  sourceUrl?: string;
  quality: number;
  features: number[];
  criteria: EvaluationResult["criteria"];
  feedback: string;
  /** Archive cell it landed in, when it beat that cell's previous holder. */
  cell?: string;
  /** How it was made, when it repaints another candidate's image. */
  edit?: EditLineage;
}

/** A QD genome: the prompt, and once judged, the image it produced. */
export interface ImageGenome {
  prompt: string;
  /** The image generated, or edited, from this genome and judged. */
  asset?: GeneratedAsset;
  /** Subjects Jev saw in that image, most likely first, for cutting it into layers. */
  subjects?: string[];
  /** Set on a child that repaints a region of its parent's image instead of generating anew. */
  edit?: EditPlan;
}

/** Of the children that may be edits, roughly this share are. */
const EDIT_SHARE = 0.5;

export interface AssetSuite {
  persona: Persona;
  assets: {
    svgs: GeneratedAsset[];
    images: GeneratedAsset[];
    videos: GeneratedAsset[];
  };
  archive: QDArchive<ImageGenome>;
  evaluations: EvaluationResult[];
  /** Every QD candidate in generation order, with where it landed. */
  candidates: QDCandidate[];
  /** Judge scores for each final asset, by asset id. */
  finalScores: Record<string, EvaluationResult>;
  metadata: {
    generationDuration: number;
    totalIterations: number;
    coverage: number;
  };
}

/**
 * Generate a complete asset suite for a persona
 */
/** Live progress for callers that show a run as it happens, such as the Studio. */
export interface GenerationHooks {
  log?: (line: string) => void;
  /** Each QD candidate as soon as it has been generated and judged. */
  candidate?: (candidate: QDCandidate) => void;
}

export async function generateAssetSuite(
  persona: Persona,
  assetTypes: AssetType[],
  config: BasteConfig,
  hooks: GenerationHooks = {},
): Promise<AssetSuite> {
  const log = hooks.log ?? console.log;
  const startTime = Date.now();
  const generator = new AssetGenerator(config.generation);
  const evaluations: EvaluationResult[] = [];
  const candidates: QDCandidate[] = [];
  const finalScores: Record<string, EvaluationResult> = {};
  const evaluatorProvider = resolveEvaluatorProvider(config.evaluator);
  // Surface missing credentials to the GUI before generating paid assets.
  if (assetTypes.some(a => a.kind === "video") && (config.generation.videoProvider ?? "seedance") === "seedance"
      && !config.generation.videoApiKey && !process.env.ARK_API_KEY) {
    throw new Error("Seedance needs ARK_API_KEY");
  }
  const needsFal = evaluatorProvider === "fal"
    || (config.generation.imageProvider === "fal" && assetTypes.some(a => a.kind === "image"))
    || (config.generation.svgProvider === "fal" && assetTypes.some(a => a.kind === "svg"))
    || (config.generation.videoProvider === "fal" && assetTypes.some(a => a.kind === "video"));
  if (needsFal && !config.generation.falApiKey && !process.env.FAL_KEY) {
    throw new Error("fal needs FAL_KEY");
  }
  // Editing, segmenting and image-to-video are separate models from the one that creates.
  const wantsLayers = !!(config.edit || config.animate);
  if (wantsLayers && !config.generation.notOrganicFetch && !config.generation.falApiKey && !process.env.FAL_KEY) throw new Error("Editing and animation run on fal: set FAL_KEY");

  // Jev looks at pixels: load the persona's reference images and rated examples once.
  const jevLooks = config.evaluator.vision !== false && (evaluatorProvider === "notorganic" || (evaluatorProvider === "typesafe" && !!(config.evaluator.apiKey || process.env.TYPESAFE_API_KEY)));
  let judgeContext: JudgeContext | undefined;
  if (jevLooks) {
    judgeContext = await loadJudgeContext(persona, config.generation.outputDir);
    const { references, examples } = judgeContext;
    const rated = examples.image.liked.length + examples.image.disliked.length + examples.svg.liked.length + examples.svg.disliked.length;
    log(`   Jev looks at each asset${references.length ? `, beside ${references.length} reference image${references.length === 1 ? "" : "s"}` : ""}${rated ? ` and ${rated} rated example${rated === 1 ? "" : "s"}` : ""}`);
    if (assetTypes.some((a) => a.kind === "video") && !ffmpegAvailable()) log("   Install ffmpeg to let Jev read video frames; loops are judged on their prompt");
  }

  log(`\n🎨 Baste: Generating assets for "${persona.name}"`);
  log(`   Persona: ${persona.summary}`);
  log(`   Asset types: ${assetTypes.map((a) => a.kind).join(", ")}`);

  // Generate prompts for each asset type
  const promptsByAsset = new Map<AssetType, Record<string, GeneratedPrompt>>();
  for (const asset of assetTypes) {
    promptsByAsset.set(asset, generatePrompts(persona, asset));
  }

  // Run QD evolution for image assets (most impactful for UI)
  const imageAssets = assetTypes.filter((a) => a.kind === "image");
  let archive: QDArchive<ImageGenome> = createArchive(config.qd);
  const animation = animationFor(persona);
  const subjects = animation.subjects;
  const layerCfg: LayerConfig = {
    outputDir: config.generation.outputDir,
    falKey: config.generation.falApiKey,
    notOrganicFetch: config.generation.notOrganicFetch,
    segmentModel: config.generation.segmentModel ?? DEFAULT_SEGMENT_MODEL,
    editModel: config.generation.editModel ?? DEFAULT_EDIT_MODEL,
    renderingSpeed: config.generation.editRenderingSpeed,
    ...(jevLooks ? { judge: config.evaluator } : {}),
  };
  // At most about half of each generation's children repaint a parent; the rest are drawn anew.
  let editsLeft = config.edit && imageAssets.length ? config.qd.iterations * Math.ceil(config.qd.batchSize / 2) : 0;
  if (editsLeft) log(`   Edits: up to ${editsLeft} candidates repaint a parent's image with ${layerCfg.editModel}, segmented by ${layerCfg.segmentModel}`);
  if (wantsLayers) log(`   Final images are cut into layers${config.animate ? ` and animated (${config.animate})` : ""}`);

  if (imageAssets.length > 0) {
    log("\n🧬 Starting QD evolution for images...");

    const imageAsset = imageAssets[0];
    const prompts = promptsByAsset.get(imageAsset)!;

    archive = await runQD<ImageGenome>(
      { ...config.qd, log },
      // Seed generation
      async () => ({
        genome: { prompt: prompts.image.prompt },
        quality: 0,
        features: [0, 0, 0],
        generation: 0,
      }),
      // Mutation: repaint a region of the parent's image, or draw from a mutated prompt.
      async (parent, rate) => {
        const from = parent.genome.asset;
        const parentSubjects = parent.genome.subjects ?? rankSubjects(subjects);
        // The budget is spent synchronously, before any await, so concurrent children share it safely.
        const step = from && parentSubjects.length && editsLeft > 0 && Math.random() < EDIT_SHARE ? axisStep(parent.genome.prompt) : undefined;
        if (from && step) {
          editsLeft--;
          const layer = animation.focus === "both" ? (Math.random() < 0.5 ? "background" : "subject") : animation.focus;
          return { genome: { prompt: step.prompt, edit: { from, subjects: parentSubjects, layer, step } }, quality: 0, features: [0, 0, 0], generation: 0 };
        }
        return { genome: { prompt: mutatePrompt(parent.genome.prompt, persona, rate) }, quality: 0, features: [0, 0, 0], generation: 0 };
      },
      // Evaluation
      async (genome, { generation }) => {
        let asset: GeneratedAsset | undefined;
        let lineage: EditLineage | undefined;
        if (genome.edit) {
          try {
            const edited = await editImage(persona, imageAsset, genome.edit, layerCfg);
            if (edited) ({ asset, lineage } = edited);
            else log(`   No subject to repaint in ${basename(genome.edit.from.content)}; drawing anew`);
          } catch (error) {
            log(`   Edit failed (${error instanceof Error ? error.message : String(error)}); drawing anew`);
          }
        }
        // Generate the asset
        asset ??= await generator.generate(persona, imageAsset, {
          ...prompts.image,
          prompt: genome.prompt,
        });
        const judgedPrompt = lineage ? `${genome.prompt}\nEdit: ${lineage.instruction}` : genome.prompt;

        // Evaluate with LLM judge
        const evalResults = await evaluateBatch(
          persona,
          [
            {
              type: "image",
              prompt: judgedPrompt,
              content: asset.content,
              purpose: imageAsset.purpose,
              metadata: asset.metadata,
              suite: assetTypes.map(a => ({ type: a.kind, purpose: a.purpose, prompt: promptsByAsset.get(a)![a.kind].prompt })),
              judgeContext,
              ...(wantsLayers ? { subjects } : {}),
            },
          ],
          // Evaluation function: a vision model on fal, or OpenAI over the prompt
          async (system, user) => {
            if (evaluatorProvider === "fal") {
              return judgeWithFal(system, user, { model: config.evaluator.model, apiKey: config.evaluator.apiKey, temperature: config.evaluator.temperature, imageUrl: asset.metadata.sourceUrl });
            }
            const apiKey = config.evaluator.apiKey || process.env.OPENAI_API_KEY;
            if (!apiKey) {
              console.warn("[baste] No OPENAI_API_KEY set — using rule-based heuristic evaluation (set OPENAI_API_KEY or evaluator.apiKey for LLM judge)");
              // Local heuristic: score based on prompt richness and persona keyword overlap.
              // Ensures the archive is still useful even without an LLM API key.
              const keywords = [...persona.aesthetic.visualKeywords, ...persona.aesthetic.moodKeywords];
              const promptWords = genome.prompt.toLowerCase().split(/[^a-z]+/);
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
        const candidate: QDCandidate = {
          generation, path: asset.content, sourceUrl: asset.metadata.sourceUrl, quality,
          features: result.features, criteria: result.criteria, feedback: result.feedback,
          ...(lineage ? { edit: lineage } : {}),
        };
        candidates.push(candidate);
        hooks.candidate?.(candidate);
        log(`   Candidate ${candidates.length} (generation ${generation}${lineage ? ", edited" : ""}) judged ${quality.toFixed(2)}`);

        return {
          quality,
          features: result.features,
          genome: { prompt: genome.prompt, asset, subjects: rankSubjects(subjects, result.typesafe?.visual?.subject) },
        };
      }
    );
    // Record which candidates hold a cell in the final archive.
    for (const [cell, solution] of archive.cells) {
      const held = candidates.find((c) => c.path === solution.genome.asset?.content);
      if (held) held.cell = cell;
    }
  }

  // Generate final diverse assets from archive
  log("\n🎯 Generating final assets...");
  const diversePrompts: QDSolution<ImageGenome>[] = imageAssets.length > 0 ? getDiverseSamples(archive, config.outputCount)
    : [{ genome: { prompt: "" }, quality: 0, features: [0, 0, 0], generation: 0 }];

  const finalAssets: GeneratedAsset[] = [];
  /** Subjects Jev saw in each final image, by asset id. */
  const finalSubjects = new Map<string, string[]>();

  for (const solution of diversePrompts) {
    for (const assetType of assetTypes) {
      try {
        const originalPrompt = promptsByAsset.get(assetType)![assetType.kind];
        // Only the evolved asset takes the evolved genome. Other images keep their own
        // brief: a hero must not be drawn from the background's prompt.
        const evolved = assetType === imageAssets[0];
        // The search already drew and judged the evolved image: ship those pixels rather than drawing new ones.
        const asset = (evolved ? solution.genome.asset : undefined) ?? await generator.generate(persona, assetType, {
          ...originalPrompt,
          prompt: evolved && solution.genome.prompt ? solution.genome.prompt : originalPrompt.prompt,
        });
        if (evaluatorProvider === "fal") {
          // The judge looks at images and rendered SVG; videos are judged on their brief.
          const imageUrl = asset.type === "image" ? asset.metadata.sourceUrl : asset.type === "svg" ? svgPreview(asset.content) : undefined;
          const [evaluation] = await evaluateBatch(persona, [{
            type: asset.type, prompt: asset.prompt, content: imageUrl ? undefined : asset.content,
            purpose: assetType.purpose, metadata: asset.metadata,
          }], (system, user) => judgeWithFal(system, user, {
            model: config.evaluator.model, apiKey: config.evaluator.apiKey, temperature: config.evaluator.temperature, imageUrl,
          }), config.evaluator);
          evaluations.push(evaluation);
          finalScores[asset.id] = evaluation;
        }
        if (evaluatorProvider === "typesafe" || evaluatorProvider === "notorganic") {
          const [evaluation] = await evaluateBatch(persona, [{
            type: asset.type, prompt: asset.prompt, content: asset.content,
            purpose: assetType.purpose, metadata: asset.metadata,
            suite: finalAssets.map(a => ({ type: a.type, purpose: a.metadata.assetPurpose, prompt: a.prompt, metadata: a.metadata, path: a.content })),
            judgeContext,
            ...(wantsLayers && asset.type === "image" ? { subjects } : {}),
          }], async () => { throw new Error("Unexpected OpenAI evaluator selection"); }, config.evaluator);
          evaluations.push(evaluation);
          finalScores[asset.id] = evaluation;
          if (evaluation.gate?.accepted === false) continue;
          if (wantsLayers && asset.type === "image") finalSubjects.set(asset.id, rankSubjects(subjects, evaluation.typesafe?.visual?.subject));
        }
        finalAssets.push(asset);
      } catch (error) {
        log(`Failed to generate ${assetType.kind}: ${error instanceof Error ? error.message : String(error)}`);
        if (assetType.kind === "video" || evaluatorProvider === "typesafe" || evaluatorProvider === "notorganic" || config.generation.imageProvider === "notorganic") throw error;
      }
    }
  }

  // Layers and loops from each final image. They come after the paid generation,
  // so a failure here is logged and the suite still ships.
  if (wantsLayers) {
    log("\n✂️  Cutting final images into layers...");
    for (const image of finalAssets.filter((a) => a.type === "image")) {
      const ranked = finalSubjects.get(image.id)
        ?? diversePrompts.find((s) => s.genome.asset?.id === image.id)?.genome.subjects
        ?? rankSubjects(subjects);
      const derived: NonNullable<GeneratedAsset["derived"]> = {};
      if (ranked.length) {
        try {
          const { layers, reason } = await buildLayers(image, persona, ranked, layerCfg);
          if (layers) {
            derived.layers = layers;
            log(`   ${image.id}: cut out the ${layers.subject}`);
            if (config.animate === "parallax" || config.animate === "both") {
              derived.parallax = await buildParallax(image, layers, persona, layerCfg.outputDir);
              log(`   ${image.id}: parallax loop${derived.parallax.video ? "" : " (install ffmpeg for the MP4)"}`);
            }
          } else log(`   ${image.id}: ${reason}; no layers`);
        } catch (error) {
          log(`   ${image.id}: layers failed (${error instanceof Error ? error.message : String(error)})`);
        }
      } else log(`   ${image.id}: Jev saw none of ${persona.name}'s subjects; no layers`);
      if (config.animate === "video" || config.animate === "both") {
        try {
          derived.loop = await buildVideoLoop(image, persona, ranked, {
            ...layerCfg,
            animateModel: config.generation.animateModel ?? DEFAULT_ANIMATE_MODEL,
            resolution: config.generation.animateResolution,
          });
          log(`   ${image.id}: video loop${derived.loop.end ? " to an edited end frame" : ""}${derived.loop.video ? "" : " (install ffmpeg to close the loop)"}`);
          if (jevLooks) {
            const [judged] = await evaluateBatch(persona, [{
              type: "video", prompt: loopPrompt(persona), content: derived.loop.video ?? derived.loop.transition,
              purpose: `${image.metadata.assetPurpose} loop`, metadata: image.metadata, judgeContext,
            }], async () => { throw new Error("Unexpected OpenAI evaluator selection"); }, config.evaluator);
            evaluations.push(judged);
            derived.loop.judged = { overall: judged.overall, improvements: judged.improvements };
            for (const line of judged.improvements) log(`     ${line}`);
          }
        } catch (error) {
          log(`   ${image.id}: video loop failed (${error instanceof Error ? error.message : String(error)})`);
        }
      }
      if (Object.keys(derived).length) image.derived = derived;
    }
  }

  // Categorize by type
  const svgs = finalAssets.filter((a) => a.type === "svg");
  const images = finalAssets.filter((a) => a.type === "image");
  const videos = finalAssets.filter((a) => a.type === "video");

  const duration = Date.now() - startTime;

  log(`\n✅ Asset suite complete for "${persona.name}"`);
  log(`   Generated: ${svgs.length} SVGs, ${images.length} images, ${videos.length} videos`);
  log(`   Time: ${(duration / 1000).toFixed(1)}s`);

  return {
    persona,
    assets: { svgs, images, videos },
    archive,
    evaluations,
    candidates,
    finalScores,
    metadata: {
      generationDuration: duration,
      totalIterations: config.qd.iterations,
      coverage: archive.coverage,
    },
  };
}

function createArchive(config: QDConfig) {
  const cells = new Map<string, QDSolution<ImageGenome>>();
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
  config: BasteConfig,
  hooks: GenerationHooks = {},
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

  return generateAssetSuite(persona, uiComponents, config, hooks);
}
