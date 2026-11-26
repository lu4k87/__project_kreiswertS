// Shared building blocks of the Zod schemas (station 3). Only zod is imported → usable in the browser too.
import { z } from "zod";

/**
 * Single-line text: no control characters (NUL makes PostgreSQL reject the query), no line or paragraph separators and
 * no invisible format characters at all (Unicode category Cf: zero-width spaces and joiners, direction marks and
 * overrides, soft hyphen, byte order mark, tag characters). Two names must never look alike while being different.
 */
export const SINGLE_LINE = /^[^\p{Cc}\p{Cf}\u2028\u2029]*$/u;
/** Multi-line text: as above, but tab and line breaks are allowed. */
export const MULTI_LINE = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\p{Cf}\u2028\u2029]*$/u;
/** At least one letter or digit – neither empty nor only punctuation. */
export const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const line = (max: number) => z.string().trim().max(max).regex(SINGLE_LINE);
export const paragraph = (max: number) => z.string().trim().max(max).regex(MULTI_LINE);

/** Empty string, undefined and null all mean "not given" → null. */
export const nullable = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());

/** Query parameter: an empty field (`?city=`, e.g. from a GET form) counts as not given, not as invalid. */
export const optionalParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

/** Positive whole number from a URL segment or query string. */
export const idParam = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Decimal number from a JSON body, rounded to `decimals` places (quantities 3, prices 2). */
export const decimal = (decimals: number, max = 1e9) =>
  z
    .number()
    .min(0)
    .max(max)
    .transform((value) => Math.round(value * 10 ** decimals) / 10 ** decimals);

export const isoDate = z.iso.date();

export type FieldProblem = { field: string; code: string };

/** Zod issues as field problems: the path joined with dots and one code the UI translates. */
export function zodProblems(error: z.ZodError): FieldProblem[] {
  return error.issues.map((issue) => ({ field: issue.path.join(".") || "body", code: "INVALID" }));
}
