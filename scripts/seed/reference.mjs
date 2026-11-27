// Reference data of Level 1 (D04, X-06): material catalogue, units and industrial parks. Everything here is data –
// a new category, attribute or region is added by editing this file and running `npm run db:seed` again.

export const UNITS = [
  { key: "kg", nameEn: "kg", nameDe: "kg", dimension: "mass", toBase: 1 },
  { key: "t", nameEn: "t", nameDe: "t", dimension: "mass", toBase: 1000 },
  { key: "item", nameEn: "items", nameDe: "Stück", dimension: "count", toBase: 1 },
  { key: "m3", nameEn: "m³", nameDe: "m³", dimension: "volume", toBase: 1 },
  { key: "m2", nameEn: "m²", nameDe: "m²", dimension: "area", toBase: 1 },
];

const text = (key, nameEn, nameDe, extra = {}) => ({ key, nameEn, nameDe, dataType: "text", ...extra });
const number = (key, nameEn, nameDe, unit, extra = {}) => ({ key, nameEn, nameDe, dataType: "number", unit, ...extra });
const range = (key, nameEn, nameDe, unit, extra = {}) => ({ key, nameEn, nameDe, dataType: "range", unit, minValue: 0, ...extra });

/** Only `plastics` is enabled in Level 1. `metals` is configured but disabled: proof that a category is data only. */
export const CATEGORIES = [
  {
    key: "plastics",
    nameEn: "Plastics",
    nameDe: "Kunststoffe",
    enabled: true,
    units: ["kg", "t", "item"],
    types: [
      ["hdpe", "HDPE", "HDPE"],
      ["ldpe", "LDPE", "LDPE"],
      ["lldpe", "LLDPE", "LLDPE"],
      ["pp", "PP", "PP"],
      ["pet", "PET", "PET"],
      ["pc", "PC", "PC"],
      ["pmma", "PMMA", "PMMA"],
      ["pvc", "PVC", "PVC"],
      ["abs", "ABS", "ABS"],
      ["ps", "PS", "PS"],
      ["other", "Other polymers", "Andere Polymere"],
      ["mixed", "Mixed plastics", "Gemischte Kunststoffe"],
      ["unknown", "Unknown", "Unbekannt"],
    ],
    forms: [
      ["sheet", "Sheets / offcuts", "Platten / Abschnitte"],
      ["granulate", "Granulate", "Granulat"],
      ["regrind", "Regrind", "Mahlgut"],
      ["film", "Film", "Folie"],
      ["component", "Components", "Bauteile"],
      ["mixed", "Mixed residues", "Gemischte Reststoffe"],
      ["other", "Other form", "Andere Form"],
    ],
    attributes: [
      text("grade", "Grade", "Type / Sorte", { critical: true }),
      text("colour", "Colour", "Farbe"),
      number("contamination", "Contamination", "Verunreinigung", "%", { minValue: 0, maxValue: 100 }),
      text("additives", "Additives", "Additive"),
      range("length", "Length", "Länge", "mm", { forms: ["sheet"] }),
      range("width", "Width", "Breite", "mm", { forms: ["sheet"] }),
      range("thickness", "Thickness", "Dicke", "mm", { forms: ["sheet"] }),
      text("coating", "Coating / surface", "Beschichtung / Oberfläche", { forms: ["sheet"] }),
      number("melt_flow_rate", "Melt flow rate (MFR)", "Schmelzflussrate (MFR)", "g/10 min", {
        minValue: 0,
        forms: ["granulate", "regrind"],
        critical: true,
      }),
      text("mfr_test_conditions", "Melt flow test conditions", "MFR-Prüfbedingungen", {
        forms: ["granulate", "regrind"],
        requiredWith: "melt_flow_rate",
      }),
      number("density", "Density", "Dichte", "kg/m³", { minValue: 0, forms: ["granulate"] }),
      number("moisture", "Moisture", "Feuchte", "%", { minValue: 0, maxValue: 100, forms: ["granulate", "regrind"] }),
      range("particle_size", "Particle size", "Korngröße", "mm", { forms: ["regrind"] }),
      range("film_thickness", "Film thickness", "Foliendicke", "µm", { forms: ["film"] }),
      {
        key: "layer_structure",
        nameEn: "Layer structure",
        nameDe: "Schichtaufbau",
        dataType: "enum",
        forms: ["film"],
        options: [
          { value: "single", en: "Single layer", de: "Einschichtig" },
          { value: "multilayer", en: "Multilayer", de: "Mehrschichtig" },
        ],
      },
      text("labels_printing", "Labels, adhesives, printing", "Etiketten, Klebstoffe, Druck", { forms: ["film"] }),
      text("dimensions", "Dimensions", "Abmessungen", { forms: ["component"] }),
      { key: "unit_count", nameEn: "Number of parts", nameDe: "Stückzahl", dataType: "integer", minValue: 1, forms: ["component"] },
      text("condition", "Condition / function", "Zustand / Funktion", { forms: ["component"] }),
      text("polymer_fractions", "Polymer fractions", "Polymeranteile", { forms: ["mixed"], critical: true }),
      text("sorting_requirements", "Sorting requirements", "Sortieraufwand", { forms: ["mixed"] }),
    ],
  },
  {
    key: "metals",
    nameEn: "Metals",
    nameDe: "Metalle",
    enabled: false,
    units: ["kg", "t"],
    types: [
      ["aluminium", "Aluminium", "Aluminium"],
      ["steel", "Steel", "Stahl"],
      ["copper", "Copper", "Kupfer"],
    ],
    forms: [
      ["sheet", "Sheets / offcuts", "Bleche / Abschnitte"],
      ["swarf", "Swarf", "Späne"],
    ],
    attributes: [
      text("alloy", "Alloy", "Legierung", { critical: true }),
      range("thickness", "Thickness", "Dicke", "mm", { forms: ["sheet"] }),
      text("oil_residue", "Oil or coolant residue", "Öl- oder Kühlmittelreste", { forms: ["swarf"] }),
    ],
  },
  { key: "wood", nameEn: "Wood", nameDe: "Holz", enabled: false },
  { key: "paper", nameEn: "Paper and cardboard", nameDe: "Papier und Karton", enabled: false },
  { key: "glass", nameEn: "Glass", nameDe: "Glas", enabled: false },
  { key: "textiles", nameEn: "Textiles", nameDe: "Textilien", enabled: false },
  { key: "minerals", nameEn: "Mineral materials", nameDe: "Mineralische Stoffe", enabled: false },
  { key: "surplus", nameEn: "Surplus products", nameDe: "Überschussprodukte", enabled: false },
  { key: "electronics", nameEn: "Electronics", nameDe: "Elektronik", enabled: false },
];

const APPROXIMATE = "Approximate centre from public descriptions of the area (2026-11-26); verify boundaries before real use.";

/** Industrial parks of the region. Positions are approximate centres, not surveyed boundaries (D10). */
export const PARKS = [
  { slug: "nord-kamperbruch", name: "Gewerbegebiet Nord-Kamperbruch", city: "Kamp-Lintfort", latitude: 51.5125, longitude: 6.566, radiusM: 700, sourceNote: APPROXIMATE },
  { slug: "dieprahm", name: "Technologiepark Dieprahm", city: "Kamp-Lintfort", latitude: 51.487, longitude: 6.545, radiusM: 500, sourceNote: APPROXIMATE },
  { slug: "genend", name: "Grafschafter Gewerbepark Genend", city: "Moers", latitude: 51.468, longitude: 6.599, radiusM: 600, sourceNote: APPROXIMATE },
  { slug: "businesspark-niederrhein", name: "Businesspark Niederrhein", city: "Duisburg", latitude: 51.419, longitude: 6.683, radiusM: 600, sourceNote: APPROXIMATE },
];

const EXAMPLE_SOURCE = "Example value, not sourced – an illustration for the prototype, not a published factor (decided 2026-11-27).";

/**
 * Emission factors for the environmental assessment (L2-008, D18). DEMO VALUES ONLY: every one is an example
 * value without a source, stored with `example = true` and shown as such. Replace them with sourced factors
 * (new key or new version) before any real use.
 */
export const FACTORS = [
  ["virgin-pe", "Virgin polyethylene granulate (HDPE, LDPE), production", "Neuware Polyethylen-Granulat (HDPE, LDPE), Herstellung", "virgin_production", 1.8, "kg_co2e_per_kg", "cradle_to_gate"],
  ["virgin-pp", "Virgin polypropylene granulate, production", "Neuware Polypropylen-Granulat, Herstellung", "virgin_production", 1.6, "kg_co2e_per_kg", "cradle_to_gate"],
  ["virgin-pc", "Virgin polycarbonate granulate, production", "Neuware Polycarbonat-Granulat, Herstellung", "virgin_production", 3.4, "kg_co2e_per_kg", "cradle_to_gate"],
  ["virgin-pvc", "Virgin PVC compound, production", "Neuware PVC-Compound, Herstellung", "virgin_production", 2.0, "kg_co2e_per_kg", "cradle_to_gate"],
  ["sorting", "Sorting", "Sortierung", "processing", 0.05, "kg_co2e_per_kg", "gate_to_gate"],
  ["grinding", "Grinding to regrind", "Mahlen zu Mahlgut", "processing", 0.08, "kg_co2e_per_kg", "gate_to_gate"],
  ["regranulation", "Regranulation", "Regranulierung", "processing", 0.35, "kg_co2e_per_kg", "gate_to_gate"],
  ["incineration-plastics", "Incineration of plastic waste", "Verbrennung von Kunststoffabfall", "treatment", 2.3, "kg_co2e_per_kg", "end_of_life"],
  ["truck-transport", "Truck transport, 16–32 t", "Lkw-Transport, 16–32 t", "transport", 0.11, "kg_co2e_per_tkm", "transport"],
].map(([key, nameEn, nameDe, kind, value, unit, boundary]) => ({
  key, version: "example-2026-11", nameEn, nameDe, kind, value, unit, geography: "Germany (example)", boundary, source: EXAMPLE_SOURCE, sourceUrl: null, example: true,
}));

/**
 * Sourced emission factors (D18): every value was read from the public document named in `sourceUrl` on
 * 2026-11-27 – never estimated. A factor is only added here when its value, unit, geography and system boundary can
 * be checked in that document; the others above stay example values. A stored key/version never changes: a newer
 * edition of a source is a new version.
 *
 * - UBA table "Vergleich der durchschnittlichen Emissionen einzelner Verkehrsmittel im Güterverkehr in Deutschland
 *   2024", source TREMOD 6.71B (10/2025): greenhouse gases in CO₂e (AR5) in g per tonne-kilometre, including the
 *   supply and conversion of the energy carriers. Lkw gesamt (≥ 3.5 t, articulated and road trains) 118 g/tkm;
 *   Last- & Sattelzüge 101 g/tkm.
 * - IPCC 2006 Guidelines, Vol. 5, Ch. 5, Equation 5.1 with the defaults for plastics of Table 2.4 (Ch. 2: dry matter
 *   100 %, total carbon 75 % of dry weight, fossil carbon 100 %) and the oxidation factor for incineration of
 *   Table 5.2 (100 %): 1.00 × 0.75 × 1.00 × 1.00 × 44/12 = 2.75 kg fossil CO₂ per kg. Direct CO₂ of combustion
 *   only – no CH₄/N₂O, no credit for recovered energy.
 * - Plastics Europe / ECVM Eco-profile "Vinyl chloride (VCM) and polyvinyl chloride (PVC)", December 2022, revised
 *   January 2026, Table 14 (EF 3.1): climate change 2.08 kg CO₂e per kg suspension PVC (S-PVC), cradle to gate,
 *   European production.
 */
export const SOURCED_FACTORS = [
  {
    key: "truck-transport-uba", version: "TREMOD-6.71B-2024", nameEn: "Truck transport, average of all trucks (Germany)", nameDe: "Lkw-Transport, Durchschnitt aller Lkw (Deutschland)",
    kind: "transport", value: 0.118, unit: "kg_co2e_per_tkm", geography: "Germany, 2024", boundary: "transport",
    source: "Umweltbundesamt (UBA): Vergleich der durchschnittlichen Emissionen einzelner Verkehrsmittel im Güterverkehr in Deutschland 2024, TREMOD 6.71B (10/2025) – Lkw gesamt (≥ 3.5 t, Sattel- und Lastzüge), 118 g CO₂e/tkm (AR5) incl. energy supply",
    sourceUrl: "https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_gv_tab_pdf_0.pdf",
  },
  {
    key: "truck-articulated-uba", version: "TREMOD-6.71B-2024", nameEn: "Truck transport, articulated and road trains (Germany)", nameDe: "Lkw-Transport, Last- und Sattelzüge (Deutschland)",
    kind: "transport", value: 0.101, unit: "kg_co2e_per_tkm", geography: "Germany, 2024", boundary: "transport",
    source: "Umweltbundesamt (UBA): Vergleich der durchschnittlichen Emissionen einzelner Verkehrsmittel im Güterverkehr in Deutschland 2024, TREMOD 6.71B (10/2025) – Last- & Sattelzüge, 101 g CO₂e/tkm (AR5) incl. energy supply",
    sourceUrl: "https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_gv_tab_pdf_0.pdf",
  },
  {
    key: "incineration-plastics-ipcc", version: "IPCC-2006-V5", nameEn: "Incineration of plastic waste, fossil CO₂ of combustion", nameDe: "Verbrennung von Kunststoffabfall, fossiles CO₂ der Verbrennung",
    kind: "treatment", value: 2.75, unit: "kg_co2e_per_kg", geography: "Global default (IPCC)", boundary: "end_of_life",
    source: "IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol. 5: Equation 5.1 with Table 2.4 (plastics: dry matter 100 %, total carbon 75 %, fossil carbon 100 %) and Table 5.2 (oxidation factor 100 %) → 0.75 × 44/12 = 2.75 kg CO₂/kg; combustion CO₂ only, no energy credit",
    sourceUrl: "https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/5_Volume5/V5_5_Ch5_IOB.pdf",
  },
  {
    key: "virgin-s-pvc", version: "EF3.1-2026-01", nameEn: "Virgin suspension PVC (S-PVC), production", nameDe: "Neuware Suspensions-PVC (S-PVC), Herstellung",
    kind: "virgin_production", value: 2.08, unit: "kg_co2e_per_kg", geography: "Europe", boundary: "cradle_to_gate",
    source: "Plastics Europe / ECVM: Eco-profile Vinyl chloride (VCM) and Polyvinyl chloride (PVC), December 2022, revised January 2026, Table 14 (EF 3.1): climate change 2.08 kg CO₂e per kg S-PVC",
    sourceUrl: "https://pvc.org/wp-content/uploads/2026/03/CVM-and-PVC_Eco-profile-PVC-2026.pdf",
  },
];
