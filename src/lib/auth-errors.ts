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
