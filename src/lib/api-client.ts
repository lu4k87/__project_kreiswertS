// Calls the app's own /api/* routes from client components: JSON in, JSON out, the session cookie is sent
// automatically (same origin). Never throws – every failure comes back as `{ ok: false, error }` so a form can
// leave its "busy" state and show a sentence.
import type { PlatformMessages } from "@/i18n/platform";

export type FieldProblem = { field: string; code: string };
export type ApiFailure = { code: string; status: number; fields: FieldProblem[]; reason?: string; currentRevision?: number };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

export async function apiRequest<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: method === "GET" ? undefined : { "content-type": "application/json" },
      // POST/PUT/DELETE always carry a JSON body: the server refuses writes that a cross-site form could send
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, error: { code: "DATABASE_UNAVAILABLE", status: 503, fields: [] } };
  }
  let json: Record<string, unknown> | null = null;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    // an empty or non-JSON answer (e.g. a 500 page) is handled below
  }
  if (response.ok && json) return { ok: true, data: json as T };
  return {
    ok: false,
    error: {
      code: typeof json?.error === "string" ? json.error : "fallback",
      status: response.status,
      fields: Array.isArray(json?.fields) ? (json.fields as FieldProblem[]) : [],
      reason: typeof json?.reason === "string" ? json.reason : undefined,
      currentRevision: typeof json?.currentRevision === "number" ? json.currentRevision : undefined,
    },
  };
}

/** Sentence for a failed request: the specific reason of a conflict first, then the code, then a general text. */
export function apiErrorText(error: ApiFailure, t: PlatformMessages["errors"]): string {
  return (error.reason && t.api[error.reason]) || t.api[error.code] || t.api.fallback;
}

/** Sentence for one field problem. */
export function fieldErrorText(code: string, t: PlatformMessages["errors"]): string {
  return t.fields[code] ?? t.fields.INVALID;
}

/** First problem per field, as a lookup for the inputs. */
export function problemsByField(problems: FieldProblem[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const problem of problems) map[problem.field] ??= problem.code;
  return map;
}
