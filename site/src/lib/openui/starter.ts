import type { DesignColorRole, DesignEdge } from "../project-contracts";

/** The saved design as the `read_design` tool returns it. */
export interface DesignReading {
  revision: number;
  colors: Record<DesignColorRole, string>;
  headingFont: string;
  bodyFont: string;
  edges: DesignEdge;
  /** Which values differ from the audience's generated design. */
  adjusted: string[];
}

const str = (value: string) => JSON.stringify(value);

/**
 * Baste's own surface, written in the same OpenUI Lang the partner writes.
 * It needs no model and is the fallback whenever a generated surface is
 * unavailable or invalid.
 */
export function starterProgram(design: DesignReading): string {
  const c = design.colors;
  return [
    `root = Workbench("The saved design", [preview, colour, type, check, saving])`,
    `$background = ${str(c.background)}`,
    `$surface = ${str(c.surface)}`,
    `$primary = ${str(c.primary)}`,
    `$accent = ${str(c.accent)}`,
    `$text = ${str(c.text)}`,
    `$heading = ${str(design.headingFont)}`,
    `$body = ${str(design.bodyFont)}`,
    `$edges = ${str(design.edges)}`,
    `preview = Preview({background: $background, surface: $surface, primary: $primary, accent: $accent, text: $text}, $heading, $body, $edges, "Changes show here before you save them.")`,
    `colour = Section("Colour", [ColorField("Ground", $background), ColorField("Surface", $surface), ColorField("Main", $primary), ColorField("Accent", $accent), ColorField("Ink", $text)])`,
    `type = Section("Type and edges", [FontField("Headings", $heading), FontField("Body", $body), EdgeField("Corners", $edges)])`,
    `check = Section("Legibility", [Contrast("Ink on ground", $text, $background), Contrast("Ink on surface", $text, $surface)])`,
    `save = Mutation("update_design", {changes: {colors: {background: $background, surface: $surface, primary: $primary, accent: $accent, text: $text}, headingFont: $heading, bodyFont: $body, edges: $edges}, summary: "Adjusted in the workbench"})`,
    `saving = Section("Save", [Buttons([Button("Save as a new version", Action([@Run(save)]), "primary"), Button("Undo unsaved changes", Action([@Reset($background, $surface, $primary, $accent, $text, $heading, $body, $edges)]))]), SaveStatus(save, "Nothing is saved until you choose to.")])`,
  ].join("\n");
}
