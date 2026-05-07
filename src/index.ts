/**
 * Baste - Persona-Driven Asset Generation
 *
 * Main exports for the Baste library
 */

// Persona system
export {
  getPersona,
  listPersonas,
  savePersona,
  deletePersona,
  initStore,
  isBasePersona,
  isCustomPersona,
  getBasePersonas,
  getCustomPersonas,
  getCustomDir,
} from "./persona/store.js";
export { basePersonas } from "./persona/base-personas.js";
export { buildPersona, extendPersona } from "./persona/builder.js";
export { extractAestheticFromPersona } from "./persona/types.js";
export type {
  Persona,
  CulturalIdentity,
  Influences,
  Behaviors,
  AestheticProfile,
} from "./persona/types.js";
export type { StoreConfig } from "./persona/store.js";
export type { PersonaDraft } from "./persona/builder.js";

// Prompt generation
export {
  generatePrompts,
  mutatePrompt,
} from "./generation/prompts.js";
export type {
  AssetType,
  GeneratedPrompt,
} from "./generation/prompts.js";

// Quality Diversity
export {
  runQD,
  createArchive,
  addToArchive,
  selectParent,
  getDiverseSamples,
  defaultAssetFeatures,
  getBinKey,
} from "./generation/qd.js";
export type {
  QDConfig,
  QDSolution,
  QDArchive,
  FeatureDescriptor,
} from "./generation/qd.js";

// Evaluation
export {
  buildEvaluationPrompt,
  parseEvaluation,
  evaluateBatch,
  createScorer,
} from "./evaluation/judge.js";
export type {
  EvaluationCriteria,
  EvaluationResult,
  EvaluateOptions,
} from "./evaluation/judge.js";

// Asset generation
export {
  AssetGenerator,
  SVGGenerator,
  ImageGenerator,
  VideoGenerator,
} from "./assets/generators.js";
export type {
  GeneratedAsset,
  GenerationConfig,
} from "./assets/generators.js";

// Design system
export {
  generateDesignTokens,
  exportCSS,
  exportTailwindConfig,
} from "./assets/design-system.js";
export type {
  DesignTokens,
  ColorPalette,
  TypographyTokens,
  SpacingTokens,
} from "./assets/design-system.js";

// Main orchestrator
export {
  generateAssetSuite,
  generateUIKit,
} from "./baste.js";
export type {
  BasteConfig,
  AssetSuite,
} from "./baste.js";
