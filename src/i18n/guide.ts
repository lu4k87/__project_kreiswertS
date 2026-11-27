// Texts of the public guide page /guide (function no. 46) in English and German. Static, no backend.
// Sources: the "Read me" sheet of CONTENT/KreiswertS_Backend_Functionality.xlsx (KrWG §§ 4–6, 53–54; PPWR Art. 3, 7).
// A short orientation only – never legal advice; every statement points to the law it comes from.
import type { Locale } from "./messages";

type Source = { label: string; href: string };
type Status = { key: "waste" | "by_product" | "end_of_waste"; title: string; law: string; text: string; points: string[] };
type Duties = { title: string; text: string; points: string[] };
type Step = { title: string; text: string };

export type GuideMessages = {
  title: string;
  lead: string;
  disclaimerTitle: string;
  disclaimer: string;
  updated: string;
  statusTitle: string;
  statusIntro: string;
  statuses: Status[];
  conditions: string;
  statusFormNote: string;
  hierarchyTitle: string;
  hierarchyText: string;
  hierarchy: string[];
  dutiesTitle: string;
  dutiesIntro: string;
  supplier: Duties;
  receiver: Duties;
  flowTitle: string;
  flowIntro: string;
  steps: Step[];
  platformTitle: string;
  platformText: string;
  sourcesTitle: string;
  sourcesIntro: string;
  sources: Source[];
};

const LAW = "https://www.gesetze-im-internet.de";

const en: GuideMessages = {
  title: "Guide: passing on materials lawfully",
  lead: "A short orientation for both sides of an exchange: is a residue waste or a by-product, what does each side have to take care of, and how does a cooperation on KreiswertS work.",
  disclaimerTitle: "No legal advice",
  disclaimer:
    "This page summarises the law in simplified form and links to the original texts. It does not replace advice from your waste officer, the competent authority or a lawyer. In case of doubt the law and the decision of the authority apply.",
  updated: "As of 27 November 2026",
  statusTitle: "By-product or waste?",
  statusIntro:
    "Whether a residue counts as waste decides which duties apply. The German Circular Economy Act (KrWG) distinguishes three cases.",
  statuses: [
    {
      key: "waste",
      title: "Waste",
      law: "KrWG § 3",
      text: "Every substance or object that its holder discards, wants to discard or has to discard.",
      points: ["Waste duties apply: recovery before disposal", "Usually identified by a waste code of the European List of Waste (AVV)"],
    },
    {
      key: "by_product",
      title: "By-product",
      law: "KrWG § 4",
      text: "A substance that arises in a production process without being its purpose is not waste if all four conditions are met:",
      points: [
        "its further use is certain",
        "it needs no processing beyond normal industrial practice",
        "it is produced as an integral part of a production process",
        "its further use is lawful and has no harmful effect on people or the environment overall",
      ],
    },
    {
      key: "end_of_waste",
      title: "End of waste",
      law: "KrWG § 5",
      text: "Waste stops being waste once it has gone through a recovery operation and",
      points: [
        "is commonly used for specific purposes",
        "has a market or a demand",
        "meets the technical requirements and the law for products",
        "its use has no harmful effect on people or the environment overall",
      ],
    },
  ],
  conditions: "Conditions",
  statusFormNote:
    "In the offer form you state the legal status (field “Legal status”). If you are not sure, choose “Unknown” – the receiver then clarifies it with you before an exchange.",
  hierarchyTitle: "Order of priority",
  hierarchyText: "The waste hierarchy (KrWG § 6) sets the order in which measures come first:",
  hierarchy: ["Prevention", "Preparing for re-use", "Recycling", "Other recovery, e.g. energy recovery", "Disposal"],
  dutiesTitle: "Duties of both sides",
  dutiesIntro: "Passing a material on does not end the responsibility for it. In short:",
  supplier: {
    title: "Supplying company",
    text: "Offers a residue, by-product or secondary raw material.",
    points: [
      "State the legal status honestly and add the waste code for waste (KrWG §§ 3–5)",
      "Recover waste in line with the waste hierarchy (KrWG §§ 6–7)",
      "Remain responsible even when a third party is commissioned (KrWG § 22)",
      "Describe quality and contaminants as they are – no guarantee beyond the evidence",
    ],
  },
  receiver: {
    title: "Receiving company",
    text: "Takes over the material, processes it or uses it in production.",
    points: [
      "Accept waste only with the permits your plant needs for it",
      "Collectors, carriers, dealers and brokers of waste must notify the authority, for hazardous waste they need a permit (KrWG §§ 53–54)",
      "For a by-product: the planned use has to be lawful (KrWG § 4 no. 4)",
      "Check the specification, ask for a sample or a datasheet before you commit",
    ],
  },
  flowTitle: "How a cooperation works",
  flowIntro: "On KreiswertS an exchange runs in six steps. Contracts and payments are simulated in the prototype.",
  steps: [
    { title: "Offer or request", text: "A verified site publishes what it has or what it needs." },
    { title: "Find and match", text: "Search, map and matching show suitable partners nearby." },
    { title: "Ask", text: "An enquiry clarifies quantity, quality, sample and legal status." },
    { title: "Negotiate", text: "Both sides agree on price, quantity, handover and dates." },
    { title: "Contract", text: "The agreed terms become a contract that both sign (simulated)." },
    { title: "Exchange and effect", text: "Handover is documented, the platform estimates the saved emissions." },
  ],
  platformTitle: "What KreiswertS does not do",
  platformText:
    "KreiswertS brings companies together. The platform never takes possession of material, is not a waste broker, books no transport and checks no legal status – these decisions stay with the companies involved.",
  sourcesTitle: "Sources",
  sourcesIntro: "Original texts of the law, free of charge:",
  sources: [
    { label: "KrWG § 3 – Definitions (waste)", href: `${LAW}/krwg/__3.html` },
    { label: "KrWG § 4 – By-products", href: `${LAW}/krwg/__4.html` },
    { label: "KrWG § 5 – End of waste status", href: `${LAW}/krwg/__5.html` },
    { label: "KrWG § 6 – Waste hierarchy", href: `${LAW}/krwg/__6.html` },
    { label: "KrWG § 7 – Basic duties of recovery", href: `${LAW}/krwg/__7.html` },
    { label: "KrWG § 22 – Commissioning third parties", href: `${LAW}/krwg/__22.html` },
    { label: "KrWG §§ 53–54 – Notification and permit for collectors, carriers, dealers, brokers", href: `${LAW}/krwg/__53.html` },
    { label: "AVV – European List of Waste (waste codes)", href: `${LAW}/avv/` },
    { label: "PPWR (EU) 2025/40 – Art. 3 definitions, Art. 7 minimum recycled content in plastic packaging", href: "https://eur-lex.europa.eu/eli/reg/2025/40/oj/eng" },
  ],
};

const de: GuideMessages = {
  title: "Leitfaden: Material rechtssicher weitergeben",
  lead: "Eine kurze Orientierung für beide Seiten eines Austauschs: Ist ein Reststoff Abfall oder Nebenprodukt, worauf muss jede Seite achten und wie läuft eine Kooperation auf KreiswertS ab.",
  disclaimerTitle: "Keine Rechtsberatung",
  disclaimer:
    "Diese Seite fasst das Recht vereinfacht zusammen und verlinkt die Originaltexte. Sie ersetzt keine Beratung durch Ihre Abfallbeauftragten, die zuständige Behörde oder eine Anwaltskanzlei. Im Zweifel gelten das Gesetz und die Entscheidung der Behörde.",
  updated: "Stand: 27. November 2026",
  statusTitle: "Nebenprodukt oder Abfall?",
  statusIntro:
    "Ob ein Reststoff als Abfall gilt, entscheidet, welche Pflichten greifen. Das Kreislaufwirtschaftsgesetz (KrWG) unterscheidet drei Fälle.",
  statuses: [
    {
      key: "waste",
      title: "Abfall",
      law: "KrWG § 3",
      text: "Alle Stoffe oder Gegenstände, derer sich ihr Besitzer entledigt, entledigen will oder entledigen muss.",
      points: ["Es gelten die Abfallpflichten: Verwertung vor Beseitigung", "Meist mit Abfallschlüssel nach Abfallverzeichnis (AVV) bezeichnet"],
    },
    {
      key: "by_product",
      title: "Nebenprodukt",
      law: "KrWG § 4",
      text: "Ein Stoff, der bei der Herstellung anfällt, ohne deren Zweck zu sein, ist kein Abfall, wenn alle vier Bedingungen erfüllt sind:",
      points: [
        "seine Weiterverwendung ist sichergestellt",
        "er braucht keine Vorbehandlung über die normale industrielle Praxis hinaus",
        "er entsteht als integraler Bestandteil eines Herstellungsprozesses",
        "seine Weiterverwendung ist rechtmäßig und insgesamt ohne schädliche Folgen für Mensch und Umwelt",
      ],
    },
    {
      key: "end_of_waste",
      title: "Ende der Abfalleigenschaft",
      law: "KrWG § 5",
      text: "Abfall ist kein Abfall mehr, wenn er ein Verwertungsverfahren durchlaufen hat und",
      points: [
        "üblicherweise für bestimmte Zwecke verwendet wird",
        "ein Markt oder eine Nachfrage besteht",
        "die technischen Anforderungen und Rechtsvorschriften für Erzeugnisse erfüllt",
        "seine Verwendung insgesamt keine schädlichen Folgen für Mensch und Umwelt hat",
      ],
    },
  ],
  conditions: "Bedingungen",
  statusFormNote:
    "Im Angebotsformular geben Sie den rechtlichen Status an (Feld „Rechtlicher Status“). Wenn Sie unsicher sind, wählen Sie „Unbekannt“ – die Abnehmerseite klärt das dann vor einem Austausch mit Ihnen.",
  hierarchyTitle: "Rangfolge",
  hierarchyText: "Die Abfallhierarchie (KrWG § 6) legt fest, welche Maßnahme Vorrang hat:",
  hierarchy: ["Vermeidung", "Vorbereitung zur Wiederverwendung", "Recycling", "Sonstige Verwertung, z. B. energetisch", "Beseitigung"],
  dutiesTitle: "Pflichten beider Seiten",
  dutiesIntro: "Mit der Weitergabe endet die Verantwortung für ein Material nicht. Kurz gefasst:",
  supplier: {
    title: "Abgebendes Unternehmen",
    text: "Bietet einen Reststoff, ein Nebenprodukt oder einen Sekundärrohstoff an.",
    points: [
      "Rechtlichen Status ehrlich angeben, bei Abfall den Abfallschlüssel (KrWG §§ 3–5)",
      "Abfall nach der Abfallhierarchie verwerten (KrWG §§ 6–7)",
      "Bleibt verantwortlich, auch wenn ein Dritter beauftragt wird (KrWG § 22)",
      "Qualität und Störstoffe so beschreiben, wie sie sind – keine Zusage über die Nachweise hinaus",
    ],
  },
  receiver: {
    title: "Aufnehmendes Unternehmen",
    text: "Übernimmt das Material, bereitet es auf oder setzt es in der Produktion ein.",
    points: [
      "Abfall nur mit den Genehmigungen annehmen, die die eigene Anlage dafür braucht",
      "Sammler, Beförderer, Händler und Makler von Abfällen zeigen das der Behörde an, bei gefährlichen Abfällen brauchen sie eine Erlaubnis (KrWG §§ 53–54)",
      "Bei einem Nebenprodukt: die geplante Verwendung muss rechtmäßig sein (KrWG § 4 Nr. 4)",
      "Spezifikation prüfen, vor der Zusage Probe oder Datenblatt anfragen",
    ],
  },
  flowTitle: "Ablauf einer Kooperation",
  flowIntro: "Auf KreiswertS läuft ein Austausch in sechs Schritten. Verträge und Zahlungen sind im Prototyp simuliert.",
  steps: [
    { title: "Angebot oder Anfrage", text: "Ein verifizierter Standort veröffentlicht, was er hat oder was er braucht." },
    { title: "Finden und abgleichen", text: "Suche, Karte und Abgleich zeigen passende Partner in der Nähe." },
    { title: "Nachfragen", text: "Eine Anfrage klärt Menge, Qualität, Probe und rechtlichen Status." },
    { title: "Verhandeln", text: "Beide Seiten einigen sich auf Preis, Menge, Übergabe und Termine." },
    { title: "Vertrag", text: "Aus den Bedingungen wird ein Vertrag, den beide unterzeichnen (simuliert)." },
    { title: "Austausch und Wirkung", text: "Die Übergabe wird dokumentiert, die Plattform schätzt die eingesparten Emissionen." },
  ],
  platformTitle: "Was KreiswertS nicht tut",
  platformText:
    "KreiswertS bringt Unternehmen zusammen. Die Plattform nimmt nie Material in Besitz, ist kein Abfallmakler, bucht keinen Transport und prüft keinen rechtlichen Status – diese Entscheidungen bleiben bei den beteiligten Unternehmen.",
  sourcesTitle: "Quellen",
  sourcesIntro: "Originaltexte der Gesetze, frei zugänglich:",
  sources: [
    { label: "KrWG § 3 – Begriffsbestimmungen (Abfall)", href: `${LAW}/krwg/__3.html` },
    { label: "KrWG § 4 – Nebenprodukte", href: `${LAW}/krwg/__4.html` },
    { label: "KrWG § 5 – Ende der Abfalleigenschaft", href: `${LAW}/krwg/__5.html` },
    { label: "KrWG § 6 – Abfallhierarchie", href: `${LAW}/krwg/__6.html` },
    { label: "KrWG § 7 – Grundpflichten der Kreislaufwirtschaft", href: `${LAW}/krwg/__7.html` },
    { label: "KrWG § 22 – Beauftragung Dritter", href: `${LAW}/krwg/__22.html` },
    { label: "KrWG §§ 53–54 – Anzeige und Erlaubnis für Sammler, Beförderer, Händler, Makler", href: `${LAW}/krwg/__53.html` },
    { label: "AVV – Abfallverzeichnis-Verordnung (Abfallschlüssel)", href: `${LAW}/avv/` },
    { label: "PPWR (EU) 2025/40 – Art. 3 Begriffsbestimmungen, Art. 7 Mindestrezyklatanteil in Kunststoffverpackungen", href: "https://eur-lex.europa.eu/eli/reg/2025/40/oj/deu" },
  ],
};

export const guide: Record<Locale, GuideMessages> = { de, en };
