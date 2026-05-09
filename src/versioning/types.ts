/**
 * Semantic Version Control Types for Design Components
 *
 * Change-first versioning (Lix-inspired) for design systems.
 * Instead of snapshot diffs, we track semantic changes like
 * "color.primary changed from #8B6914 to #4A6FA5".
 */

import type { Persona } from "../persona/types.js";
import type { DesignTokens } from "../assets/design-system.js";

/** Semantic change types for design components */
export type ChangeType =
  | "color_change"       // Token color value changed
  | "typography_change"  // Font or type scale changed
  | "spacing_change"     // Spacing or density changed
  | "border_change"      // Border radius/style changed
  | "shadow_change"      // Shadow or glow changed
  | "motion_change"      // Timing/easing changed
  | "asset_added"        // New asset (image/svg/video) added
  | "asset_removed"      // Asset removed
  | "asset_updated"      // Asset content changed
  | "persona_updated"     // Persona definition changed
  | "cultural_ref_added" // Cultural reference added
  | "cultural_ref_removed" // Cultural reference removed
  | "influence_added"    // New influence added
  | "influence_removed"  // Influence removed
  | "merge"             // Version merge
  | "custom";           // User-defined change

/** A single semantic change in the design history */
export interface DesignChange {
  id: string;
  changeType: ChangeType;
  entityType: "token" | "asset" | "persona" | "cultural_ref" | "component" | "suite";
  entityId: string;
  property?: string;
  oldValue?: string;
  newValue?: string;
  commitId: string;
  createdAt: number;
  author?: string;
  notes?: string;
}

/** A committed version of the design system */
export interface ComponentVersion {
  id: string;
  commitId: string;
  parentId: string | null;
  message: string;
  author: string;
  createdAt: number;
  personaId: string;
  suiteId?: string;
  changeCount: number;
  // Computed hash of all state at this version
  stateHash: string;
}

/** A named branch for parallel design exploration */
export interface DesignBranch {
  id: string;
  name: string;
  description?: string;
  commitId: string;
  personaId: string;
  createdAt: number;
  isDefault: boolean;
}

/** A design component in the registry */
export interface DesignComponent {
  id: string;
  personaId: string;
  name: string;
  description: string;
  category: ComponentCategory;
  tags: string[];
  // The actual design content
  tokens: DesignTokens;
  // References to assets
  assets: {
    svg?: string[];
    image?: string[];
    video?: string[];
  };
  // Cultural context (filled separately from DB)
  culturalRefs?: CulturalReference[];
  // Version tracking
  createdAt: number;
  updatedAt: number;
  currentVersionId: string;
}

/** Component categories */
export type ComponentCategory =
  | "color_system"
  | "typography_system"
  | "spacing_system"
  | "border_system"
  | "shadow_system"
  | "motion_system"
  | "icon_set"
  | "illustration"
  | "hero"
  | "background"
  | "animation"
  | "ui_kit"
  | "full_theme";

/** A cultural reference linked to a design component */
export interface CulturalReference {
  id: string;
  type: CulturalRefType;
  value: string;
  description?: string;
  // Why this reference matters to the design
  designRationale: string;
  // Source of inspiration (file path, URL, memory)
  source?: string;
  // Persona this reference belongs to
  personaId: string;
  // Optional: specific component this is linked to
  componentId?: string;
  createdAt: number;
}

export type CulturalRefType =
  | "film"
  | "show"
  | "anime"
  | "music_genre"
  | "music_artist"
  | "game"
  | "visual_artist"
  | "fashion"
  | "space"
  | "tool"
  | "obsession"
  | "subculture"
  | "value"
  | "image"       // Reference to an image file
  | "screenshot"  // UI reference screenshot
  | "logo"        // Brand/logo reference
  | "meme"        // Cultural meme reference
  | "custom";

/** Version diff result */
export interface VersionDiff {
  fromVersionId: string;
  toVersionId: string;
  changes: DesignChange[];
  summary: string;
  tokenDiffs: TokenDiff[];
}

/** Diff for a specific token */
export interface TokenDiff {
  tokenPath: string;
  oldValue: string;
  newValue: string;
  changeType: ChangeType;
}

/** Change proposal for review */
export interface ChangeProposal {
  id: string;
  branchId: string;
  title: string;
  description: string;
  changes: DesignChange[];
  createdAt: number;
  author: string;
  status: "open" | "merged" | "rejected" | "draft";
}

/** Query options for history */
export interface HistoryQuery {
  personaId?: string;
  componentId?: string;
  changeType?: ChangeType;
  since?: number;
  until?: number;
  author?: string;
  limit?: number;
}

/** Full design system export for sharing */
export interface SharableDesignSystem {
  version: string;
  schema: string;
  exportedAt: number;
  // The persona definition
  persona: Persona;
  // All components
  components: DesignComponent[];
  // Full version history
  versions: ComponentVersion[];
  // All changes
  changes: DesignChange[];
  // Cultural references with (optional) embedded media
  culturalRefs: CulturalReference[];
  // Embedded assets as base64 or references
  embeddedAssets?: Record<string, string>;
  metadata: {
    name: string;
    description: string;
    author: string;
    exportFormat: "baste";
    compatibility: string[];
  };
}
