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
export { evaluateWithTypeSafe, PET_PEEVE_REJECTION_THRESHOLD, TEXT_REJECTION_THRESHOLD, TASTE_WEIGHT } from "./evaluation/typesafe-judge.js";
export type { TypeSafeJudgments, ScoreAnswer, ChoiceAnswer, JudgeEvidence, VisualJudgments } from "./evaluation/typesafe-judge.js";
export { loadJudgeContext, loadReferences, loadExamples } from "./evaluation/visual-context.js";
export type { JudgeContext, JudgeImage, RatedExamples } from "./evaluation/visual-context.js";
export type {
  EvaluationCriteria,
  EvaluationResult,
  EvaluateOptions,
} from "./evaluation/judge.js";

// Layers and animation
export {
  buildLayers,
  editImage,
  editMask,
  cutout,
  normalizeMask,
  segmentSubject,
  rankSubjects,
  repaint,
  EDIT_COLOR,
} from "./assets/layers.js";
export type { Layers, LayerConfig, SubjectMask, EditPlan, EditLineage, EditRegion } from "./assets/layers.js";
export { buildParallax, buildVideoLoop, parallaxHtml, parallaxMotion, loopPrompt } from "./assets/animate.js";
export type { ParallaxSpec, ParallaxFiles, VideoLoop } from "./assets/animate.js";
export { animationFor, defaultAnimation, CAMERA_MOVES } from "./assets/motion.js";
export { falUpload, falImageInput } from "./assets/fal.js";

// Motion primitives
export {
  MOTION_LANGUAGE,
  MOTION_MOMENTS,
  motionTokens,
  exportMotionCSS,
  keyframesCSS,
  springEasing,
  springPosition,
  videoMotionPhrase,
} from "./assets/motion.js";
export type { MotionTokens, MotionPrimitive, MotionMoment, MotionKeyframe, MotionStyle } from "./assets/motion.js";

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
  exportPandaTheme,
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

// Version Control — Design Component History
export {
  DesignVersionRegistry,
} from "./versioning/registry.js";
export {
  exportDesignSystem,
  exportDesignSystemLight,
  writeBasteFile,
  readBasteFile,
  importDesignSystem,
  mergeDesignSystems,
  validateBasteFile,
  BASTE_FORMAT_VERSION,
  BASTE_SCHEMA,
} from "./versioning/shareable.js";
export {
  getDB,
  DesignVersionDB,
} from "./versioning/database.js";
export type {
  DesignChange,
  ComponentVersion,
  DesignBranch,
  DesignComponent,
  CulturalReference,
  CulturalRefType,
  ChangeType,
  ComponentCategory,
  HistoryQuery,
  VersionDiff,
  ChangeProposal,
  SharableDesignSystem,
} from "./versioning/types.js";

// OpenPencil Bridge
export {
  personaToOpenPencil,
  serializeOpenPencil,
  deserializeOpenPencil,
  extractTokensFromOpenPencil,
  exportToOpenPencil,
} from "./openpencil/bridge.js";
export type {
  OpenPencilDocument as OpenPencilDoc,
  OpenPencilToken,
  OpenPencilPage,
  OpenPencilFrame,
  OpenPencilNode,
  OpenPencilComponent,
} from "./openpencil/bridge.js";

// MCP Server
export {
  createBasteMCPServer,
  runBasteMcpStdio,
  runBasteMcpHttp,
} from "./mcp/server.js";
export type {
  MCPOptions,
  HTTPMCPOptions,
} from "./mcp/server.js";

// Durable projects and shared commands for Studio and future agent tools.
export { listProjects, getProject, createProject, applyProjectCommand, ProjectError } from "./projects/commands.js";
export { PROJECT_LIMITS } from "./projects/contracts.js";
export type { DesignProject, DesignPartner, ProjectSummary, ProjectRevision, ProjectDetail, CreateProjectRequest, ProjectCommand } from "./projects/contracts.js";
