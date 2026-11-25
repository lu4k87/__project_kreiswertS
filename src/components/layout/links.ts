// Link targets shared by header, footer and pages.
// TODO: replace PLACEHOLDER_HREF once the page exists (offers list, help, privacy, terms, contact, password reset).
export const PLACEHOLDER_HREF = "#";

export const ROUTES = {
  home: "/",
  howItWorks: "/#how-it-works",
  login: "/login",
  register: "/registrieren",
  account: "/konto",
  offers: PLACEHOLDER_HREF, // TODO: "/offers" (docs/FRONTEND.md §10)
} as const;
