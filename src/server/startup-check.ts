// Checks when the server starts (src/instrumentation.ts), before the first request arrives.

/** Better Auth default value (node_modules/better-auth/dist/utils/constants.mjs) – publicly known, so not a secret. */
const PUBLIC_DEFAULT = "better-auth-secret-12345678901234567890";

/** process.env or a part of it; only the variables named in this file are read. */
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

/**
 * Environment values that switch off protection in Better Auth without any error:
 * - TEST (anything but "false") or NODE_ENV=test disables the origin and CSRF check
 *   (node_modules/@better-auth/core/dist/env/env-impl.mjs, isTest).
 * - Without BETTER_AUTH_URL the Host header of each request counts as the trusted origin.
 * - A wildcard in its host ("http://*", "https://*.example.org") would make every matching origin trusted.
 * Returns the error message, or null if the environment is fine.
 */
export function authEnvProblem(env: SecretEnv): string | null {
  if (env.NODE_ENV === "test" || (env.TEST && env.TEST !== "false")) {
    return "TEST or NODE_ENV=test is set → Better Auth would skip its origin and CSRF check; unset it for a running server";
  }
  const url = env.BETTER_AUTH_URL ?? "";
  if (!URL.canParse(url) || !/^https?:\/\//.test(url) || /[*?]/.test(new URL(url).host)) {
    return "BETTER_AUTH_URL is missing, not an http(s) address or contains a wildcard → set it in .env to the one address the app runs at, e.g. http://localhost:3000";
  }
  return null;
}

/**
 * A webhook secret that is set but too short would silently be replaced by a random one – then a provider (or a
 * test script) signing with it is refused without a clear reason. Unset is fine (random per process).
 */
export function paymentSecretProblem(env: SecretEnv): string | null {
  const secret = env.PAYMENT_WEBHOOK_SECRET;
  if (secret === undefined || secret === "" || secret.length >= 32) return null;
  return "PAYMENT_WEBHOOK_SECRET is shorter than 32 characters → set a longer one (openssl rand -hex 32) or leave it empty";
}

/** First problem that must stop the server from answering requests, or null. */
export function startupProblem(env: SecretEnv): string | null {
  return authSecretProblem(env) ?? authEnvProblem(env) ?? paymentSecretProblem(env);
}
