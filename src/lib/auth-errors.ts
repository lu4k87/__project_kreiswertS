// Fehler von Better Auth (Code + HTTP-Status) als verständlicher deutscher Satz.

const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Diese E-Mail ist schon registriert. Bitte einloggen.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Diese E-Mail ist schon registriert. Bitte einloggen.",
  PASSWORD_TOO_SHORT: "Passwort zu kurz: mindestens 8 Zeichen.",
  PASSWORD_TOO_LONG: "Passwort zu lang: höchstens 128 Zeichen.",
  INVALID_EMAIL: "Bitte eine gültige E-Mail-Adresse eingeben.",
  INVALID_EMAIL_OR_PASSWORD: "E-Mail oder Passwort falsch.",
};

export type AuthError = { code?: string; status?: number; message?: string } | null | undefined;

export function authErrorText(error: AuthError): string {
  if (error?.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error?.status === 429) return "Zu viele Versuche. Bitte kurz warten und erneut probieren.";
  return "Das hat nicht geklappt. Bitte später erneut versuchen.";
}
