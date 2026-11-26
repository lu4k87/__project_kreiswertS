// Checks when the server starts (src/instrumentation.ts), before the first request arrives.

/** Better Auth default value (node_modules/better-auth/dist/utils/constants.mjs) – publicly known, so not a secret. */
const PUBLIC_DEFAULT = "better-auth-secret-12345678901234567890";

/** process.env or a part of it; only BETTER_AUTH_SECRET and BETTER_AUTH_SECRETS are read. */
type SecretEnv = Record<string, string | undefined>;

/**
 * The key Better Auth actually signs with: the first entry of BETTER_AUTH_SECRETS
 * ("<version>:<key>,…", for key rotation) takes precedence over BETTER_AUTH_SECRET.
 */
function effectiveSecret(env: SecretEnv): string | undefined {
  const first = env.BETTER_AUTH_SECRETS?.split(",")[0];
  return first ? first.slice(first.indexOf(":") + 1).trim() : env.BETTER_AUTH_SECRET;
}

/**
 * Without BETTER_AUTH_SECRET, Better Auth silently uses its default value under `next dev` – that would allow
 * forging session cookies. Returns the error message, or null if the key is fine.
 */
export function authSecretProblem(env: SecretEnv): string | null {
  const secret = effectiveSecret(env);
  if (secret && secret.length >= 32 && secret !== PUBLIC_DEFAULT) return null;
  return "BETTER_AUTH_SECRET is missing, shorter than 32 characters or the Better Auth default value → set it in .env, generate with: openssl rand -base64 32";
}
