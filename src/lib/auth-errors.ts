// Fehler von Better Auth (Code + HTTP-Status) als verständlicher Satz auf Deutsch oder Englisch.
import { DEFAULT_LOCALE, type Locale } from "@/i18n/messages";

type Texts = { codes: Record<string, string>; tooMany: string; fallback: string };

const TEXTS: Record<Locale, Texts> = {
  de: {
    codes: {
      USER_ALREADY_EXISTS: "Diese E-Mail ist schon registriert. Bitte einloggen.",
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Diese E-Mail ist schon registriert. Bitte einloggen.",
      PASSWORD_TOO_SHORT: "Passwort zu kurz: mindestens 8 Zeichen.",
      PASSWORD_TOO_LONG: "Passwort zu lang: höchstens 128 Zeichen.",
      INVALID_EMAIL: "Bitte eine gültige E-Mail-Adresse eingeben.",
      INVALID_EMAIL_OR_PASSWORD: "E-Mail oder Passwort falsch.",
      INVALID_USERNAME_OR_PASSWORD: "Benutzername oder Passwort falsch.",
      USERNAME_IS_ALREADY_TAKEN: "Dieser Benutzername ist schon vergeben. Bitte einen anderen wählen.",
      USERNAME_TOO_SHORT: "Benutzername zu kurz: mindestens 3 Zeichen.",
      USERNAME_TOO_LONG: "Benutzername zu lang: höchstens 30 Zeichen.",
      INVALID_USERNAME: "Benutzername nur aus Buchstaben, Ziffern, Punkt und Unterstrich.",
      INVALID_COMPANY_NAME: "Bitte den Firmennamen eingeben (2–200 Zeichen).",
      INVALID_VAT_ID: "Bitte eine gültige USt-IdNr. eingeben, z.\u00a0B. DE 123 456 789.",
      INVALID_MATERIAL_INTEREST: "Bitte ein Material aus der Liste wählen.",
      PASSWORD_TOO_WEAK: "Passwort: mindestens 8 Zeichen, eine Zahl und ein Großbuchstabe.",
    },
    tooMany: "Zu viele Versuche. Bitte kurz warten und erneut probieren.",
    fallback: "Das hat nicht geklappt. Bitte später erneut versuchen.",
  },
  en: {
    codes: {
      USER_ALREADY_EXISTS: "This email is already registered. Please log in.",
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "This email is already registered. Please log in.",
      PASSWORD_TOO_SHORT: "Password too short: at least 8 characters.",
      PASSWORD_TOO_LONG: "Password too long: at most 128 characters.",
      INVALID_EMAIL: "Please enter a valid email address.",
      INVALID_EMAIL_OR_PASSWORD: "Email or password is incorrect.",
      INVALID_USERNAME_OR_PASSWORD: "Username or password is incorrect.",
      USERNAME_IS_ALREADY_TAKEN: "This username is already taken. Please choose another one.",
      USERNAME_TOO_SHORT: "Username too short: at least 3 characters.",
      USERNAME_TOO_LONG: "Username too long: at most 30 characters.",
      INVALID_USERNAME: "Username may only contain letters, digits, dots and underscores.",
      INVALID_COMPANY_NAME: "Please enter your company name (2–200 characters).",
      INVALID_VAT_ID: "Please enter a valid tax / VAT ID, e.g. DE 123 456 789.",
      INVALID_MATERIAL_INTEREST: "Please choose a material from the list.",
      PASSWORD_TOO_WEAK: "Password: at least 8 characters, a number and a capital letter.",
    },
    tooMany: "Too many attempts. Please wait a moment and try again.",
    fallback: "That did not work. Please try again later.",
  },
};

export type AuthError = { code?: string; status?: number; message?: string } | null | undefined;

export function authErrorText(error: AuthError, locale: Locale = DEFAULT_LOCALE): string {
  const texts = TEXTS[locale];
  if (error?.code && texts.codes[error.code]) return texts.codes[error.code];
  if (error?.status === 429) return texts.tooMany;
  return texts.fallback;
}
