import { mergeStatements } from "@openuidev/lang-core";
import { ProjectRequestError } from "../projects";

/**
 * The Studio side of POST /api/projects/:id/surface (src/gui/surface.ts).
 * Replies stream as newline-delimited JSON; the final event carries the
 * server-validated program, or null when the partner's surface was rejected.
 */

export interface PartnerTurn { from: "you" | "partner"; text: string }

export type SurfaceEvent =
  | { type: "delta"; text: string }
  | { type: "done"; reply: string; program: string | null; issues: string[] }
  | { type: "error"; message: string };

export interface SurfaceRequest {
  message: string;
  program: string;
  turns: PartnerTurn[];
  state: Record<string, unknown>;
  context?: unknown;
}

/** Prose and fenced OpenUI Lang, tolerating a fence that is still open. Mirrors splitReply on the server. */
export function splitReply(reply: string): { prose: string; patch: string } {
  const code: string[] = [];
  const prose = reply.replace(/```(?:openui-lang|openui)?[^\n]*\n([\s\S]*?)(?:```|$)/g, (_, body: string) => { code.push(body); return ""; });
  // Hide a fence opener that has not reached its newline yet.
  return { prose: prose.replace(/```[^\n]*$/, "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim(), patch: code.join("\n").trim() };
}

/** What to show while a patch streams: the current surface with the partial patch merged in. */
export function draftProgram(current: string, reply: string): string | null {
  const { patch } = splitReply(reply);
  if (!patch) return null;
  try { return current ? mergeStatements(current, patch, "root") : patch; }
  catch { return null; }
}

export async function* requestSurface(base: string, projectId: string, body: SurfaceRequest, csrfToken: string | undefined, signal: AbortSignal): AsyncGenerator<SurfaceEvent> {
  const response = await fetch(`${base.replace(/\/+$/, "")}/projects/${encodeURIComponent(projectId)}/surface`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Baste-CSRF": csrfToken ?? "" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new ProjectRequestError(typeof data?.error === "string" ? data.error : `The design partner did not answer (${response.status}).`, response.status);
  }
  yield* readEvents(response.body, signal);
}

export async function* readEvents(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SurfaceEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  try {
    while (!signal?.aborted) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: SurfaceEvent;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === "done" || event.type === "error") finished = true;
        yield event;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!finished && !signal?.aborted) yield { type: "error", message: "The reply was cut off. Try again." };
}
