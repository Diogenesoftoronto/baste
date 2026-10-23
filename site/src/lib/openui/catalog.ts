import { z } from "zod/v4";
import { action, createLibrary, defineComponent, markReactive, type ToolSpec } from "@openuidev/lang-core";
import { DESIGN_COLOR_ROLES, DESIGN_EDGES } from "../project-contracts";

/**
 * Baste's OpenUI component and tool contract.
 *
 * One definition serves both sides: the Studio renders these names with Qwik
 * components (components/openui/), and the server builds the model prompt and
 * validates emitted surfaces from catalog.json, generated from this file by
 * `npm run openui:catalog`. Bump CATALOG_VERSION when a signature changes so
 * saved surfaces from an older catalog are replaced rather than misread.
 *
 * Renderers live outside lang-core, so `component` holds only the name.
 */
export const CATALOG_VERSION = 1;
export const ROOT = "Workbench";

/** Families the token engine can emit; kept in step with TOKEN_FONT_FAMILIES (checked by a server test). */
export const FONT_FAMILIES = [
  "Inter Tight", "Inter", "JetBrains Mono", "Bricolage Grotesque", "Instrument Sans", "Fira Code", "Space Mono",
  "IBM Plex Sans", "VT323", "Chakra Petch", "Fraunces", "Source Serif 4", "Dela Gothic One", "Monoton", "Archivo Black",
] as const;

/** A `$binding` prop: the component writes the value back to the named state. Marks a copy, so shared schemas stay plain. */
const bound = <T extends z.ZodType>(schema: T): T => { const copy = schema.clone(); markReactive(copy); return copy; };

const hex = z.string().describe("#rrggbb");
const font = z.enum(FONT_FAMILIES);
const edge = z.enum(DESIGN_EDGES);
const colors = z.object(Object.fromEntries(DESIGN_COLOR_ROLES.map((role) => [role, hex.optional()]))).describe("{background?, surface?, primary?, secondary?, accent?, text?, textMuted?, border?}");

const Note = defineComponent({
  name: "Note",
  props: z.object({ text: z.string(), tone: z.enum(["plain", "aside", "warning"]).optional() }),
  description: "A short observation in the partner's voice. Use aside for asides and warning for real usability problems.",
  component: "Note",
});

const Preview = defineComponent({
  name: "Preview",
  props: z.object({ colors, headingFont: font.optional(), bodyFont: font.optional(), edges: edge.optional(), caption: z.string().optional() }),
  description: "A live specimen screen in the saved design with these values laid over it. Pass $variables to follow the controls as they change.",
  component: "Preview",
});

const ColorField = defineComponent({
  name: "ColorField",
  props: z.object({ label: z.string(), value: bound(hex), hint: z.string().optional() }),
  description: "Colour picker bound to a $variable.",
  component: "ColorField",
});

const FontField = defineComponent({
  name: "FontField",
  props: z.object({ label: z.string(), value: bound(font), sample: z.string().optional() }),
  description: "Typeface picker bound to a $variable; each option is shown in its own face.",
  component: "FontField",
});

const EdgeField = defineComponent({
  name: "EdgeField",
  props: z.object({ label: z.string(), value: bound(edge) }),
  description: "Corner treatment picker bound to a $variable: sharp, soft, organic, geometric or brutalist.",
  component: "EdgeField",
});

const Option = defineComponent({
  name: "Option",
  props: z.object({ value: z.string(), label: z.string(), detail: z.string().optional() }),
  description: "One choice inside Choice.",
  component: "Option",
});

const Choice = defineComponent({
  name: "Choice",
  props: z.object({ label: z.string(), value: bound(z.string()), options: z.array(Option.ref) }),
  description: "A small set of mutually exclusive choices bound to a $variable.",
  component: "Choice",
});

const Swatch = defineComponent({
  name: "Swatch",
  props: z.object({ label: z.string(), color: hex }),
  description: "One named colour.",
  component: "Swatch",
});

const Palette = defineComponent({
  name: "Palette",
  props: z.object({ swatches: z.array(Swatch.ref), caption: z.string().optional() }),
  description: "A row of colours shown together.",
  component: "Palette",
});

const Contrast = defineComponent({
  name: "Contrast",
  props: z.object({ label: z.string(), foreground: hex, background: hex }),
  description: "Measured WCAG contrast between two colours. Pass $variables so it updates as colours change. Never state a ratio yourself.",
  component: "Contrast",
});

const Button = defineComponent({
  name: "Button",
  props: z.object({ label: z.string(), action: action().optional(), emphasis: z.enum(["primary", "secondary"]).optional() }),
  description: "Use primary only for the one action that saves.",
  component: "Button",
});

const Buttons = defineComponent({
  name: "Buttons",
  props: z.object({ buttons: z.array(Button.ref) }),
  description: "A row of buttons.",
  component: "Buttons",
});

const Variant = defineComponent({
  name: "Variant",
  props: z.object({
    name: z.string(), note: z.string(), colors,
    headingFont: font.optional(), bodyFont: font.optional(), edges: edge.optional(), action: action().optional(),
  }),
  description: "One treatment in a comparison. Its action usually @Sets the matching $variables so the person can try it.",
  component: "Variant",
});

const Compare = defineComponent({
  name: "Compare",
  props: z.object({ variants: z.array(Variant.ref), caption: z.string().optional() }),
  description: "Two to four treatments side by side.",
  component: "Compare",
});

const Question = defineComponent({
  name: "Question",
  props: z.object({ text: z.string(), answers: z.array(Button.ref) }),
  description: "Ask the person about a taste decision that changes the direction. Answers usually use @ToAssistant.",
  component: "Question",
});

const SaveStatus = defineComponent({
  name: "SaveStatus",
  props: z.object({ result: z.any(), idle: z.string().optional() }),
  description: "Shows a Mutation's progress and outcome. Pass the Mutation reference itself.",
  component: "SaveStatus",
});

const Section = defineComponent({
  name: "Section",
  props: z.object({ title: z.string(), children: z.array(z.union([Note.ref, ColorField.ref, FontField.ref, EdgeField.ref, Choice.ref, Palette.ref, Contrast.ref, Buttons.ref, SaveStatus.ref])) }),
  description: "A titled group of controls.",
  component: "Section",
});

const Block = z.union([
  Note.ref, Preview.ref, Section.ref, ColorField.ref, FontField.ref, EdgeField.ref, Choice.ref,
  Palette.ref, Contrast.ref, Compare.ref, Question.ref, Buttons.ref, SaveStatus.ref,
]);

const Workbench = defineComponent({
  name: ROOT,
  props: z.object({ title: z.string(), children: z.array(Block) }),
  description: "The surface itself.",
  component: ROOT,
});

export const library = createLibrary({
  id: "baste-workbench",
  root: ROOT,
  components: [Workbench, Section, Note, Preview, ColorField, FontField, EdgeField, Choice, Option, Palette, Swatch, Contrast, Compare, Variant, Question, Buttons, Button, SaveStatus],
  componentGroups: [
    { name: "Looking", components: ["Preview", "Compare", "Variant", "Palette", "Swatch", "Contrast"] },
    { name: "Adjusting", components: ["Section", "ColorField", "FontField", "EdgeField", "Choice", "Option"] },
    { name: "Deciding", components: ["Note", "Question", "Buttons", "Button", "SaveStatus"] },
  ],
});

const colorChanges = Object.fromEntries(DESIGN_COLOR_ROLES.map((role) => [role, { type: ["string", "null"], pattern: "^#[0-9a-fA-F]{6}$" }]));

/** Read tools may run as Query(); write tools only as Mutation() after a click. */
export const READ_TOOLS = ["read_design"] as const;
export const WRITE_TOOLS = ["update_design"] as const;

export const tools: ToolSpec[] = [
  {
    name: "read_design",
    description: "The project's saved design: revision, the eight colour roles, heading and body typefaces, edge treatment, and which values differ from the audience's generated design.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "object",
      properties: {
        revision: { type: "number" },
        colors: { type: "object", properties: Object.fromEntries(DESIGN_COLOR_ROLES.map((role) => [role, { type: "string" }])) },
        headingFont: { type: "string" }, bodyFont: { type: "string" }, edges: { type: "string", enum: [...DESIGN_EDGES] },
        adjusted: { type: "array", items: { type: "string" } },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "update_design",
    description: "Save design changes as a new project revision. Send only the values that change; null returns a value to the audience's generated design. summary is a few words for the project history.",
    inputSchema: {
      type: "object",
      properties: {
        changes: {
          type: "object",
          properties: {
            colors: { type: "object", properties: colorChanges, additionalProperties: false },
            headingFont: { type: ["string", "null"], enum: [...FONT_FAMILIES, null] },
            bodyFont: { type: ["string", "null"], enum: [...FONT_FAMILIES, null] },
            edges: { type: ["string", "null"], enum: [...DESIGN_EDGES, null] },
          },
          additionalProperties: false,
        },
        summary: { type: "string", maxLength: 160 },
      },
      required: ["changes", "summary"],
      additionalProperties: false,
    },
    outputSchema: { type: "object", properties: { revision: { type: "number" }, summary: { type: "string" } } },
    annotations: { destructiveHint: false },
  },
];

/** The serialisable contract the server reads. */
export function catalogContract() {
  return { version: CATALOG_VERSION, root: ROOT, spec: library.toSpec(), schema: library.toJSONSchema(), tools, readTools: [...READ_TOOLS], writeTools: [...WRITE_TOOLS] };
}
