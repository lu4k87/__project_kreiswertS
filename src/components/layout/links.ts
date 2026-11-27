// Link targets shared by header, footer and pages.
export const ROUTES = {
  home: "/",
  howItWorks: "/#how-it-works",
  about: "/about",
  regionalMap: "/regional-map",
  help: "/help",
  login: "/login",
  register: "/register",
  registerSite: "/register/site",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  dashboard: "/dashboard",
  offers: "/offers",
  map: "/map",
  companies: "/companies",
  myOffers: "/my-offers",
  newOffer: "/my-offers/new",
  requests: "/requests",
  myRequests: "/my-requests",
  newRequest: "/my-requests/new",
  matches: "/matches",
  negotiations: "/negotiations",
  exchanges: "/exchanges",
  account: "/account",
  adminVerification: "/admin/verification",
  adminReferenceData: "/admin/reference-data",
} as const;

export const offerPath = (id: number) => `/offers/${id}`;
export const editOfferPath = (id: number) => `/my-offers/${id}/edit`;
export const previewOfferPath = (id: number) => `/my-offers/${id}/preview`;
export const sitePath = (id: number) => `/sites/${id}`;
export const requestPath = (id: number) => `/requests/${id}`;
export const editRequestPath = (id: number) => `/my-requests/${id}/edit`;
export const matchPath = (requestId: number, offerId: number) => `/matches/${requestId}/${offerId}`;
export const negotiationPath = (id: number) => `/negotiations/${id}`;
export const exchangePath = (id: number) => `/exchanges/${id}`;
/** First proposal for an offer, optionally for a request (the server decides who negotiates with whom). */
export const newNegotiationPath = (offerId: number, requestId?: number | null) => `/negotiations/new?offer=${offerId}${requestId != null ? `&request=${requestId}` : ""}`;

/**
 * Target after login: only a path inside this app (starts with one "/", no scheme, no "//", no backslash) –
 * a `next` parameter can never send someone to another website.
 */
export function safeNextPath(next: string | string[] | undefined | null, fallback: string = ROUTES.dashboard): string {
  if (typeof next !== "string") return fallback;
  return /^\/(?![/\\])[^\s\\]*$/.test(next) ? next : fallback;
}
