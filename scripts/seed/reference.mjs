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
