// Shared frame of the API routes (stations 1–3 and the error answers, X-08): every route handler under
// src/app/api/ (except Better Auth's own) runs inside api(). It checks the origin of writes, reads the session,
// and turns access, validation and database errors into one structured answer with a request ID – never a stack
// trace or a query.
import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { AccessError, RuleError, type Viewer } from "./access";
import { readBodyUpTo } from "./body-limit";
import { DrizzleQueryError } from "drizzle-orm";
import { describeDatabaseError, isDatabaseError } from "./db/errors";
import { idParam, zodProblems, type FieldProblem } from "./validation/common";
import { getViewer } from "./viewer";

/** Answers depend on the login → neither browser nor proxy may cache them. */
const PRIVATE = { "Cache-Control": "private, no-store" };
const DEFAULT_MAX_BYTES = 64 * 1024;

/** Malformed request (HTTP 400): unreadable JSON, wrong types, unknown id format. */
export class BadRequest extends Error {
  constructor(readonly fields: FieldProblem[] = []) {
    super("INVALID_REQUEST");
    this.name = "BadRequest";
  }
}

type Context = { viewer: Viewer; request: Request; requestId: string };

/** Validated query string of a GET request. */
export function readQuery<T extends z.ZodType>(request: Request, schema: T): z.infer<T> {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new BadRequest(zodProblems(parsed.error));
  return parsed.data;
}

/** Validated JSON body; larger than `maxBytes` or not JSON → HTTP 400 / 413 without reading further. */
export async function readJson<T extends z.ZodType>(request: Request, schema: T, maxBytes = DEFAULT_MAX_BYTES): Promise<z.infer<T>> {
  const limited = await readBodyUpTo(request, maxBytes);
  if (!limited) throw new PayloadTooLarge();
  let body: unknown;
  try {
    const text = await limited.text();
    body = text === "" ? {} : JSON.parse(text);
  } catch {
    throw new BadRequest();
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequest(zodProblems(parsed.error));
  return parsed.data;
}

class PayloadTooLarge extends Error {}

/** Numeric id from a dynamic segment (`/api/offers/[id]`); anything else is answered like an unknown record. */
export async function readId(params: Promise<Record<string, string>>, name = "id"): Promise<number> {
  const parsed = idParam.safeParse((await params)[name]);
  if (!parsed.success) throw new AccessError("NOT_FOUND");
  return parsed.data;
}

/**
 * Writes must come from the app's own pages: the Origin header has to match BETTER_AUTH_URL and the body has to
 * be JSON. A form on another website can send neither (defence in depth next to the SameSite session cookie).
 */
function writeProblem(request: Request, external: boolean): string | null {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return "JSON_REQUIRED";
  // a provider calls from its own servers: no Origin, no session – its signature is checked by the route instead
  if (external) return null;
  const origin = request.headers.get("origin");
  const own = URL.canParse(process.env.BETTER_AUTH_URL ?? "") ? new URL(process.env.BETTER_AUTH_URL!).origin : null;
  return !origin || !own || origin !== own ? "ORIGIN_NOT_ALLOWED" : null;
}

/** Network errors of the database connection that do not come wrapped in a failed query (e.g. opening a transaction). */
const CONNECTION_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EPIPE", "57P01", "57P03", "53300"]);

/** PostgreSQL error code (or Node network code) of a failed query; null when the error is not a database error. */
function databaseCode(error: unknown): string | null {
  if (!isDatabaseError(error)) {
    for (let current: unknown = error; current instanceof Error; current = current.cause) {
      if ("code" in current && typeof current.code === "string" && CONNECTION_CODES.has(current.code)) return current.code;
      if (/timeout exceeded when trying to connect|Connection terminated/i.test(current.message)) return "ETIMEDOUT";
    }
    return null;
  }
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (!(current instanceof DrizzleQueryError) && "code" in current && typeof current.code === "string") return current.code;
  }
  return "UNKNOWN";
}

function fail(status: number, error: string, requestId: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, requestId, ...extra }, { status, headers: PRIVATE });
}

/**
 * Runs one route: `run` gets the viewer and returns the JSON answer (or a ready Response).
 * `anonymous: true` skips the session lookup for public data. `external: true` (implies anonymous) is for a
 * server-to-server call such as a provider confirmation: no origin check, the route verifies a signature itself.
 */
export async function api(
  request: Request,
  name: string,
  run: (context: Context) => Promise<unknown>,
  options: { anonymous?: boolean; external?: boolean } = {},
): Promise<Response> {
  const requestId = randomUUID().slice(0, 13);
  try {
    const problem = writeProblem(request, options.external === true);
    if (problem) return fail(problem === "JSON_REQUIRED" ? 415 : 403, problem, requestId);
    const viewer: Viewer = options.anonymous || options.external ? { role: "guest" } : await getViewer(request.headers);
    const result = await run({ viewer, request, requestId });
    return result instanceof Response ? result : NextResponse.json(result, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof AccessError) return fail(error.status, error.code, requestId, error.details);
    if (error instanceof RuleError) return fail(422, "VALIDATION", requestId, { fields: error.fields });
    if (error instanceof BadRequest) return fail(400, "INVALID_REQUEST", requestId, { fields: error.fields });
    if (error instanceof PayloadTooLarge) return fail(413, "PAYLOAD_TOO_LARGE", requestId);
    const code = databaseCode(error);
    if (code === null) throw error; // a programming error stays a 500 with its stack trace in the server log
    // Only the summary: the error object carries query and parameters (session token, user input).
    console.error(`[${requestId}] ${name}:`, isDatabaseError(error) ? describeDatabaseError(error) : `database connection failed [${code}]`);
    // 23… = a constraint refused the row: a duplicate is a conflict, anything else invalid data.
    if (code === "23505") return fail(409, "CONFLICT", requestId);
    if (code.startsWith("23") || code.startsWith("22")) return fail(422, "VALIDATION", requestId, { fields: [] });
    return fail(503, "DATABASE_UNAVAILABLE", requestId);
  }
}
