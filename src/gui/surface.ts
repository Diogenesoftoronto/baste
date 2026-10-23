import { createParser, generateSystemPrompt, mergeStatements, type LibraryJSONSchema, type PromptSpec, type ToolSpec } from "@openuidev/lang-core";
import catalog from "../../site/src/lib/openui/catalog.json" with { type: "json" };
import type { DesignProject } from "../projects/contracts.js";
import type { DesignReading } from "../projects/design.js";
import { AccountError } from "../notorganic/server.js";

/**
 * Generated design surfaces.
 *
 * The partner answers in prose and, when a change helps, an OpenUI Lang patch
 * written against Baste's catalog (site/src/lib/openui/catalog.ts). The
 * server merges the patch into the current surface and validates the result
 * before the Studio keeps it; an invalid surface gets one repair attempt and
 * is otherwise discarded, leaving the current one in place. Generated
 * controls only stage values: saving still requires the person to press a
 * button that runs the update_design mutation.
 */

const contract = catalog as unknown as {
  version: number; root: string; spec: PromptSpec; schema: LibraryJSONSchema;
  tools: ToolSpec[]; readTools: string[]; writeTools: string[];
};

export const SURFACE_LIMITS = { message: 600, program: 16000, turns: 12, turnText: 1200, stateKeys: 40, context: 2000 } as const;

export interface SurfaceTurn { from: "you" | "partner"; text: string }

export interface SurfaceRequest {
  message: string;
  program: string;
  turns: SurfaceTurn[];
  /** `$variables` as the person has left them, which may differ from the saved design. */
  state: Record<string, string | number | boolean | null>;
  /** Hidden context from an @ToAssistant step. */
  context?: string;
}

export type SurfaceEvent =
  | { type: "delta"; text: string }
  | { type: "done"; reply: string; program: string | null; issues: string[] }
  | { type: "error"; message: string };

export function surfaceAvailable(accountMode: boolean): boolean {
  return !accountMode && Boolean(process.env.OPENAI_API_KEY);
}

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function readSurfaceRequest(body: unknown): SurfaceRequest {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const message = text(input.message, SURFACE_LIMITS.message);
  if (!message) throw new AccountError(400, "Write what you would like to change.");
  if (typeof input.program === "string" && input.program.length > SURFACE_LIMITS.program) throw new AccountError(413, "This surface is too large to revise. Start over from the saved design.");
  const turns = (Array.isArray(input.turns) ? input.turns : [])
    .filter((turn): turn is SurfaceTurn => !!turn && typeof turn === "object" && ((turn as SurfaceTurn).from === "you" || (turn as SurfaceTurn).from === "partner"))
    .slice(-SURFACE_LIMITS.turns)
    .map((turn) => ({ from: turn.from, text: text(turn.text, SURFACE_LIMITS.turnText) }))
    .filter((turn) => turn.text);
  const state: SurfaceRequest["state"] = {};
  if (input.state && typeof input.state === "object" && !Array.isArray(input.state)) {
    for (const [key, value] of Object.entries(input.state).slice(0, SURFACE_LIMITS.stateKeys)) {
      if (!/^\$[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(key)) continue;
      if (value === null || typeof value === "number" || typeof value === "boolean") state[key] = value;
      else if (typeof value === "string") state[key] = value.slice(0, 200);
    }
  }
  const context = input.context === undefined ? undefined : JSON.stringify(input.context)?.slice(0, SURFACE_LIMITS.context);
  return { message, program: typeof input.program === "string" ? input.program : "", turns, state, ...(context ? { context } : {}) };
}

/** Split a reply into its prose and the OpenUI Lang inside its fences. */
export function splitReply(reply: string): { prose: string; patch: string } {
  const code: string[] = [];
  const prose = reply.replace(/```(?:openui-lang|openui)?[^\n]*\n([\s\S]*?)(?:```|$)/g, (_, body: string) => { code.push(body); return ""; });
  return { prose: prose.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim(), patch: code.join("\n").trim() };
}

const toolName = (ast: unknown) => ast && typeof ast === "object" && (ast as { k?: string }).k === "Str" ? (ast as { v: string }).v : null;

/** Problems that keep a program from being shown, in words a model can act on. */
export function validateProgram(program: string): string[] {
  const result = createParser(contract.schema, contract.root).parse(program);
  const issues = result.meta.errors.map((error) => error.message);
  if (!result.root) issues.push(`The program needs root = ${contract.root}(...).`);
  for (const query of result.queryStatements) {
    if (!contract.readTools.includes(toolName(query.toolAST) ?? "")) issues.push(`Query ${query.statementId} must use one of: ${contract.readTools.join(", ")}.`);
  }
  for (const mutation of result.mutationStatements) {
    if (!contract.writeTools.includes(toolName(mutation.toolAST) ?? "")) issues.push(`Mutation ${mutation.statementId} must use one of: ${contract.writeTools.join(", ")}.`);
  }
  return [...new Set(issues)].slice(0, 12);
}

function describeDesign(design: DesignReading): string {
  return [
    `Saved design, project version ${design.revision}:`,
    ...Object.entries(design.colors).map(([role, value]) => `- ${role}: ${value}`),
    `- heading typeface: ${design.headingFont}`,
    `- body typeface: ${design.bodyFont}`,
    `- edges: ${design.edges}`,
    design.adjusted.length ? `Adjusted from the audience's generated design: ${design.adjusted.join(", ")}.` : "Nothing has been adjusted from the audience's generated design yet.",
  ].join("\n");
}

export function surfaceSystemPrompt(project: DesignProject, design: DesignReading): string {
  const a = project.audience!;
  const i = a.influences;
  const preamble = [
    `You are Baste's design partner for the project "${project.name}". You work with a designer on the project's interface design, showing and adjusting it through a small interactive surface.`,
    `Brief:\n${project.brief.slice(0, 2400)}`,
    `The audience is "${a.name}", an authored persona rather than research about real people: ${a.summary}`,
    `Their world: ${[...a.culture.subcultures, ...i.spaces, ...i.obsessions].slice(0, 10).join(", ")}. Films and music: ${[...i.films, ...i.anime, ...i.music.artists].slice(0, 8).join(", ")}.`,
    `What they value in interfaces: ${a.behaviors.interfaceValues.slice(0, 5).join("; ")}. What annoys them: ${a.behaviors.petPeeves.slice(0, 5).join("; ")}.`,
    `Aesthetic: ${a.aesthetic.colorTemperature} colour, ${a.aesthetic.density} density, ${a.aesthetic.edgeStyle} edges, ${a.aesthetic.typographyStyle} type, ${a.aesthetic.moodKeywords.slice(0, 5).join(", ")}.`,
    describeDesign(design),
  ].join("\n\n");
  return generateSystemPrompt({
    library: contract.spec,
    promptOptions: {
      preamble,
      inlineMode: true,
      editMode: true,
      tools: contract.tools,
      toolCalls: true,
      bindings: true,
      additionalRules: [
        "Write one to three short sentences of plain prose in your own voice, specific to this audience's world, explaining what you show or suggest. Put any surface change in one ```openui-lang fence.",
        "You cannot call tools while answering. Write Query() and Mutation() statements in the surface; the person's browser runs them.",
        "Declare each colour, typeface and edge treatment you let the person adjust as a $variable whose default is the saved value, then bind it to a field and to Preview so changes are visible before saving.",
        "Saving is the person's decision. Only a Button they press may @Run a Mutation(\"update_design\", ...), and the button must say that it saves. Never claim a change is saved. Show the result with SaveStatus(mutationRef).",
        "Include only the values the person can change in update_design's changes. Use exact #rrggbb colours and only the listed typefaces.",
        "Each Variant passes every value it changes (arguments are positional: name, note, colors, headingFont, bodyFont, edges, action) and an action that @Sets the $variables bound to the matching fields, so the person can try it in the Preview.",
        "Use Contrast for legibility claims; never state a contrast ratio yourself.",
        "Use Question when a real taste decision would change direction, with answers that use @ToAssistant.",
        "Keep the surface focused: usually one Preview and two to five other blocks. Remove blocks that no longer help.",
        "Do not use @OpenUrl.",
      ],
    },
  });
}

function userMessage(request: SurfaceRequest): string {
  const parts = [request.program ? `Current surface:\n\`\`\`openui-lang\n${request.program}\n\`\`\`` : "There is no surface yet. Write a complete program."];
  if (Object.keys(request.state).length) parts.push(`Unsaved values on the surface: ${JSON.stringify(request.state)}`);
  if (request.context) parts.push(`Context from the surface: ${request.context}`);
  parts.push(`Request: ${request.message}`);
  return parts.join("\n\n");
}

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

async function* completion(messages: ChatMessage[], model: string, signal: AbortSignal): AsyncGenerator<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.6, max_completion_tokens: 2400 }),
    signal,
  });
  if (!response.ok || !response.body) throw new AccountError(502, "The design partner did not answer.");
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch { /* a keep-alive or partial line */ }
    }
  }
}

async function collect(messages: ChatMessage[], model: string, signal: AbortSignal): Promise<string> {
  let out = "";
  for await (const delta of completion(messages, model, signal)) out += delta;
  return out;
}

/**
 * Ask the partner for a reply and a surface patch, streaming its words as
 * they arrive and ending with the validated, merged program (or null).
 */
export async function* streamSurface(project: DesignProject, design: DesignReading, request: SurfaceRequest, model: string, signal: AbortSignal): AsyncGenerator<SurfaceEvent> {
  const messages: ChatMessage[] = [
    { role: "system", content: surfaceSystemPrompt(project, design) },
    ...request.turns.map((turn): ChatMessage => ({ role: turn.from === "you" ? "user" : "assistant", content: turn.text })),
    { role: "user", content: userMessage(request) },
  ];
  let reply = "";
  try {
    for await (const delta of completion(messages, model, signal)) {
      reply += delta;
      yield { type: "delta", text: delta };
    }
  } catch (error) {
    if (signal.aborted) return;
    yield { type: "error", message: error instanceof AccountError ? error.message : "The design partner did not answer." };
    return;
  }
  const { prose, patch } = splitReply(reply);
  if (!patch) {
    yield { type: "done", reply: prose || "I don't have a change to suggest for that.", program: null, issues: [] };
    return;
  }
  let program = request.program ? mergeStatements(request.program, patch, "root") : patch;
  let issues = validateProgram(program);
  if (issues.length) {
    // One repair: the model sees exactly what failed and patches only that.
    try {
      const repair = await collect([...messages, { role: "assistant", content: reply }, {
        role: "user",
        content: `That surface could not be shown:\n- ${issues.join("\n- ")}\nReply with only a corrected openui-lang patch in one fence.`,
      }], model, signal);
      const fixed = splitReply(repair).patch;
      if (fixed) {
        const candidate = mergeStatements(program, fixed, "root");
        const remaining = validateProgram(candidate);
        if (!remaining.length) { program = candidate; issues = []; }
        else issues = remaining;
      }
    } catch {
      if (signal.aborted) return;
    }
  }
  yield { type: "done", reply: prose || "Here is a revised surface.", program: issues.length ? null : program, issues };
}

export const CATALOG_VERSION = contract.version;
