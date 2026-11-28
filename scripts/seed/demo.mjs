// Fictional demo data (L1-021, D13): companies, sites, logins and listings that do not exist. Every site and
// listing is stored with provenance "synthetic" and shows that label in the app. No real company, person or
// address appears here – the repository is public. One exception on the user's wish (2026-11-28): the university
// of the project takes part with its two campus sites – public addresses, fictional contacts, "(fiktiv)" like the rest.

/**
 * Sites A, B and C of the user scenarios, D as a second branch of A's company, E waiting for verification; F–L
 * widen the region to eleven companies (project goal: at least ten documented companies) – each takes a role in
 * one of the cases A–E: further sources, takers and processors of the same material flows. The university's two campus
 * sites (logins hsrw, hsrw_kamp) start without listings.
 */
export const COMPANIES = [
  { key: "musterplast", name: "Musterplast Fertigung GmbH (fiktiv)", vatId: "DE000000001" },
  { key: "beispiel", name: "Beispiel Recycling GmbH (fiktiv)", vatId: "DE000000002" },
  { key: "demo", name: "Demo Formteile GmbH (fiktiv)", vatId: "DE000000003" },
  { key: "probe", name: "Probe Verpackung GmbH (fiktiv)", vatId: "DE000000004" },
  { key: "platzhalter", name: "Platzhalter Logistik GmbH (fiktiv)", vatId: "DE000000005" },
  { key: "modell", name: "Modell Kunststofftechnik GmbH (fiktiv)", vatId: "DE000000006" },
  { key: "testfeld", name: "Testfeld Bau GmbH (fiktiv)", vatId: "DE000000007" },
  { key: "vorlage", name: "Vorlage Compound GmbH (fiktiv)", vatId: "DE000000008" },
  { key: "entwurf", name: "Entwurf Verpackung KG (fiktiv)", vatId: "DE000000009" },
  { key: "skizze", name: "Skizze Gerätebau GmbH (fiktiv)", vatId: "DE000000010" },
  { key: "fantasie", name: "Fantasie Sortiertechnik GmbH (fiktiv)", vatId: "DE000000011" },
  { key: "hsrw", name: "Hochschule Rhein-Waal (fiktiv)", vatId: "DE000000012" },
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
  {
    key: "f", company: "platzhalter", name: "Lager F", industry: "logistics", park: "businesspark-niederrhein", status: "verified",
    street: "Platzhalterweg 6", postalCode: "47228", city: "Duisburg", latitude: 51.4205, longitude: 6.6812,
    description: "Fiktives Logistiklager: Stretchfolie aus dem Warenumschlag, zweite Quelle für die gemeinsame Sammlung (Fall B).",
    capabilities: ["sorting"], username: "site_f", contact: "Kontakt Lager F",
  },
  {
    key: "g", company: "modell", name: "Werk G", industry: "manufacturing", park: "dieprahm", status: "verified",
    street: "Modellring 7", postalCode: "47475", city: "Kamp-Lintfort", latitude: 51.4881, longitude: 6.5468,
    description: "Fiktiver Hersteller von Schutzabdeckungen: gibt PMMA-Reste ab und nimmt PC-Platten zur Wiederverwendung (Fall A).",
    capabilities: ["cutting"], username: "site_g", contact: "Kontakt Werk G",
  },
  {
    key: "h", company: "testfeld", name: "Bauhof H", industry: "construction", park: "genend", status: "verified",
    street: "Testfeldstraße 8", postalCode: "47441", city: "Moers", latitude: 51.4701, longitude: 6.5968,
    description: "Fiktiver Baubetrieb: PVC-Rohrabschnitte von Baustellen, sucht PVC-Mahlgut für Profile (Fall D).",
    capabilities: [], username: "site_h", contact: "Kontakt Bauhof H",
  },
  {
    key: "i", company: "vorlage", name: "Compoundierwerk I", industry: "recycling", park: "nord-kamperbruch", status: "verified",
    street: "Vorlagenallee 9", postalCode: "47475", city: "Kamp-Lintfort", latitude: 51.5112, longitude: 6.5641,
    description: "Fiktiver Compoundeur: regranuliert ABS und PS aus der Produktion und verkauft das Regranulat weiter.",
    capabilities: ["regranulation", "compounding"], username: "site_i", contact: "Kontakt Compoundierwerk I",
  },
  {
    key: "j", company: "entwurf", name: "Standort J", industry: "packaging", park: "businesspark-niederrhein", status: "verified",
    street: "Entwurfstraße 10", postalCode: "47228", city: "Duisburg", latitude: 51.4178, longitude: 6.6858,
    description: "Fiktiver Verpackungshersteller: PET-Stanzgitter aus dem Tiefziehen, sucht LLDPE-Mahlgut für Folien (Fall B).",
    capabilities: [], username: "site_j", contact: "Kontakt Standort J",
  },
  {
    key: "k", company: "skizze", name: "Werk K", industry: "manufacturing", park: "nord-kamperbruch", status: "verified",
    street: "Skizzenweg 11", postalCode: "47475", city: "Kamp-Lintfort", latitude: 51.514, longitude: 6.5629,
    description: "Fiktiver Gerätehersteller: ABS-Gehäuse aus Fehlchargen und gemischte Teile aus der Demontage (Fall E).",
    capabilities: [], username: "site_k", contact: "Kontakt Werk K",
  },
  {
    // outside every industrial park on purpose: a site does not need one
    key: "l", company: "fantasie", name: "Sortieranlage L", industry: "recycling", park: null, status: "verified",
    street: "Fantasieweg 12", postalCode: "47506", city: "Neukirchen-Vluyn", latitude: 51.446, longitude: 6.548,
    description: "Fiktiver Sortier- und Mahlbetrieb außerhalb der Gewerbegebiete: gibt LLDPE-Mahlgut ab, sammelt PE-Folien (Fälle B und D).",
    capabilities: ["sorting", "grinding"], username: "site_l", contact: "Kontakt Sortieranlage L",
  },
  {
    key: "hsrw-kleve", company: "hsrw", name: "Campus Kleve", industry: "manufacturing", park: null, status: "verified",
    street: "Marie-Curie-Straße 1", postalCode: "47533", city: "Kleve", latitude: 51.795126, longitude: 6.142635,
    description: "Hochschule als Teilnehmerin: Labore und Werkstätten des Campus Kleve (Demo-Zugang, noch ohne Inserate).",
    capabilities: [], username: "hsrw", contact: "Kontakt Campus Kleve",
  },
  {
    key: "hsrw-kamp", company: "hsrw", name: "Campus Kamp-Lintfort", industry: "manufacturing", park: null, status: "verified",
    street: "Friedrich-Heinrich-Allee 25", postalCode: "47475", city: "Kamp-Lintfort", latitude: 51.500411, longitude: 6.545785,
    description: "Zweiter Standort der Hochschule: Labore und Werkstätten des Campus Kamp-Lintfort (Demo-Zugang, noch ohne Inserate).",
    capabilities: [], username: "hsrw_kamp", contact: "Kontakt Campus Kamp-Lintfort",
  },
];

const collection = [{ term: "exw", place: "site" }, { term: "fca", place: "site" }];

/** Listings: the local 80 kg batch of scenario 2, a second HDPE sheet batch (with it a collection group, L2-010),
 * the five illustrative cases A–E and the listings of sites F–L around them. The acceptance runs count on some
 * gaps – no further HDPE sheet, LDPE or PVC regrind and no PP offer near the scenario sites – keep them when adding. */
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
    key: "hdpe-200", site: "c", title: "HDPE-Plattenreste, schwarz",
    description: "Reste aus dem Zuschnitt schwarzer HDPE-Platten, sortenrein und sauber. Abholung nach Absprache.",
    type: "hdpe", form: "sheet", origin: "pre_consumer", legalStatus: "by_product",
    quantity: 200, unit: "kg", frequency: "one_time", priceMode: "negotiable",
    delivery: collection, packaging: "boxes", loadingEquipment: "forklift", evidence: "self_declared", sample: "yes",
    attributes: { thickness: { min: 4, max: 10 }, colour: { text: "schwarz" } },
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
  {
    key: "film-f", site: "f", title: "LDPE-Stretchfolie aus dem Lagerumschlag",
    description: "Transparente Stretchfolie von eingehenden Paletten, gepresst. Passt zur gemeinsamen Sammeltour mit Werk A.",
    type: "ldpe", form: "film", origin: "post_consumer", legalStatus: "waste", wasteCode: "15 01 02",
    quantity: 0.8, unit: "t", frequency: "recurring", period: "monthly", recurrenceQuantity: 0.8, priceMode: "free",
    delivery: [{ term: "exw", place: "site" }, { term: "custom", note: "Abholung im Rahmen einer gemeinsamen Sammeltour nach Absprache." }],
    packaging: "bales", loadingEquipment: "ramp", evidence: "self_declared", sample: "no",
    attributes: { layer_structure: { text: "single" }, colour: { text: "transparent" } },
  },
  {
    key: "pmma-g", site: "g", title: "PMMA-Zuschnittreste, farblos",
    description: "Reststücke aus dem Zuschnitt von Acrylglasplatten, beidseitig foliert. Für kleinere Formate direkt wiederverwendbar.",
    type: "pmma", form: "sheet", origin: "pre_consumer", legalStatus: "by_product",
    quantity: 250, unit: "kg", minLot: 25, frequency: "one_time", priceMode: "fixed", priceAmount: 500, priceUnit: "t",
    delivery: [{ term: "fca", place: "site" }, { term: "dap", place: "Kamp-Lintfort und Umgebung" }], deliveryPricing: "quotation", maxDistance: 30,
    packaging: "pallets", loadingEquipment: "forklift", evidence: "documented", datasheet: true, sample: "yes",
    attributes: { thickness: { min: 3, max: 8 }, length: { min: 300, max: 1000 }, width: { min: 200, max: 600 }, coating: { text: "Schutzfolie beidseitig" } },
  },
  {
    key: "pvc-h", site: "h", title: "PVC-Rohrabschnitte von Baustellen",
    description: "Abschnitte von Abwasserrohren, teils mit Mörtelresten. Vor der Verwertung sortieren, reinigen und mahlen.",
    type: "pvc", form: "component", origin: "post_consumer", legalStatus: "waste", wasteCode: "17 02 03",
    quantity: 900, unit: "kg", frequency: "one_time", priceMode: "paid_recovery", priceAmount: 35, priceUnit: "t",
    delivery: collection, packaging: "boxes", loadingEquipment: "crane", evidence: "self_declared", sample: "unknown",
    attributes: { dimensions: { text: "DN 100–200, 0,5–2 m lang" }, condition: { text: "verschmutzt, Mörtelreste" }, contamination: { min: 10, comparator: "lt" } },
  },
  {
    key: "abs-i", site: "i", title: "ABS-Regranulat, schwarz",
    description: "Regranulat aus sortenreinen ABS-Produktionsresten, getrocknet. Laufende Menge, Datenblatt auf Anfrage.",
    type: "abs", form: "granulate", origin: "pre_consumer", legalStatus: "product",
    quantity: 1.5, unit: "t", minLot: 0.25, frequency: "recurring", period: "monthly", recurrenceQuantity: 1, priceMode: "fixed", priceAmount: 900, priceUnit: "t",
    delivery: [{ term: "fca", place: "site" }, { term: "dap", place: "Niederrhein, bis 50 km" }], deliveryPricing: "negotiable", maxDistance: 50,
    packaging: "big_bags", loadingEquipment: "forklift", evidence: "tested", datasheet: true, sample: "yes",
    attributes: { melt_flow_rate: { min: 18 }, mfr_test_conditions: { text: "220 °C / 10 kg" }, moisture: { min: 0.1, comparator: "lt" }, colour: { text: "schwarz" } },
  },
  {
    key: "pet-j", site: "j", title: "PET-Stanzgitter aus dem Tiefziehen",
    description: "Sortenreine Stanzgitter aus der Schalenfertigung, aufgerollt. Fällt jede Woche an.",
    type: "pet", form: "film", origin: "pre_consumer", legalStatus: "by_product",
    quantity: 400, unit: "kg", frequency: "recurring", period: "monthly", recurrenceQuantity: 400, priceMode: "negotiable", priceAmount: 150, priceUnit: "t",
    delivery: collection, packaging: "rolls", loadingEquipment: "forklift", evidence: "self_declared", sample: "yes",
    attributes: { film_thickness: { min: 300, max: 500 }, layer_structure: { text: "single" }, colour: { text: "transparent" } },
  },
  {
    key: "abs-k", site: "k", title: "ABS-Gehäuseteile, Fehlcharge",
    description: "Gehäuseschalen mit Maßabweichung, sonst einwandfrei. Als Bauteil weiterverwendbar oder zum Regranulieren.",
    type: "abs", form: "component", origin: "pre_consumer", legalStatus: "by_product",
    quantity: 180, unit: "kg", frequency: "one_time", priceMode: "quotation",
    delivery: collection, packaging: "boxes", loadingEquipment: "forklift", evidence: "self_declared", sample: "yes",
    attributes: { unit_count: { min: 600 }, dimensions: { text: "ca. 200 × 120 × 40 mm" }, condition: { text: "Maßabweichung, unbenutzt" } },
  },
  {
    key: "mixed-k", site: "k", title: "Gemischte Kunststoffteile aus der Demontage",
    description: "Kunststoffteile aus zerlegten Altgeräten, Zusammensetzung unbekannt, mit Metallresten. Ein Weg ist noch offen.",
    type: "mixed", form: "mixed", origin: "post_consumer", legalStatus: "waste",
    quantity: 1, unit: "t", frequency: "recurring", period: "quarterly", recurrenceQuantity: 1, priceMode: "quotation",
    delivery: [{ term: "custom", note: "Abholung und Verwertung nach Absprache." }],
    packaging: "loose", loadingEquipment: "none", evidence: "unknown", sample: "unknown",
    attributes: { sorting_requirements: { text: "Handsortierung nötig, Metallteile enthalten" } },
  },
  {
    key: "lldpe-l", site: "l", title: "LLDPE-Mahlgut aus Folienrecycling",
    description: "Gewaschenes Mahlgut aus gesammelten Stretchfolien. Laufende Menge, Probe möglich.",
    type: "lldpe", form: "regrind", origin: "post_consumer", legalStatus: "end_of_waste",
    quantity: 2, unit: "t", frequency: "recurring", period: "monthly", recurrenceQuantity: 2, priceMode: "negotiable", priceAmount: 380, priceUnit: "t",
    delivery: [{ term: "fca", place: "site" }], packaging: "big_bags", loadingEquipment: "forklift", evidence: "tested", datasheet: true, sample: "yes",
    attributes: { particle_size: { min: 6, max: 10 }, contamination: { min: 1, comparator: "lt" }, moisture: { min: 0.5, comparator: "lt" } },
  },
];

/**
 * Level 2: independent material requests (L2-001). C needs HDPE regrind (an offer of sheet offcuts fits after
 * grinding), A needs PP only (every HDPE offer is incompatible), B takes PC residues (grade unknown → conditional).
 * G, H, I, J and L ask for the material that the cases A–E lead to.
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
  {
    key: "req-pc-g", site: "g", title: "PC-Platten für Schutzabdeckungen",
    description: "Klare Polycarbonat-Platten, auch Reststücke, zum Zuschnitt auf kleinere Formate.",
    types: ["pc"], forms: ["sheet"], origins: ["pre_consumer"],
    quantity: 200, unit: "kg", minLot: 20, frequency: "one_time", period: null,
    maxPrice: 400, maxPriceUnit: "t", delivery: ["fca", "dap"], evidence: "self_declared", sampleRequired: true,
    criteria: { thickness: { kind: "required", min: 3, max: 6 }, colour: { kind: "preferred", text: "klar" } },
  },
  {
    key: "req-pvc-h", site: "h", title: "PVC-Mahlgut für Bauprofile",
    description: "Sauberes PVC-Mahlgut für die Extrusion von Profilen, vierteljährlich.",
    types: ["pvc"], forms: ["regrind"], origins: ["pre_consumer", "post_consumer"],
    quantity: 2, unit: "t", minLot: 0.5, frequency: "recurring", period: "quarterly",
    maxPrice: 300, maxPriceUnit: "t", delivery: ["dap"], evidence: "documented", sampleRequired: true,
    criteria: { contamination: { kind: "required", max: 1 } },
  },
  {
    key: "req-abs-i", site: "i", title: "ABS- und PS-Teile zur Regranulierung",
    description: "Wir nehmen sortenreine ABS- und PS-Teile oder Mahlgut aus der Produktion zum Regranulieren an.",
    types: ["abs", "ps"], forms: ["component", "regrind"], origins: ["pre_consumer"],
    quantity: 1, unit: "t", minLot: 0.1, frequency: "recurring", period: "monthly",
    maxPrice: null, maxPriceUnit: null, delivery: ["exw", "fca"], evidence: null, sampleRequired: false,
    criteria: { contamination: { kind: "required", max: 5 } },
  },
  {
    key: "req-lldpe-j", site: "j", title: "LLDPE-Mahlgut für die Folienextrusion",
    description: "Mahlgut oder Granulat aus LLDPE für eine Rezyklat-Schicht in Verpackungsfolien.",
    types: ["lldpe"], forms: ["regrind", "granulate"], origins: ["pre_consumer", "post_consumer"],
    quantity: 1.5, unit: "t", minLot: 0.5, frequency: "recurring", period: "monthly",
    maxPrice: 420, maxPriceUnit: "t", delivery: ["dap", "fca"], evidence: "tested", sampleRequired: true,
    criteria: { moisture: { kind: "required", max: 0.5 }, melt_flow_rate: { kind: "preferred", min: 0.5, max: 2 } },
  },
  {
    key: "req-film-l", site: "l", title: "PE-Folien für die gemeinsame Sammeltour",
    description: "Wir sammeln Stretch- und Schrumpffolien mehrerer Standorte in einer Tour und verwerten sie als eine Charge.",
    types: ["ldpe", "lldpe"], forms: ["film"], origins: ["pre_consumer", "post_consumer"],
    quantity: 3, unit: "t", minLot: 0.2, frequency: "recurring", period: "monthly",
    maxPrice: null, maxPriceUnit: null, delivery: ["exw"], evidence: null, sampleRequired: false,
    criteria: { layer_structure: { kind: "preferred", text: "single" } },
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
