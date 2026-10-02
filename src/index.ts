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
export { evaluateWithTypeSafe, PET_PEEVE_REJECTION_THRESHOLD } from "./evaluation/typesafe-judge.js";
export type { TypeSafeJudgments, ScoreAnswer } from "./evaluation/typesafe-judge.js";
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
