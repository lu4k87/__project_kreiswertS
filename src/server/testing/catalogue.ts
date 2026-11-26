// Small catalogue for unit tests: plastics (enabled) with the attributes the rules distinguish, metals (disabled).
// Mirrors the shape of the seed (scripts/seed/reference.mjs) without needing a database.
import type { AttributeDefinition, Catalogue } from "../domain/catalogue";

const attribute = (id: number, categoryId: number, key: string, extra: Partial<AttributeDefinition> = {}): AttributeDefinition => ({
  id,
  categoryId,
  key,
  nameEn: key,
  nameDe: key,
  dataType: "text",
  unit: null,
  minValue: null,
  maxValue: null,
  options: [],
  forms: [],
  required: false,
  critical: false,
  requiredWith: null,
  ...extra,
});

export const PLASTICS = 1;
export const METALS = 2;
export const HDPE = 10;
export const ALUMINIUM = 20;
export const SHEET = 100;
export const REGRIND = 101;
export const FILM = 102;
export const METAL_SHEET = 200;

export const testCatalogue: Catalogue = {
  categories: [
    { id: PLASTICS, key: "plastics", nameEn: "Plastics", nameDe: "Kunststoffe", enabled: true, unitKeys: ["kg", "t", "item"] },
    { id: METALS, key: "metals", nameEn: "Metals", nameDe: "Metalle", enabled: false, unitKeys: ["kg", "t"] },
  ],
  types: [
    { id: HDPE, categoryId: PLASTICS, key: "hdpe", nameEn: "HDPE", nameDe: "HDPE" },
    { id: ALUMINIUM, categoryId: METALS, key: "aluminium", nameEn: "Aluminium", nameDe: "Aluminium" },
  ],
  forms: [
    { id: SHEET, categoryId: PLASTICS, key: "sheet", nameEn: "Sheets / offcuts", nameDe: "Platten / Abschnitte" },
    { id: REGRIND, categoryId: PLASTICS, key: "regrind", nameEn: "Regrind", nameDe: "Mahlgut" },
    { id: FILM, categoryId: PLASTICS, key: "film", nameEn: "Film", nameDe: "Folie" },
    { id: METAL_SHEET, categoryId: METALS, key: "sheet", nameEn: "Sheets", nameDe: "Bleche" },
  ],
  units: [
    { key: "kg", nameEn: "kg", nameDe: "kg", dimension: "mass", toBase: 1 },
    { key: "t", nameEn: "t", nameDe: "t", dimension: "mass", toBase: 1000 },
    { key: "item", nameEn: "items", nameDe: "Stück", dimension: "count", toBase: 1 },
    { key: "m3", nameEn: "m³", nameDe: "m³", dimension: "volume", toBase: 1 },
  ],
  attributes: [
    attribute(1, PLASTICS, "grade", { critical: true }),
    attribute(2, PLASTICS, "contamination", { dataType: "number", unit: "%", minValue: 0, maxValue: 100 }),
    attribute(3, PLASTICS, "thickness", { dataType: "range", unit: "mm", minValue: 0, forms: ["sheet"] }),
    attribute(4, PLASTICS, "melt_flow_rate", { dataType: "number", unit: "g/10 min", minValue: 0, forms: ["regrind"], critical: true }),
    attribute(5, PLASTICS, "mfr_test_conditions", { forms: ["regrind"], requiredWith: "melt_flow_rate" }),
    attribute(6, PLASTICS, "particle_size", { dataType: "range", unit: "mm", minValue: 0, forms: ["regrind"] }),
    attribute(7, PLASTICS, "layer_structure", {
      dataType: "enum",
      forms: ["film"],
      options: [
        { value: "single", en: "Single layer", de: "Einschichtig" },
        { value: "multilayer", en: "Multilayer", de: "Mehrschichtig" },
      ],
    }),
    attribute(8, PLASTICS, "unit_count", { dataType: "integer", minValue: 1, forms: ["film"] }),
    attribute(9, METALS, "alloy", { critical: true }),
  ],
};
