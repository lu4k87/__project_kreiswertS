// Texts of the visual aids added on 2026-11-28 (preview "Mehr echte Grafiken"): the three steps in empty lists and the
// progress of a negotiation. English and German, merged into the platform messages (platform.ts).
type Step = { title: string; text: string };

export const visualsEn = {
  emptySteps: {
    notices: [
      { title: "Save a search", text: "on the offers page" },
      { title: "A matching offer", text: "is published" },
      { title: "A notice appears", text: "here and at the bell" },
    ] as Step[],
    negotiations: [
      { title: "Open a match", text: "compare offer and request" },
      { title: "Propose terms", text: "quantity, price, handover" },
      { title: "Agree", text: "both sites accept" },
    ] as Step[],
    exchanges: [
      { title: "Agree a negotiation", text: "the terms are fixed" },
      { title: "Plan the exchange", text: "date and place" },
      { title: "Record the receipt", text: "by the receiving site" },
    ] as Step[],
    myOffers: [
      { title: "Describe the material", text: "quantity, form, origin" },
      { title: "Publish", text: "for verified sites" },
      { title: "Get enquiries", text: "and see matches" },
    ] as Step[],
  },
  progress: {
    label: "Progress of this negotiation",
    proposal: "Proposal",
    negotiation: "Negotiation",
    agreed: "Agreed",
    contract: "Contract",
    exchange: "Exchange",
    done: "done",
    now: "now",
    next: "next step",
    later: "later",
    ended: "ended",
    flowLabel: "Who passes on what",
    yourSite: "Your site",
    gives: "passes on",
    takes: "takes over",
  },
};

export const visualsDe: typeof visualsEn = {
  emptySteps: {
    notices: [
      { title: "Suche speichern", text: "auf der Angebotsseite" },
      { title: "Passendes Angebot", text: "wird veröffentlicht" },
      { title: "Hinweis erscheint", text: "hier und an der Glocke" },
    ],
    negotiations: [
      { title: "Treffer öffnen", text: "Angebot und Gesuch vergleichen" },
      { title: "Bedingungen vorschlagen", text: "Menge, Preis, Übergabe" },
      { title: "Vereinbaren", text: "beide Standorte stimmen zu" },
    ],
    exchanges: [
      { title: "Verhandlung vereinbaren", text: "Bedingungen stehen fest" },
      { title: "Austausch planen", text: "Termin und Ort" },
      { title: "Eingang erfassen", text: "durch den empfangenden Standort" },
    ],
    myOffers: [
      { title: "Material beschreiben", text: "Menge, Form, Herkunft" },
      { title: "Veröffentlichen", text: "für geprüfte Standorte" },
      { title: "Anfragen erhalten", text: "und Treffer sehen" },
    ],
  },
  progress: {
    label: "Fortschritt dieser Verhandlung",
    proposal: "Vorschlag",
    negotiation: "Verhandlung",
    agreed: "Vereinbart",
    contract: "Vertrag",
    exchange: "Austausch",
    done: "erledigt",
    now: "jetzt",
    next: "nächster Schritt",
    later: "später",
    ended: "beendet",
    flowLabel: "Wer gibt was weiter",
    yourSite: "Ihr Standort",
    gives: "gibt weiter",
    takes: "übernimmt",
  },
};
