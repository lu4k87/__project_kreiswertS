// Fictional demo data (L1-021, D13): companies, sites, logins and listings that do not exist. Every site and
// listing is stored with provenance "synthetic" and shows that label in the app. No real company, person or
// address appears here – the repository is public.

/** Sites A, B and C of the user scenarios, D as a second branch of A's company, E waiting for verification. */
export const COMPANIES = [
  { key: "musterplast", name: "Musterplast Fertigung GmbH (fiktiv)", vatId: "DE000000001" },
  { key: "beispiel", name: "Beispiel Recycling GmbH (fiktiv)", vatId: "DE000000002" },
  { key: "demo", name: "Demo Formteile GmbH (fiktiv)", vatId: "DE000000003" },
  { key: "probe", name: "Probe Verpackung GmbH (fiktiv)", vatId: "DE000000004" },
];

export const SITES = [
  {
    key: "a", company: "musterplast", name: "Werk A", industry: "manufacturing", park: "nord-kamperbruch", status: "verified",
    street: "Musterstraße 1", postalCode: "47475", city: "Kamp-Lintfort", latitude: 51.5131, longitude: 6.5672,
    description: "Fiktiver Hersteller technischer Kunststoffteile (Standort A der Nutzerszenarien).",
    capabilities: ["cutting"], username: "site_a", contact: "Kontakt Werk A",
  },
  {
    key: "b", company: "beispiel", name: "Standort B", industry: "recycling", park: "genend", status: "verified",
    street: "Beispielweg 2", postalCode: "47441", city: "Moers", latitude: 51.4684, longitude: 6.6001,
    description: "Fiktiver Recyclingbetrieb: zerkleinert und mahlt HDPE (Standort B der Nutzerszenarien).",
    capabilities: ["grinding", "sorting", "regranulation"], username: "site_b", contact: "Kontakt Standort B",
  },
  {
    key: "c", company: "demo", name: "Werk C", industry: "manufacturing", park: "dieprahm", status: "verified",
    street: "Demoallee 3", postalCode: "47475", city: "Kamp-Lintfort", latitude: 51.4866, longitude: 6.5441,
    description: "Fiktiver Hersteller von Formteilen, sucht wiederkehrend HDPE-Mahlgut (Standort C der Nutzerszenarien).",
    capabilities: ["compounding"], username: "site_c", contact: "Kontakt Werk C",
  },
  {
    key: "d", company: "musterplast", name: "Werk D", industry: "manufacturing", park: "genend", status: "verified",
    street: "Probeweg 4", postalCode: "47441", city: "Moers", latitude: 51.4673, longitude: 6.5978,
    description: "Zweiter fiktiver Standort desselben Unternehmens wie Werk A – eigenes Konto, eigene Angebote.",
    capabilities: ["cutting"], username: "site_d", contact: "Kontakt Werk D",
  },
  {
    // no coordinates on purpose: an unknown position stays unknown until the administrator enters it
    key: "e", company: "probe", name: "Standort E", industry: "packaging", park: "businesspark-niederrhein", status: "pending",
    street: "Fantasiering 5", postalCode: "47228", city: "Duisburg", latitude: null, longitude: null,
    description: "Fiktiver Verpackungsbetrieb, wartet auf die Prüfung durch die Administration.",
    capabilities: [], username: "site_e", contact: "Kontakt Standort E",
  },
];

const collection = [{ term: "exw", place: "site" }, { term: "fca", place: "site" }];

/** Listings: the local 80 kg batch of scenario 2 and the five illustrative cases A–E. */
export const OFFERS = [
  {
    key: "hdpe-80", site: "d", title: "HDPE-Plattenabschnitte, sortenrein",
    description: "Sortenreine Abschnitte aus der Plattenbearbeitung, trocken gelagert. Kleine Charge zur Abholung.",
    type: "hdpe", form: "sheet", origin: "pre_consumer", legalStatus: "by_product",
    quantity: 80, unit: "kg", frequency: "one_time", priceMode: "quotation",
    delivery: collection, packaging: "pallets", loadingEquipment: "forklift", evidence: "self_declared", sample: "yes",
    attributes: { thickness: { min: 8, max: 12 }, colour: { text: "natur" } },
  },
  {
    key: "case-a", site: "c", title: "PC-Platten, Zuschnittreste klar",
    description: "Reststücke aus dem Plattenzuschnitt, einzeln foliert. Für die direkte Wiederverwendung in kleineren Formaten.",
    type: "pc", form: "sheet", origin: "pre_consumer", legalStatus: "by_product",
    quantity: 450, unit: "kg", minLot: 50, frequency: "one_time", priceMode: "fixed", priceAmount: 350, priceUnit: "t",
    delivery: [{ term: "fca", place: "site" }, { term: "dap", place: "Kamp-Lintfort und Umgebung" }], deliveryPricing: "quotation", maxDistance: 50,
    packaging: "pallets", loadingEquipment: "forklift", evidence: "documented", datasheet: true, sample: "yes",
    attributes: { thickness: { min: 3, max: 6 }, length: { min: 400, max: 1200 }, width: { min: 300, max: 800 }, coating: { text: "unbeschichtet" }, grade: { text: "PC klar, extrudiert" } },
  },
  {
    key: "case-b", site: "a", title: "LDPE-Stretchfolie aus dem Wareneingang",
    description: "Transparente Stretchfolie von Paletten, lose gesammelt. Menge fällt laufend an und eignet sich für eine gemeinsame Sammlung.",
    type: "ldpe", form: "film", origin: "post_consumer", legalStatus: "waste",
    quantity: 1.2, unit: "t", frequency: "recurring", period: "monthly", recurrenceQuantity: 1, priceMode: "free",
    delivery: [{ term: "exw", place: "site" }, { term: "custom", note: "Abholung im Rahmen einer gemeinsamen Sammeltour nach Absprache." }],
    packaging: "bales", loadingEquipment: "forklift", evidence: "self_declared", sample: "no",
    attributes: { layer_structure: { text: "single" }, labels_printing: { text: "vereinzelt Papieretiketten" } },
  },
  {
    key: "case-c", site: "c", title: "PC-Produktionsreste, gemahlen",
    description: "Gemahlene Angüsse und Fehlteile aus Polycarbonat. Schmelzflussrate nicht gemessen.",
    type: "pc", form: "regrind", origin: "pre_consumer", legalStatus: "by_product",
    quantity: 300, unit: "kg", frequency: "recurring", period: "quarterly", recurrenceQuantity: 300, priceMode: "negotiable",
    delivery: [{ term: "fca", place: "site" }], packaging: "big_bags", loadingEquipment: "forklift", evidence: "self_declared", sample: "yes",
    attributes: { particle_size: { min: 4, max: 10 }, contamination: { min: 2, comparator: "lt" } },
  },
  {
    key: "case-d", site: "d", title: "PVC-Profilabschnitte, weiß",
    description: "Abschnitte von Fensterprofilen, teilweise mit Dichtungsresten. Sortieren und Mahlen vor der Verwertung nötig.",
    type: "pvc", form: "sheet", origin: "pre_consumer", legalStatus: "waste", wasteCode: "07 02 13",
    quantity: 600, unit: "kg", frequency: "one_time", priceMode: "paid_recovery", priceAmount: 40, priceUnit: "t",
    delivery: collection, packaging: "boxes", loadingEquipment: "forklift", evidence: "self_declared", sample: "unknown",
    attributes: { colour: { text: "weiß" }, contamination: { min: 5, comparator: "lt" } },
  },
  {
    key: "case-e", site: "a", title: "Gemischte Verpackungskunststoffe, unsortiert",
    description: "Gemischte Verpackungsreste unbekannter Zusammensetzung. Ein Verwertungsweg ist noch nicht gefunden.",
    type: "mixed", form: "mixed", origin: "mixed", legalStatus: "waste",
    quantity: 2, unit: "t", frequency: "recurring", period: "monthly", recurrenceQuantity: 2, priceMode: "quotation",
    delivery: [{ term: "custom", note: "Abholung und Verwertung nach Absprache." }],
    packaging: "loose", loadingEquipment: "none", evidence: "unknown", sample: "unknown",
    attributes: {},
  },
];

/**
 * Level 2: independent material requests (L2-001). C needs HDPE regrind (an offer of sheet offcuts fits after
 * grinding), A needs PP only (every HDPE offer is incompatible), B takes PC residues (grade unknown → conditional).
 */
export const REQUESTS = [
  {
    key: "req-hdpe", site: "c", title: "HDPE-Mahlgut für Spritzguss, monatlich",
    description: "Für die Herstellung von Transportkisten. Mahlgut oder Granulat, sortenrein, möglichst aus der Produktion.",
    types: ["hdpe"], forms: ["regrind", "granulate"], origins: ["pre_consumer", "post_consumer"],
    quantity: 500, unit: "kg", minLot: 50, frequency: "recurring", period: "monthly",
    maxPrice: 450, maxPriceUnit: "t", delivery: ["dap", "fca"], evidence: "self_declared", sampleRequired: false,
    criteria: { contamination: { kind: "required", max: 2 }, melt_flow_rate: { kind: "preferred", min: 0.5, max: 8 } },
  },
  {
    key: "req-pp", site: "a", title: "PP-Granulat für Gehäuseteile",
    description: "Nur Polypropylen. Granulat für den Spritzguss von Gehäuseteilen, einmalige Menge.",
    types: ["pp"], forms: ["granulate"], origins: [],
    quantity: 1, unit: "t", minLot: null, frequency: "one_time", period: null,
    maxPrice: null, maxPriceUnit: null, delivery: ["dap"], evidence: "documented", sampleRequired: true,
    criteria: { moisture: { kind: "required", max: 0.2 } },
  },
  {
    key: "req-pc", site: "b", title: "PC-Reste zur Verwertung",
    description: "Wir nehmen Polycarbonat-Reste aus der Produktion zum Mahlen und Regranulieren an.",
    types: ["pc"], forms: ["regrind", "sheet"], origins: ["pre_consumer"],
    quantity: 1, unit: "t", minLot: 0.1, frequency: "recurring", period: "quarterly",
    maxPrice: null, maxPriceUnit: null, delivery: ["exw", "fca"], evidence: null, sampleRequired: false,
    criteria: { grade: { kind: "required", text: "PC" }, contamination: { kind: "required", max: 5 } },
  },
];

/** A response of site D to request C, pointing at its HDPE sheet offcuts (L2-003). */
export const RESPONSES = [
  {
    request: "req-hdpe", from: "d", offer: "hdpe-80",
    message: "Wir haben 80 kg HDPE-Plattenabschnitte. Gemahlen würden sie zu Ihrem Bedarf passen – Mahlen könnte Standort B übernehmen.",
  },
];

/**
 * Two simulated negotiations (L2-006, D13): C and D are still negotiating about D's HDPE offcuts for C's request;
 * B and A agreed on A's stretch film and planned an exchange. Demo data – never a real agreement or exchange.
 */
const hdpeTerms = {
  quantity: 80, unit: "kg", payment: "requester_pays", price: 300, priceUnit: "t", vat: "net",
  term: "fca", place: "Werk D, Probeweg 4, Moers", transport: "requester",
  freight: null, costStatus: null, freightPayer: null, share: null, technical: "Sortenrein, trocken, ohne Etiketten.",
};
export const NEGOTIATIONS = [
  {
    key: "hdpe", offer: "hdpe-80", request: "req-hdpe", offerer: "d", requester: "c", status: "open",
    revisions: [
      { by: "d", terms: hdpeTerms, note: "Abholung bei uns, Verladung mit Stapler." },
      {
        by: "c",
        terms: { ...hdpeTerms, price: 250, freight: 60, costStatus: "estimated", freightPayer: "shared", share: 50 },
        note: "Wir müssen das Material noch mahlen lassen – daher etwas weniger, und die Fracht teilen wir.",
      },
    ],
  },
  {
    key: "film", offer: "case-b", request: null, offerer: "a", requester: "b", status: "agreed",
    revisions: [
      {
        by: "b",
        terms: {
          quantity: 1.2, unit: "t", payment: "no_payment", price: null, priceUnit: null, vat: "net",
          term: "exw", place: "Werk A, Musterstraße 1, Kamp-Lintfort", transport: "requester",
          freight: 90, costStatus: "quoted", freightPayer: "requester", share: null, technical: "Folie in Ballen, ohne Fremdstoffe.",
        },
        note: "Wir holen die Ballen mit der nächsten Sammeltour ab.",
      },
    ],
    exchange: { plannedInDays: 10, note: "Abholung vormittags, Rampe 2." },
  },
];

/** The five illustrative cases of the presentation. Simulated pathways, never completed exchanges. */
export const CASES = [
  {
    code: "A", offer: "case-a", from: "c", to: "a", pathway: "direct_reuse",
    titleEn: "PC sheets – direct reuse", titleDe: "PC-Platten – direkte Wiederverwendung",
    textEn: "Offcuts from one manufacturer could be cut to size and used by another manufacturer nearby.",
    textDe: "Zuschnittreste eines Herstellers könnten von einem Hersteller in der Nähe auf Maß geschnitten und weiterverwendet werden.",
  },
  {
    code: "B", offer: "case-b", from: "a", to: "b", pathway: "pooled_recycling",
    titleEn: "PE film – pooled recycling", titleDe: "PE-Folie – gemeinsame Verwertung",
    textEn: "Small amounts of film from several sites could be collected together and recycled as one batch.",
    textDe: "Kleine Folienmengen mehrerer Standorte könnten gemeinsam gesammelt und als eine Charge verwertet werden.",
  },
  {
    code: "C", offer: "case-c", from: "c", to: null, pathway: "specialist_recycling",
    titleEn: "PC residues – specialist recycling", titleDe: "PC-Reste – spezialisierte Verwertung",
    textEn: "Ground polycarbonate needs a specialised recycler; none is registered on the platform yet.",
    textDe: "Gemahlenes Polycarbonat braucht einen spezialisierten Verwerter; auf der Plattform ist noch keiner registriert.",
  },
  {
    code: "D", offer: "case-d", from: "d", to: "b", pathway: "sorting_grinding",
    titleEn: "PVC profiles – sorting and grinding", titleDe: "PVC-Profile – Sortieren und Mahlen",
    textEn: "Profile offcuts could be sorted and ground by a recycler before they are used again.",
    textDe: "Profilabschnitte könnten von einem Recyclingbetrieb sortiert und gemahlen werden, bevor sie wieder eingesetzt werden.",
  },
  {
    code: "E", offer: "case-e", from: "a", to: null, pathway: "unresolved",
    titleEn: "Mixed packaging – unresolved", titleDe: "Gemischte Verpackungen – ungelöst",
    textEn: "The composition is unknown, so no suitable use has been found. The listing stays open as it is.",
    textDe: "Die Zusammensetzung ist unbekannt, deshalb ist kein passender Weg gefunden. Das Angebot bleibt unverändert offen.",
  },
];

export const DEMO_EMAIL_DOMAIN = "kreiswerts.example"; // .example is reserved (RFC 2606) – no mail can reach it
export const ADMIN = { username: "admin_demo", name: "Demo-Administration" };
