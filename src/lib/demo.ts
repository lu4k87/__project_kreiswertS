// Static demo on GitHub Pages (demo/, `npm run demo:build`): the whole app runs in the visitor's browser.
// The demo build sets the NEXT_PUBLIC_DEMO_* values (demo/build.mjs); in the normal app they are unset and
// everything that depends on DEMO_STATIC is off.
export const DEMO_STATIC = process.env.NEXT_PUBLIC_DEMO_STATIC === "1";

/** Values the demo build inlines; empty strings in the normal app. The passwords are public on purpose (demo/config.mjs). */
export const DEMO = {
  basePath: process.env.NEXT_PUBLIC_DEMO_BASE_PATH ?? "",
  commit: process.env.NEXT_PUBLIC_DEMO_COMMIT ?? "",
  /** Date of that commit, YYYY-MM-DD. */
  date: process.env.NEXT_PUBLIC_DEMO_DATE ?? "",
  sitePassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "",
  adminPassword: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD ?? "",
  architectureUrl: process.env.NEXT_PUBLIC_DEMO_ARCHITECTURE_URL ?? "",
};

/**
 * The demo logins of scripts/seed/demo.mjs (site names are fictional proper names, the same in both languages).
 * `main`: shown at once on the login page – the sites of the user scenarios and the administrator.
 */
export const DEMO_LOGINS = [
  { login: "site_a", name: "Werk A", state: "verified", main: true },
  { login: "site_b", name: "Standort B", state: "verified", main: true },
  { login: "site_c", name: "Werk C", state: "verified", main: true },
  { login: "site_d", name: "Werk D", state: "verified", main: true },
  { login: "site_e", name: "Standort E", state: "pending", main: true },
  { login: "hsrw", name: "Campus Kleve", state: "verified", main: true },
  { login: "hsrw_kamp", name: "Campus Kamp-Lintfort", state: "verified", main: true },
  { login: "admin_demo", name: null, state: "admin", main: true },
  { login: "site_f", name: "Lager F", state: "verified", main: false },
  { login: "site_g", name: "Werk G", state: "verified", main: false },
  { login: "site_h", name: "Bauhof H", state: "verified", main: false },
  { login: "site_i", name: "Compoundierwerk I", state: "verified", main: false },
  { login: "site_j", name: "Standort J", state: "verified", main: false },
  { login: "site_k", name: "Werk K", state: "verified", main: false },
  { login: "site_l", name: "Sortieranlage L", state: "verified", main: false },
] as const;

export type DemoLogin = (typeof DEMO_LOGINS)[number];
