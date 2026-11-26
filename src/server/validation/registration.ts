// Station 3 – sign-up validation (POST /api/auth/sign-up/email).
// Runs on the server in the Better Auth hook (src/server/auth.ts); the browser only pre-checks for convenience.
// Also loaded in the browser (register-form.tsx) → import only zod here, never DB or server modules.
import { z } from "zod";

/** Material-Interesse: feste Liste, Texte DE/EN in src/i18n/messages.ts (register.materials). */
export const MATERIAL_INTERESTS = ["plastics", "metals", "paper", "glass", "textiles", "food", "pharma", "other"] as const;
export type MaterialInterest = (typeof MATERIAL_INTERESTS)[number];

/** Error codes the browser translates via authErrorText() (src/lib/auth-errors.ts). */
export const REGISTRATION_ERROR = {
  companyName: "INVALID_COMPANY_NAME",
  vatId: "INVALID_VAT_ID",
  materialInterest: "INVALID_MATERIAL_INTEREST",
  username: "INVALID_USERNAME",
  name: "INVALID_NAME",
  image: "IMAGE_NOT_ALLOWED",
  email: "INVALID_EMAIL",
  password: "PASSWORD_TOO_WEAK",
} as const;

/**
 * No control characters (e.g. NUL: PostgreSQL rejects it → otherwise HTTP 500 instead of 400) and no invisible separator
 * and direction characters (line separators, zero-width spaces, writing-direction overrides) – they deceive in the display.
 */
const NO_CONTROL_CHARACTERS = /^[^\p{Cc}\u2028\u2029\u200B\u202A-\u202E\u2060\u2066-\u2069]*$/u;
/** At least one letter or digit – so neither empty nor only spaces or punctuation. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const companyNameSchema = z.string().trim().min(2).max(200).regex(HAS_LETTER_OR_DIGIT).regex(NO_CONTROL_CHARACTERS);

/** EU VAT ID: country code + 2–12 characters; spaces, dots and hyphens are removed (DE 294 681 207 → DE294681207). */
export const vatIdSchema = z
  .string()
  .transform((value) => value.replace(/[\s.-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9+*]{2,12}$/));

export const materialInterestSchema = z.enum(MATERIAL_INTERESTS);

/** Username is required (the Better Auth plugin only checks the format when one is sent): 3–30 characters from a–z, 0–9, _ and . */
export const usernameSchema = z.string().min(3).max(30).regex(/^[A-Za-z0-9_.]+$/);

/**
 * Display name (Better Auth requires it, the form sends the username): at most 100 characters, at least one
 * letter or digit, no control or invisible characters.
 */
export const nameSchema = z.string().max(100).regex(HAS_LETTER_OR_DIGIT).regex(NO_CONTROL_CHARACTERS);

/** Profile image: the server accepts no address from the browser (unchecked, e.g. `javascript:` or of any length). */
export const noImageSchema = z.null().optional();

/** E-mail: same rule as Better Auth (z.email), at most 254 characters; own code, otherwise only VALIDATION_ERROR without a clear sentence would reach the browser. */
export const emailSchema = z.email().max(254);

/** Password rule from Figma: at least 8 characters, one digit, one capital letter (upper limit as in Better Auth: 128). */
export const passwordSchema = z.string().min(8).max(128).regex(/\d/).regex(/\p{Lu}/u);

const registrationFields = {
  companyName: companyNameSchema,
  vatId: vatIdSchema,
  materialInterest: materialInterestSchema,
  username: usernameSchema,
  name: nameSchema,
  image: noImageSchema,
  email: emailSchema,
  password: passwordSchema,
} as const;

/** First error of the company, username, name, e-mail and password fields as a code, otherwise null. Better Auth checks "already taken" itself. */
export function registrationError(body: unknown): string | null {
  const data = (body ?? {}) as Record<string, unknown>;
  for (const [field, schema] of Object.entries(registrationFields)) {
    if (!schema.safeParse(data[field]).success) {
      return REGISTRATION_ERROR[field as keyof typeof REGISTRATION_ERROR];
    }
  }
  return null;
}

/**
 * Update profile (POST /api/auth/update-user): whatever is sent must be valid. Otherwise a username could be deleted
 * via null; Better Auth itself checks neither name nor profile image.
 */
export function profileError(body: unknown): string | null {
  // Empty body or not an object: the username plugin would then read a field of null → HTTP 500 instead of 400.
  if (typeof body !== "object" || body === null) return "VALIDATION_ERROR";
  const data = body as Record<string, unknown>;
  if (data.username !== undefined && !usernameSchema.safeParse(data.username).success) return REGISTRATION_ERROR.username;
  if (data.name !== undefined && !nameSchema.safeParse(data.name).success) return REGISTRATION_ERROR.name;
  if (!noImageSchema.safeParse(data.image).success) return REGISTRATION_ERROR.image;
  return null;
}
