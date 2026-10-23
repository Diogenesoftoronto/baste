import { TOKEN_FONT_FAMILIES, applyTokenOverrides, generateDesignTokens, type DesignTokens } from "../assets/design-system.js";
import type { Persona } from "../persona/types.js";
import { DESIGN_COLOR_ROLES, DESIGN_EDGES, type DesignEdge, type DesignOverrides, type DesignProject } from "./contracts.js";

/**
 * A project's design: the audience's generated tokens with the project's
 * saved adjustments laid over them. The audience snapshot alone determines
 * the base, so a project's history never shifts when a source persona or
 * brand kit changes later.
 */

const family = (stack: string) => stack.split(",")[0].trim().replace(/^['"]|['"]$/g, "");

export interface DesignReading {
  revision: number;
  colors: Record<(typeof DESIGN_COLOR_ROLES)[number], string>;
  headingFont: string;
  bodyFont: string;
  edges: DesignEdge;
  adjusted: string[];
}

/** Everything the Studio needs to preview values that are not saved yet. */
export interface ProjectDesign {
  reading: DesignReading;
  tokens: DesignTokens;
  /** Font stacks and radii per edge treatment, so previews match the engine. */
  options: { fonts: Record<string, string>; edges: Record<DesignEdge, DesignTokens["borders"]["radius"]> };
}

function base(audience: Persona) {
  const tokens = generateDesignTokens(audience);
  return {
    tokens,
    colors: Object.fromEntries(DESIGN_COLOR_ROLES.map((role) => [role, tokens.colors[role].toLowerCase()])) as DesignReading["colors"],
    headingFont: family(tokens.typography.fontFamily.heading),
    bodyFont: family(tokens.typography.fontFamily.body),
    edges: audience.aesthetic.edgeStyle,
  };
}

/** Drop adjustments that equal the generated design, so "saved" means "different". */
export function normalizeDesign(audience: Persona, design: DesignOverrides | undefined): DesignOverrides | undefined {
  if (!design) return undefined;
  const generated = base(audience);
  const colors = Object.fromEntries(Object.entries(design.colors ?? {}).filter(([role, value]) => generated.colors[role as keyof DesignReading["colors"]] !== value));
  const next: DesignOverrides = {};
  if (Object.keys(colors).length) next.colors = colors;
  if (design.headingFont && design.headingFont !== generated.headingFont) next.headingFont = design.headingFont;
  if (design.bodyFont && design.bodyFont !== generated.bodyFont) next.bodyFont = design.bodyFont;
  if (design.edges && design.edges !== generated.edges) next.edges = design.edges;
  return Object.keys(next).length ? next : undefined;
}

export function projectDesign(project: DesignProject): ProjectDesign | null {
  if (!project.audience) return null;
  const generated = base(project.audience);
  const design = project.design;
  const tokens = applyTokenOverrides(generated.tokens, design);
  const reading: DesignReading = {
    revision: project.revision,
    colors: { ...generated.colors, ...design?.colors },
    headingFont: design?.headingFont ?? generated.headingFont,
    bodyFont: design?.bodyFont ?? generated.bodyFont,
    edges: design?.edges ?? generated.edges,
    adjusted: [...Object.keys(design?.colors ?? {}).map((role) => `colors.${role}`), ...(["headingFont", "bodyFont", "edges"] as const).filter((key) => design?.[key])],
  };
  const sample = applyTokenOverrides(generated.tokens, null);
  return {
    reading,
    tokens,
    options: {
      fonts: Object.fromEntries(TOKEN_FONT_FAMILIES.map((name) => [name, applyTokenOverrides(sample, { headingFont: name }).typography.fontFamily.heading])),
      edges: Object.fromEntries(DESIGN_EDGES.map((edge) => [edge, applyTokenOverrides(sample, { edges: edge }).borders.radius])) as ProjectDesign["options"]["edges"],
    },
  };
}
