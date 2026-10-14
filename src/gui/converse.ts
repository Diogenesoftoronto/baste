/**
 * Talking with a persona: a model-backed voice for the site's conversation.
 *
 * The site carries an authored, offline voice for every base persona
 * (site/src/lib/converse.ts). When this server runs locally with an OpenAI
 * key, the same persona can answer open questions instead. Hosted accounts
 * never reach this path: an anonymous visitor's chat must not spend the
 * operator's key, so the site keeps its offline voice there.
 */
import type { Persona } from "../persona/types.js";
import type { DesignTokens } from "../assets/design-system.js";
import { AccountError } from "../notorganic/server.js";

export interface ConverseTurn {
  from: "them" | "you";
  text: string;
}

const MAX_TURNS = 16;
const MAX_TEXT = 600;

export function converseAvailable(accountMode: boolean): boolean {
  return !accountMode && Boolean(process.env.OPENAI_API_KEY);
}

export function readTurns(body: Record<string, unknown>): ConverseTurn[] {
  const raw = Array.isArray(body.turns) ? body.turns : [];
  const turns = raw
    .filter((t): t is ConverseTurn => !!t && typeof t === "object" && (t.from === "them" || t.from === "you") && typeof t.text === "string")
    .slice(-MAX_TURNS)
    .map((t) => ({ from: t.from, text: t.text.trim().slice(0, MAX_TEXT) }))
    .filter((t) => t.text.length > 0);
  if (!turns.length || turns[turns.length - 1].from !== "you") throw new AccountError(400, "Send the conversation ending with your message.");
  return turns;
}

function systemPrompt(p: Persona, t: DesignTokens, handle: string): string {
  const i = p.influences;
  return [
    `You are ${handle}, the persona "${p.name}" from Baste, a tool that generates interface design from a persona's cultural influences.`,
    `Who you are: ${p.summary}`,
    `Films: ${i.films.join(", ")}. Anime: ${i.anime.join(", ")}. Music: ${i.music.genres.join(", ")}; ${i.music.artists.join(", ")}. Games: ${i.games.join(", ")}. Spaces: ${i.spaces.join(", ")}. Obsessions: ${i.obsessions.join(", ")}.`,
    `You value ${p.behaviors.interfaceValues.join(", ")}. You can't stand ${p.behaviors.petPeeves.join(", ")}.`,
    `Your aesthetic: ${Object.entries(p.aesthetic).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join("/") : v}`).join("; ")}.`,
    `Your generated design tokens: background ${t.colors.background}, surface ${t.colors.surface}, primary ${t.colors.primary}, secondary ${t.colors.secondary}, accent ${t.colors.accent}, text ${t.colors.text}; heading font ${t.typography.fontFamily.heading}, body font ${t.typography.fontFamily.body}; base radius ${t.borders.radius.base}; base motion ${t.motion.duration.base}.`,
    "How Baste made you: measure the persona; draft a prompt per asset type; quality-diversity evolution over 5–10 generations across colour temperature, visual density and abstractness, keeping the best candidate in each region; an LLM judge scores persona alignment 30%, visual quality 20%, uniqueness 20%, coherence 15%, usability 15%; a diverse final set becomes SVG icons, images, video loops, tokens (CSS, Tailwind, Panda, JSON) and a suite manifest. Visitors can make their own persona in the Studio, extend one, remix two, or decompose a website.",
    "Speak in the first person, in your own voice, like texting a curious stranger. Explain your taste and why your interface looks the way it does, with concrete references. You are a persona, an authored character, not a real person or user research; say so if asked. Don't invent features Baste doesn't have.",
    "Use everyday colour names and explain the feeling behind a design decision. Give hex codes, pixel measurements or implementation details only when asked. For deeper technical details, point to the Method page at /method/.",
    'Reply with JSON only: {"bubbles": ["...", "..."]} — two or three short messages, each under 220 characters.',
  ].join("\n");
}

export async function converse(p: Persona, t: DesignTokens, handle: string, turns: ConverseTurn[], model: string): Promise<string[]> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_completion_tokens: 500,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(p, t, handle) },
        ...turns.map((turn) => ({ role: turn.from === "you" ? "user" : "assistant", content: turn.text })),
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new AccountError(502, "The persona's model did not answer.");
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let bubbles: unknown;
  try { bubbles = JSON.parse(data.choices?.[0]?.message?.content ?? "{}").bubbles; }
  catch { bubbles = undefined; }
  const out = Array.isArray(bubbles) ? bubbles.filter((b): b is string => typeof b === "string" && b.trim().length > 0).slice(0, 4) : [];
  if (!out.length) throw new AccountError(502, "The persona's model did not answer.");
  return out.map((b) => b.trim().slice(0, 400));
}
