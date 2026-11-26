// Prüfungen beim Start des Servers (src/instrumentation.ts), bevor die erste Anfrage ankommt.

/** Standardwert von Better Auth (node_modules/better-auth/dist/utils/constants.mjs) – öffentlich bekannt, also kein Geheimnis. */
const PUBLIC_DEFAULT = "better-auth-secret-12345678901234567890";

/** process.env oder ein Ausschnitt davon; gelesen werden nur BETTER_AUTH_SECRET und BETTER_AUTH_SECRETS. */
type SecretEnv = Record<string, string | undefined>;

/**
 * Der Schlüssel, mit dem Better Auth wirklich signiert: der erste Eintrag von BETTER_AUTH_SECRETS
 * ("<Version>:<Schlüssel>,…", für den Schlüsselwechsel) hat Vorrang vor BETTER_AUTH_SECRET.
 */
function effectiveSecret(env: SecretEnv): string | undefined {
  const first = env.BETTER_AUTH_SECRETS?.split(",")[0];
  return first ? first.slice(first.indexOf(":") + 1).trim() : env.BETTER_AUTH_SECRET;
}

/**
 * Ohne BETTER_AUTH_SECRET nimmt Better Auth unter `next dev` stillschweigend seinen Standardwert – damit ließen sich
 * Session-Cookies fälschen. Liefert die Fehlermeldung oder null, wenn der Schlüssel passt.
 */
export function authSecretProblem(env: SecretEnv): string | null {
  const secret = effectiveSecret(env);
  if (secret && secret.length >= 32 && secret !== PUBLIC_DEFAULT) return null;
  return "BETTER_AUTH_SECRET fehlt, ist kürzer als 32 Zeichen oder der Standardwert von Better Auth → in .env setzen, erzeugen mit: openssl rand -base64 32";
}
