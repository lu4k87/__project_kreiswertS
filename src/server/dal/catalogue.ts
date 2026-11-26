// Data Access Layer: material catalogue and industrial parks (reference data, D04, PG-16).
// Reading is open to everyone – categories and park names are shown on the public pages. Changing needs the administrator.
import "server-only";
import { asc, eq } from "drizzle-orm";
import { AccessError, requireAdmin, type Viewer } from "../access";
import { db } from "../db/client";
import {
  attributeDefinitions,
  categoryUnits,
  industrialParks,
  materialCategories,
  materialForms,
  materialTypes,
  units,
} from "../db/schema";
import type { Catalogue } from "../domain/catalogue";
import type { AttributeType } from "../domain/listing";
import type { UnitDimension } from "../domain/units";

export async function getCatalogue(): Promise<Catalogue> {
  const [categories, types, forms, unitRows, permitted, attributes] = await Promise.all([
    db.select().from(materialCategories).orderBy(asc(materialCategories.sortOrder), asc(materialCategories.id)),
    db.select().from(materialTypes).orderBy(asc(materialTypes.sortOrder), asc(materialTypes.id)),
    db.select().from(materialForms).orderBy(asc(materialForms.sortOrder), asc(materialForms.id)),
    db.select().from(units).orderBy(asc(units.sortOrder)),
    db.select().from(categoryUnits),
    db.select().from(attributeDefinitions).orderBy(asc(attributeDefinitions.sortOrder), asc(attributeDefinitions.id)),
  ]);
  return {
    categories: categories.map(({ id, key, nameEn, nameDe, enabled }) => ({
      id,
      key,
      nameEn,
      nameDe,
      enabled,
      unitKeys: permitted.filter((row) => row.categoryId === id).map((row) => row.unitKey),
    })),
    types: types.map(({ id, categoryId, key, nameEn, nameDe }) => ({ id, categoryId, key, nameEn, nameDe })),
    forms: forms.map(({ id, categoryId, key, nameEn, nameDe }) => ({ id, categoryId, key, nameEn, nameDe })),
    units: unitRows.map(({ key, nameEn, nameDe, dimension, toBase }) => ({
      key,
      nameEn,
      nameDe,
      dimension: dimension as UnitDimension,
      toBase,
    })),
    attributes: attributes.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      key: row.key,
      nameEn: row.nameEn,
      nameDe: row.nameDe,
      dataType: row.dataType as AttributeType,
      unit: row.unit,
      minValue: row.minValue,
      maxValue: row.maxValue,
      options: row.options,
      forms: row.forms,
      required: row.required,
      critical: row.critical,
      requiredWith: row.requiredWith,
    })),
  };
}

export type Park = {
  id: number;
  slug: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  sourceNote: string;
};

export async function listParks(): Promise<Park[]> {
  return db
    .select({
      id: industrialParks.id,
      slug: industrialParks.slug,
      name: industrialParks.name,
      city: industrialParks.city,
      latitude: industrialParks.latitude,
      longitude: industrialParks.longitude,
      radiusM: industrialParks.radiusM,
      sourceNote: industrialParks.sourceNote,
    })
    .from(industrialParks)
    .orderBy(asc(industrialParks.city), asc(industrialParks.name));
}

/** Switch a material category on or off (administrator). Listings of a disabled category can no longer be published. */
export async function setCategoryEnabled(viewer: Viewer, categoryId: number, enabled: boolean): Promise<{ id: number; enabled: boolean }> {
  requireAdmin(viewer);
  const [row] = await db
    .update(materialCategories)
    .set({ enabled })
    .where(eq(materialCategories.id, categoryId))
    .returning({ id: materialCategories.id, enabled: materialCategories.enabled });
  if (!row) throw new AccessError("NOT_FOUND");
  return row;
}
