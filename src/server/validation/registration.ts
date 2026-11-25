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
  password: "PASSWORD_TOO_WEAK",
} as const;

export const companyNameSchema = z.string().trim().min(2).max(200);

/** EU-USt-IdNr.: Länderkürzel + 2–12 Zeichen; Leerzeichen, Punkte, Bindestriche werden entfernt (DE 294 681 207 → DE294681207). */
export const vatIdSchema = z
  .string()
  .transform((value) => value.replace(/[\s.-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9+*]{2,12}$/));

export const materialInterestSchema = z.enum(MATERIAL_INTERESTS);

/** Passwortregel aus Figma: mind. 8 Zeichen, eine Zahl, ein Großbuchstabe (Obergrenze wie Better Auth: 128). */
export const passwordSchema = z.string().min(8).max(128).regex(/\d/).regex(/\p{Lu}/u);

const registrationFields = {
  companyName: companyNameSchema,
  vatId: vatIdSchema,
  materialInterest: materialInterestSchema,
  password: passwordSchema,
} as const;

/** Erster Fehler der Firmen-/Passwortfelder als Code, sonst null. Benutzername + E-Mail prüft Better Auth selbst. */
export function registrationError(body: unknown): string | null {
  const data = (body ?? {}) as Record<string, unknown>;
  for (const [field, schema] of Object.entries(registrationFields)) {
    if (!schema.safeParse(data[field]).success) {
      return REGISTRATION_ERROR[field as keyof typeof REGISTRATION_ERROR];
    }
  }
  return null;
}
