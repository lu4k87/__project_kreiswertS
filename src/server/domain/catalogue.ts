// Shape of the material catalogue as the server hands it to forms, validation and views (D04).
// The content is data in the database (seed: scripts/seed.mjs); only the types and lookups live here. Pure.
import type { AttributeType } from "./listing";
import type { Unit, UnitDimension } from "./units";

export type CatalogueCategory = {
  id: number;
  key: string;
  nameEn: string;
  nameDe: string;
  /** Only enabled categories can be published (Level 1: plastics). */
  enabled: boolean;
  /** Units permitted for quantities and prices of this category. */
  unitKeys: string[];
};

export type CatalogueItem = { id: number; categoryId: number; key: string; nameEn: string; nameDe: string };

export type CatalogueUnit = Unit & { nameEn: string; nameDe: string; dimension: UnitDimension };

export type AttributeDefinition = {
  id: number;
  categoryId: number;
  key: string;
  nameEn: string;
  nameDe: string;
  dataType: AttributeType;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  options: { value: string; en: string; de: string }[];
  /** Form keys the attribute applies to; empty = every form of the category. */
  forms: string[];
  required: boolean;
  critical: boolean;
  requiredWith: string | null;
};

export type Catalogue = {
  categories: CatalogueCategory[];
  types: CatalogueItem[];
  forms: CatalogueItem[];
  units: CatalogueUnit[];
  attributes: AttributeDefinition[];
};

export type Named = { nameEn: string; nameDe: string };

/** Name of a catalogue entry in the UI language. */
export function nameOf(item: Named, locale: "de" | "en"): string {
  return locale === "de" ? item.nameDe : item.nameEn;
}

export function findUnit(catalogue: Pick<Catalogue, "units">, key: string | null): CatalogueUnit | null {
  return catalogue.units.find((unit) => unit.key === key) ?? null;
}
