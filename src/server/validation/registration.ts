// Station 3 – Validierung der Registrierung (POST /api/auth/sign-up/email).
// Läuft auf dem Server im Better-Auth-Hook (src/server/auth.ts); der Browser prüft nur zur Bequemlichkeit vor.
// Wird auch im Browser geladen (register-form.tsx) → hier nur zod importieren, nie DB- oder Server-Module.
import { z } from "zod";

/** Material-Interesse: feste Liste, Texte DE/EN in src/i18n/messages.ts (register.materials). */
export const MATERIAL_INTERESTS = ["plastics", "metals", "paper", "glass", "textiles", "food", "pharma", "other"] as const;
export type MaterialInterest = (typeof MATERIAL_INTERESTS)[number];

/** Fehlercodes, die der Browser per authErrorText() übersetzt (src/lib/auth-errors.ts). */
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
 * Keine Steuerzeichen (z. B. NUL: PostgreSQL lehnt es ab → sonst HTTP 500 statt 400) und keine unsichtbaren Trenn- und
 * Richtungszeichen (Zeilentrenner, Leerzeichen ohne Breite, Umkehr der Schreibrichtung) – sie täuschen in der Anzeige.
 */
const NO_CONTROL_CHARACTERS = /^[^\p{Cc}\u2028\u2029\u200B\u202A-\u202E\u2060\u2066-\u2069]*$/u;
/** Mindestens ein Buchstabe oder eine Ziffer – also weder leer noch nur Leer- oder Satzzeichen. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const companyNameSchema = z.string().trim().min(2).max(200).regex(HAS_LETTER_OR_DIGIT).regex(NO_CONTROL_CHARACTERS);

/** EU-USt-IdNr.: Länderkürzel + 2–12 Zeichen; Leerzeichen, Punkte, Bindestriche werden entfernt (DE 294 681 207 → DE294681207). */
export const vatIdSchema = z
  .string()
  .transform((value) => value.replace(/[\s.-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9+*]{2,12}$/));

export const materialInterestSchema = z.enum(MATERIAL_INTERESTS);

/** Benutzername ist Pflicht (das Plugin von Better Auth prüft nur das Format, wenn einer mitkommt): 3–30 Zeichen aus a–z, 0–9, _ und . */
export const usernameSchema = z.string().min(3).max(30).regex(/^[A-Za-z0-9_.]+$/);

/**
 * Anzeigename (Better Auth verlangt ihn, das Formular schickt den Benutzernamen): höchstens 100 Zeichen, mindestens ein
 * Buchstabe oder eine Ziffer, keine Steuer- und unsichtbaren Zeichen.
 */
export const nameSchema = z.string().max(100).regex(HAS_LETTER_OR_DIGIT).regex(NO_CONTROL_CHARACTERS);

/** Profilbild: der Server nimmt keine Adresse vom Browser an (ungeprüft, z. B. `javascript:` oder beliebig lang). */
export const noImageSchema = z.null().optional();

/** E-Mail: gleiche Regel wie Better Auth (z.email), höchstens 254 Zeichen; eigener Code, sonst käme nur VALIDATION_ERROR ohne klaren Satz für den Browser. */
export const emailSchema = z.email().max(254);

/** Passwortregel aus Figma: mind. 8 Zeichen, eine Zahl, ein Großbuchstabe (Obergrenze wie Better Auth: 128). */
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

/** Erster Fehler der Firmen-, Benutzername-, Namens-, E-Mail- und Passwortfelder als Code, sonst null. „Schon vergeben“ prüft Better Auth selbst. */
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
 * Profil ändern (POST /api/auth/update-user): was mitkommt, muss gültig sein. Ein Benutzername ließe sich sonst per null
 * löschen; Name und Profilbild prüft Better Auth selbst nicht.
 */
export function profileError(body: unknown): string | null {
  // Leerer Body oder kein Objekt: das Benutzername-Plugin läse danach ein Feld von null → HTTP 500 statt 400.
  if (typeof body !== "object" || body === null) return "VALIDATION_ERROR";
  const data = body as Record<string, unknown>;
  if (data.username !== undefined && !usernameSchema.safeParse(data.username).success) return REGISTRATION_ERROR.username;
  if (data.name !== undefined && !nameSchema.safeParse(data.name).success) return REGISTRATION_ERROR.name;
  if (!noImageSchema.safeParse(data.image).success) return REGISTRATION_ERROR.image;
  return null;
}
