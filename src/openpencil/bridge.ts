/**
 * OpenPencil Bridge
 *
 * Converts Baste design components into OpenPencil-editable formats
 * and vice versa. Enables round-trip editing:
 * Baste persona → OpenPencil .pen file → Edited design → Import back
 */

import type { Persona } from "../persona/types.js";
import type { DesignTokens } from "../assets/design-system.js";
import type { DesignComponent, CulturalReference } from "../versioning/types.js";
import { generateDesignTokens } from "../assets/design-system.js";

/** OpenPencil file format (.pen / .fig compatible representation) */
export interface OpenPencilDocument {
  version: string;
  type: "baste_design";
  metadata: {
    personaId: string;
    personaName: string;
    exportedAt: number;
    basteVersion: string;
  };
  // Design tokens as token definitions
  tokens: OpenPencilToken[];
  // Artboards / frames
  pages: OpenPencilPage[];
  // Cultural context embedded in the file
  culturalContext: {
    references: CulturalReference[];
    rationale: string;
  };
  // Library components that can be reused
  components: OpenPencilComponent[];
}

/** Design token in OpenPencil format */
export interface OpenPencilToken {
  id: string;
  name: string;
  type: "color" | "font" | "spacing" | "radius" | "shadow" | "duration" | "easing";
  value: string;
  description?: string;
  category: string;
}

/** Page / artboard */
export interface OpenPencilPage {
  id: string;
  name: string;
  width: number;
  height: number;
  // Frames/groups on the page
  frames: OpenPencilFrame[];
}

/** Frame (like a Figma frame) */
export interface OpenPencilFrame {
  id: string;
  name: string;
  type: "frame" | "group" | "component";
  x: number;
  y: number;
  width: number;
  height: number;
  // Background or fill
  fill?: OpenPencilFill;
  // Child elements
  children: OpenPencilNode[];
}

/** Any node on canvas */
export interface OpenPencilNode {
  id: string;
  name: string;
  type: "rectangle" | "text" | "image" | "svg" | "component" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  // Styles applied
  fill?: OpenPencilFill;
  stroke?: OpenPencilStroke;
  text?: OpenPencilText;
  // Component reference
  componentId?: string;
  // Clip content (for images within shapes)
  clip?: boolean;
}

export interface OpenPencilFill {
  type: "solid" | "gradient" | "image" | "pattern";
  color?: string;
  gradient?: { stops: Array<{ offset: number; color: string }> };
  imageRef?: string;
}

export interface OpenPencilStroke {
  color: string;
  width: number;
  style: "solid" | "dashed" | "dotted";
}

export interface OpenPencilText {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  lineHeight: number;
  alignment: "left" | "center" | "right";
}

/** Reusable component definition */
export interface OpenPencilComponent {
  id: string;
  name: string;
  description?: string;
  // Design tokens used by this component
  tokens: string[];
  // The root frame
  frame: OpenPencilFrame;
  // Variants
  variants?: OpenPencilComponent[];
}

/**
 * Convert a Baste persona + design tokens into an OpenPencil document
 */
export function personaToOpenPencil(
  persona: Persona,
  tokens: DesignTokens,
  refs: CulturalReference[] = []
): OpenPencilDocument {
  const doc: OpenPencilDocument = {
    version: "1.0",
    type: "baste_design",
    metadata: {
      personaId: persona.id,
      personaName: persona.name,
      exportedAt: Date.now(),
      basteVersion: "0.2.0",
    },
    tokens: convertTokensToOpenPencil(tokens),
    pages: buildDesignPages(persona, tokens),
    culturalContext: {
      references: refs,
      rationale: buildCulturalRationale(persona),
    },
    components: buildReusableComponents(tokens, persona),
  };

  return doc;
}

/** Convert design tokens to OpenPencil token format */
function convertTokensToOpenPencil(tokens: DesignTokens): OpenPencilToken[] {
  const results: OpenPencilToken[] = [];

  // Colors
  const colorMap: Record<string, string> = {
    primary: tokens.colors.primary,
    secondary: tokens.colors.secondary,
    accent: tokens.colors.accent,
    background: tokens.colors.background,
    surface: tokens.colors.surface,
    text: tokens.colors.text,
    "text-muted": tokens.colors.textMuted,
    border: tokens.colors.border,
    warm: tokens.colors.warm,
    cool: tokens.colors.cool,
  };

  for (const [name, value] of Object.entries(colorMap)) {
    results.push({
      id: `color-${name}`,
      name: `Color / ${name}`,
      type: "color",
      value,
      category: "colors",
    });
  }

  // Typography
  results.push({
    id: "font-heading",
    name: "Font / Heading",
    type: "font",
    value: tokens.typography.fontFamily.heading,
    category: "typography",
  });
  results.push({
    id: "font-body",
    name: "Font / Body",
    type: "font",
    value: tokens.typography.fontFamily.body,
    category: "typography",
  });
  results.push({
    id: "font-mono",
    name: "Font / Mono",
    type: "font",
    value: tokens.typography.fontFamily.mono,
    category: "typography",
  });

  // Border radius
  results.push({
    id: "radius-sm",
    name: "Radius / Small",
    type: "radius",
    value: tokens.borders.radius.sm,
    category: "borders",
  });
  results.push({
    id: "radius-base",
    name: "Radius / Base",
    type: "radius",
    value: tokens.borders.radius.base,
    category: "borders",
  });
  results.push({
    id: "radius-lg",
    name: "Radius / Large",
    type: "radius",
    value: tokens.borders.radius.lg,
    category: "borders",
  });

  // Motion
  results.push({
    id: "duration-fast",
    name: "Duration / Fast",
    type: "duration",
    value: tokens.motion.duration.fast,
    category: "motion",
  });
  results.push({
    id: "duration-base",
    name: "Duration / Base",
    type: "duration",
    value: tokens.motion.duration.base,
    category: "motion",
  });
  results.push({
    id: "ease-default",
    name: "Easing / Default",
    type: "easing",
    value: tokens.motion.easing.default,
    category: "motion",
  });

  return results;
}

/** Build design pages from persona + tokens */
function buildDesignPages(persona: Persona, tokens: DesignTokens): OpenPencilPage[] {
  const pages: OpenPencilPage[] = [];

  // Page 1: Token Overview (design system reference)
  pages.push({
    id: "page-tokens",
    name: "Design Tokens",
    width: 1200,
    height: 800,
    frames: [
      buildColorSwatches(tokens, persona),
      buildTypeSpecimen(tokens, persona),
      buildSpacingGrid(tokens),
    ],
  });

  // Page 2: Cultural Context Board
  pages.push({
    id: "page-culture",
    name: `Cultural Board — ${persona.name}`,
    width: 1600,
    height: 1000,
    frames: buildCultureFrames(persona),
  });

  return pages;
}

function buildColorSwatches(tokens: DesignTokens, persona: Persona): OpenPencilFrame {
  const colors = [
    tokens.colors.primary,
    tokens.colors.secondary,
    tokens.colors.accent,
    tokens.colors.background,
    tokens.colors.surface,
    tokens.colors.text,
    tokens.colors.textMuted,
    tokens.colors.border,
    tokens.colors.warm,
    tokens.colors.cool,
  ];

  const children: OpenPencilNode[] = colors.map((color, i) => ({
    id: `swatch-${i}`,
    name: `Swatch ${i + 1}`,
    type: "rectangle",
    x: 20 + (i % 5) * 140,
    y: 20 + Math.floor(i / 5) * 140,
    width: 120,
    height: 120,
    fill: { type: "solid", color },
  }));

  return {
    id: "frame-colors",
    name: "Color Palette",
    type: "frame",
    x: 0,
    y: 0,
    width: 740,
    height: 290,
    fill: { type: "solid", color: tokens.colors.background },
    children,
  };
}

function buildTypeSpecimen(tokens: DesignTokens, persona: Persona): OpenPencilFrame {
  return {
    id: "frame-typography",
    name: "Typography",
    type: "frame",
    x: 760,
    y: 0,
    width: 440,
    height: 290,
    fill: { type: "solid", color: tokens.colors.background },
    children: [
      {
        id: "type-heading",
        name: "Heading Sample",
        type: "text",
        x: 20,
        y: 20,
        width: 400,
        height: 50,
        text: {
          content: persona.name,
          fontFamily: tokens.typography.fontFamily.heading,
          fontSize: 32,
          fontWeight: 700,
          color: tokens.colors.text,
          lineHeight: 1.2,
          alignment: "left",
        },
      },
      {
        id: "type-body",
        name: "Body Sample",
        type: "text",
        x: 20,
        y: 90,
        width: 400,
        height: 60,
        text: {
          content: persona.summary.slice(0, 80) + "...",
          fontFamily: tokens.typography.fontFamily.body,
          fontSize: 16,
          fontWeight: 400,
          color: tokens.colors.textMuted,
          lineHeight: 1.5,
          alignment: "left",
        },
      },
    ],
  };
}

function buildSpacingGrid(tokens: DesignTokens): OpenPencilFrame {
  const entries = Object.entries(tokens.spacing.scale).slice(0, 5);
  return {
    id: "frame-spacing",
    name: "Spacing Scale",
    type: "frame",
    x: 0,
    y: 310,
    width: 1200,
    height: 200,
    fill: { type: "solid", color: tokens.colors.surface },
    children: entries.map(([key, value], i) => ({
      id: `space-${key}`,
      name: `Space ${key}`,
      type: "rectangle",
      x: 20 + i * 220,
      y: 60,
      width: parseFloat(value) * 16,
      height: parseFloat(value) * 16,
      fill: { type: "solid", color: tokens.colors.primary },
    })),
  };
}

function buildCultureFrames(persona: Persona): OpenPencilFrame[] {
  const frames: OpenPencilFrame[] = [];

  // Mood keywords as text blocks
  const moodTexts = persona.aesthetic.moodKeywords.slice(0, 6);
  frames.push({
    id: "frame-mood",
    name: "Mood",
    type: "frame",
    x: 20,
    y: 20,
    width: 400,
    height: 400,
    fill: { type: "solid", color: persona.aesthetic.colorTemperature === "cool" ? "#1A1F2E" : "#F5F0E8" },
    children: moodTexts.map((word, i) => ({
      id: `mood-${i}`,
      name: word,
      type: "text",
      x: 20,
      y: 20 + i * 30,
      width: 360,
      height: 30,
      text: {
        content: word,
        fontFamily: persona.aesthetic.typographyStyle === "retro" ? "'Courier New', monospace" : "system-ui",
        fontSize: 18,
        fontWeight: 400,
        color: persona.aesthetic.colorTemperature === "cool" ? "#E8E8F0" : "#2D2926",
        lineHeight: 1.2,
        alignment: "left",
      },
    })),
  });

  // Visual keywords as labeled blocks
  const visualTexts = persona.aesthetic.visualKeywords.slice(0, 6);
  frames.push({
    id: "frame-visual",
    name: "Visual References",
    type: "frame",
    x: 440,
    y: 20,
    width: 500,
    height: 400,
    fill: { type: "solid", color: persona.aesthetic.colorTemperature === "cool" ? "#242B3D" : "#FFFFFF" },
    children: visualTexts.map((word, i) => ({
      id: `visual-${i}`,
      name: word,
      type: "rectangle",
      x: 20 + (i % 3) * 160,
      y: 60 + Math.floor(i / 3) * 80,
      width: 140,
      height: 60,
      fill: { type: "solid", color: persona.aesthetic.colorTemperature === "cool" ? "#3A4055" : "#F5F0E8" },
      children: [
        {
          id: `vtext-${i}`,
          name: `${word} label`,
          type: "text",
          x: 20 + (i % 3) * 160,
          y: 60 + Math.floor(i / 3) * 80,
          width: 140,
          height: 60,
          text: {
            content: word,
            fontFamily: "system-ui",
            fontSize: 12,
            fontWeight: 500,
            color: persona.aesthetic.colorTemperature === "cool" ? "#8A8FA8" : "#7A756E",
            lineHeight: 1.2,
            alignment: "center",
          },
        },
      ],
    }) as any),
  });

  return frames;
}

/** Build reusable component library */
function buildReusableComponents(tokens: DesignTokens, persona: Persona): OpenPencilComponent[] {
  return [
    {
      id: "comp-button-primary",
      name: "Button / Primary",
      description: "Primary action button",
      tokens: ["color-primary", "color-text", "radius-base", "duration-fast"],
      frame: {
        id: "btn-primary",
        name: "Button / Primary",
        type: "component",
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        fill: { type: "solid", color: tokens.colors.primary },
        children: [
          {
            id: "btn-label",
            name: "Label",
            type: "text",
            x: 12,
            y: 10,
            width: 96,
            height: 20,
            text: {
              content: "Action",
              fontFamily: tokens.typography.fontFamily.body,
              fontSize: 14,
              fontWeight: 500,
              color: tokens.colors.surface,
              lineHeight: 1.2,
              alignment: "center",
            },
          },
        ],
      },
    },
    {
      id: "comp-card",
      name: "Card",
      description: "Surface container",
      tokens: ["color-surface", "color-text", "radius-lg", "shadow-base"],
      frame: {
        id: "card",
        name: "Card",
        type: "component",
        x: 0,
        y: 0,
        width: 300,
        height: 180,
        fill: { type: "solid", color: tokens.colors.surface },
        children: [
          {
            id: "card-content",
            name: "Content area",
            type: "rectangle",
            x: 20,
            y: 20,
            width: 260,
            height: 140,
            fill: { type: "solid", color: tokens.colors.background },
          },
        ],
      },
    },
    {
      id: "comp-hero",
      name: "Hero Section",
      description: "Persona hero banner",
      tokens: ["color-background", "color-primary", "font-heading"],
      frame: {
        id: "hero",
        name: "Hero",
        type: "component",
        x: 0,
        y: 0,
        width: 1200,
        height: 400,
        fill: { type: "gradient", gradient: { stops: [
          { offset: 0, color: tokens.colors.primary },
          { offset: 1, color: tokens.colors.secondary },
        ]} },
        children: [
          {
            id: "hero-title",
            name: "Title",
            type: "text",
            x: 60,
            y: 120,
            width: 600,
            height: 60,
            text: {
              content: persona.name,
              fontFamily: tokens.typography.fontFamily.heading,
              fontSize: 48,
              fontWeight: 700,
              color: tokens.colors.surface,
              lineHeight: 1.1,
              alignment: "left",
            },
          },
        ],
      },
    },
  ];
}

function buildCulturalRationale(persona: Persona): string {
  const parts = [
    `Design rationale for ${persona.name}:`,
    `\nColor approach: ${persona.aesthetic.colorTemperature} palette reflecting ${persona.culture.values[0]}.`,
    `\nTypography: ${persona.aesthetic.typographyStyle} style for ${persona.behaviors.interfaceValues[0]}.`,
    `\nDensity: ${persona.aesthetic.density} to match their ${persona.behaviors.platforms[0]} habits.`,
    `\nKey influences: ${persona.influences.films[0]}, ${persona.influences.music.genres[0]}, ${persona.influences.spaces[0]}.`,
    `\n${persona.summary}`,
  ];
  return parts.join("");
}

/**
 * Serialize OpenPencil document to JSON string (can be .pen or .json)
 */
export function serializeOpenPencil(doc: OpenPencilDocument): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Deserialize from JSON back to OpenPencil document
 */
export function deserializeOpenPencil(json: string): OpenPencilDocument {
  return JSON.parse(json) as OpenPencilDocument;
}

/**
 * Extract design tokens from an OpenPencil document
 */
export function extractTokensFromOpenPencil(doc: OpenPencilDocument): Partial<DesignTokens> {
  const tokens = doc.tokens;
  const colorMap: Record<string, string> = {};
  const fontMap: Record<string, string> = {};

  for (const t of tokens) {
    if (t.type === "color") {
      const key = t.name.replace("Color / ", "").toLowerCase().replace("text-muted", "textMuted");
      colorMap[key] = t.value;
    }
    if (t.type === "font") {
      const key = t.name.replace("Font / ", "").toLowerCase();
      fontMap[key] = t.value;
    }
  }

  // Return partial tokens that can be merged with defaults
  return {
    colors: {
      primary: colorMap.primary || "#000",
      secondary: colorMap.secondary || "#000",
      accent: colorMap.accent || "#000",
      background: colorMap.background || "#fff",
      surface: colorMap.surface || "#fff",
      text: colorMap.text || "#000",
      textMuted: colorMap["text-muted"] || "#666",
      border: colorMap.border || "#ccc",
      warm: colorMap.warm || "#c49",
      cool: colorMap.cool || "#49c",
      density: "rich" as any,
    },
    typography: {
      fontFamily: {
        heading: fontMap.heading || "system-ui",
        body: fontMap.body || "system-ui",
        mono: fontMap.mono || "monospace",
      },
      fontSize: { xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem", xl: "1.25rem", "2xl": "1.5rem", "3xl": "2rem", "4xl": "2.5rem" },
      fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
      lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
    },
  } as DesignTokens;
}

/**
 * Export a persona to OpenPencil `.pen` file
 */
export async function exportToOpenPencil(
  persona: Persona,
  outputPath: string
): Promise<{ path: string; document: OpenPencilDocument }> {
  const { writeFileSync } = await import("node:fs");
  const tokens = generateDesignTokens(persona);
  const doc = personaToOpenPencil(persona, tokens);
  writeFileSync(outputPath, serializeOpenPencil(doc));
  return { path: outputPath, document: doc };
}
