// Settings shared by the build scripts and the test of the static demo.
export const BASE = process.env.DEMO_BASE_PATH ?? "/web_kreiswerts/app";
export const PORT = Number(process.env.PORT ?? 4312);
export const ARCHITECTURE_URL = "https://lu4k87.github.io/web_kreiswerts/";

// Public on purpose: the login page of the demo shows these logins, and every visitor only reaches the private copy of
// the fictional data inside the own browser. Never put the values of .env or .env.demo here (build.mjs checks the output).
export const SITE_PASSWORD = "Demo-Kreiswert-2026";
export const ADMIN_PASSWORD = "Admin-Kreiswert-2026";
export const AUTH_SECRET = "kreiswerts-static-demo-public-not-a-secret-0001";
