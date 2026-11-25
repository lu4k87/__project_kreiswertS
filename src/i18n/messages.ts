// All visible UI texts in German and English (docs/FRONTEND.md §5).
// TypeScript reports a key that is missing in either language.
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";
/** Cookie set by the language switch (read on the server in src/i18n/locale.ts). */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

const en = {
  common: {
    brand: "KreiswertS",
    home: "KreiswertS – home",
    language: "Language",
    mainNav: "Main navigation",
    footerNav: "Legal and contact",
  },
  header: {
    overview: "Overview",
    howItWorks: "How it works",
    logIn: "Log in",
    createAccount: "Create account",
    account: "My account",
    needHelp: "Need help?",
  },
  footer: {
    copyright: "© 2026 KreiswertS. Materials in motion.",
    privacy: "Privacy",
    terms: "Terms of use",
    contact: "Contact",
  },
  home: {
    kicker: "The B2B circular materials marketplace",
    titleLine1: "Good materials.",
    titleLine2: "A new beginning.",
    subline: "Connect what your business no longer needs with what another business is looking for.",
    map: {
      label: "Illustrated map: material offers with sample prices between the Netherlands, Belgium and Germany",
      badge: "A connected material network",
      caption: "KreiswertS · Regional material network",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      netherlands: "Netherlands",
      germany: "Germany",
      belgium: "Belgium",
    },
    cta: {
      badge: "Built for business",
      titleLine1: "Your next resource",
      titleLine2: "is closer than you think.",
      text: "Find local suppliers, discover available materials and give your surplus a second life.",
      guest: "Continue as a guest",
      member: "Already part of the loop?",
      logIn: "Log in",
    },
    stats: {
      label: "The platform in numbers",
      businesses: "businesses connected",
      materials: "materials available",
      countries: "European countries",
      verified: "Verified companies. Direct connections.",
      unavailable: "not available",
    },
    features: {
      heading: "How it works",
      find: {
        title: "Find your next material",
        text: "Search by material, company or location. Compare availability and prices nearby.",
      },
      surplus: {
        title: "Put your surplus to work",
        text: "List your material, quantity and price. Reach the businesses that need it.",
      },
      connect: {
        title: "Make a direct connection",
        text: "Get to know your next partner and agree on the details, business to business.",
      },
    },
    teaser: {
      title: "From recovered plastic to your next production run.",
      text: "Explore PET, PVC, HDPE and more — with transparent quantities and prices.",
      button: "Explore materials",
      imageAlt: "A pile of recovered, translucent green PET flakes",
    },
  },
  login: {
    kicker: "Keep good materials in the loop",
    titleLine1: "One business’s surplus.",
    titleLine2: "Another’s starting point.",
    text: "A better way to source and sell secondary materials, with businesses across Europe.",
    imageTitle: "Recovered PET flakes",
    imageText: "Ready for a second life.",
    imageAlt: "A pile of recovered, translucent green PET flakes on concrete",
    back: "Back to overview",
    heading: "Welcome back.",
    intro: "Log in to find materials, manage listings and connect with your next partner.",
    email: "Email",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    remember: "Remember me",
    forgot: "Forgot password?",
    submit: "Log in",
    submitting: "Logging in …",
    notRegistered: "Not registered yet?",
    register: "Register here",
    justLooking: "Just looking around?",
    guest: "Continue as a guest",
  },
};

export type Messages = typeof en;

const de: Messages = {
  common: {
    brand: "KreiswertS",
    home: "KreiswertS – Startseite",
    language: "Sprache",
    mainNav: "Hauptnavigation",
    footerNav: "Rechtliches und Kontakt",
  },
  header: {
    overview: "Übersicht",
    howItWorks: "So funktioniert’s",
    logIn: "Einloggen",
    createAccount: "Konto erstellen",
    account: "Mein Konto",
    needHelp: "Hilfe?",
  },
  footer: {
    copyright: "© 2026 KreiswertS. Materialien in Bewegung.",
    privacy: "Datenschutz",
    terms: "Nutzungsbedingungen",
    contact: "Kontakt",
  },
  home: {
    kicker: "Der B2B-Marktplatz für Kreislaufmaterialien",
    titleLine1: "Gute Materialien.",
    titleLine2: "Ein neuer Anfang.",
    subline: "Verbinden Sie, was Ihr Betrieb nicht mehr braucht, mit dem, was ein anderer Betrieb sucht.",
    map: {
      label: "Illustrierte Karte: Materialangebote mit Beispielpreisen zwischen Niederlanden, Belgien und Deutschland",
      badge: "Ein vernetztes Materialnetz",
      caption: "KreiswertS · Regionales Materialnetz",
      zoomIn: "Vergrößern",
      zoomOut: "Verkleinern",
      netherlands: "Niederlande",
      germany: "Deutschland",
      belgium: "Belgien",
    },
    cta: {
      badge: "Für Unternehmen gemacht",
      titleLine1: "Ihre nächste Ressource",
      titleLine2: "ist näher, als Sie denken.",
      text: "Finden Sie Anbieter in der Nähe, entdecken Sie verfügbare Materialien und geben Sie Ihren Überschüssen ein zweites Leben.",
      guest: "Als Gast weiter",
      member: "Schon im Kreislauf dabei?",
      logIn: "Einloggen",
    },
    stats: {
      label: "Die Plattform in Zahlen",
      businesses: "Betriebe vernetzt",
      materials: "Materialien verfügbar",
      countries: "europäische Länder",
      verified: "Geprüfte Unternehmen. Direkte Kontakte.",
      unavailable: "nicht verfügbar",
    },
    features: {
      heading: "So funktioniert’s",
      find: {
        title: "Ihr nächstes Material finden",
        text: "Suchen Sie nach Material, Unternehmen oder Ort. Vergleichen Sie Verfügbarkeit und Preise in Ihrer Nähe.",
      },
      surplus: {
        title: "Überschüsse sinnvoll nutzen",
        text: "Stellen Sie Material, Menge und Preis ein. Erreichen Sie die Betriebe, die es brauchen.",
      },
      connect: {
        title: "Direkt in Kontakt kommen",
        text: "Lernen Sie Ihren nächsten Partner kennen und klären Sie die Details direkt von Betrieb zu Betrieb.",
      },
    },
    teaser: {
      title: "Vom recycelten Kunststoff zu Ihrer nächsten Produktion.",
      text: "Entdecken Sie PET, PVC, HDPE und mehr – mit transparenten Mengen und Preisen.",
      button: "Materialien entdecken",
      imageAlt: "Ein Haufen recycelter, durchscheinend grüner PET-Flakes",
    },
  },
  login: {
    kicker: "Gute Materialien im Kreislauf halten",
    titleLine1: "Der Überschuss des einen.",
    titleLine2: "Der Anfang des anderen.",
    text: "Ein besserer Weg, Sekundärmaterialien einzukaufen und zu verkaufen – mit Betrieben in ganz Europa.",
    imageTitle: "Recycelte PET-Flakes",
    imageText: "Bereit für ein zweites Leben.",
    imageAlt: "Ein Haufen recycelter, durchscheinend grüner PET-Flakes auf Beton",
    back: "Zurück zur Übersicht",
    heading: "Willkommen zurück.",
    intro: "Melden Sie sich an, um Materialien zu finden, Angebote zu verwalten und Ihren nächsten Partner zu treffen.",
    email: "E-Mail",
    password: "Passwort",
    showPassword: "Passwort anzeigen",
    hidePassword: "Passwort verbergen",
    remember: "Angemeldet bleiben",
    forgot: "Passwort vergessen?",
    submit: "Einloggen",
    submitting: "Einloggen …",
    notRegistered: "Noch nicht registriert?",
    register: "Hier registrieren",
    justLooking: "Nur mal umsehen?",
    guest: "Als Gast weiter",
  },
};

export const messages: Record<Locale, Messages> = { de, en };
