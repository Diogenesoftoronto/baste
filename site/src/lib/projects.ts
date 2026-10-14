import type { CreateProjectRequest, ProjectCommand, ProjectDetail, ProjectSummary } from "./project-contracts";

export { PROJECT_LIMITS } from "./project-contracts";
export type { CreateProjectRequest, DesignProject, ProjectCommand, ProjectDetail, ProjectSummary } from "./project-contracts";

export class ProjectRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ProjectRequestError";
  }
}

async function request<T>(base: string, path: string, options: { body?: unknown; csrfToken?: string; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(`${base.replace(/\/+$/, "")}/projects${path}`, {
    method: options.body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
    ...(options.body === undefined ? {} : {
      headers: { "Content-Type": "application/json", "X-Baste-CSRF": options.csrfToken ?? "" },
      body: JSON.stringify(options.body),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : data?.error?.message;
    throw new ProjectRequestError(message || `The project could not be loaded (${response.status}).`, response.status);
  }
  if (data === null || typeof data !== "object") throw new Error("The project server returned an invalid response.");
  return data as T;
}

export const listProjects = (base: string, signal?: AbortSignal) => request<ProjectSummary[]>(base, "", { signal });
export const getProject = (base: string, id: string, signal?: AbortSignal) => request<ProjectDetail>(base, `/${encodeURIComponent(id)}`, { signal });
export const createProject = (base: string, body: CreateProjectRequest, csrfToken?: string) => request<ProjectDetail>(base, "", { body, csrfToken });
export const runProjectCommand = (base: string, id: string, body: ProjectCommand, csrfToken?: string) => request<ProjectDetail>(base, `/${encodeURIComponent(id)}/commands`, { body, csrfToken });
