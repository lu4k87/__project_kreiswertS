// Data Access Layer: the only way to the offers. Routes call only these functions.
// Station 5 – ORM: Drizzle turns them into parameterised SQL queries (no SQL injection risk).
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { materials, offers, sites } from "../db/schema";
import type { OfferListQuery } from "../validation/offers";
import type { Viewer } from "../viewer";
import { offerView } from "./offer-view";

export async function listOffers(viewer: Viewer, query: OfferListQuery) {
  const filters = [
    query.materialId ? eq(offers.materialId, query.materialId) : undefined,
    // City case-insensitive ("moers" finds "Moers")
    query.city ? eq(sql`lower(${sites.city})`, query.city.toLowerCase()) : undefined,
  ];
  const rows = await db
    .select({
      id: offers.id,
      title: offers.title,
      availableQuantityKg: offers.availableQuantityKg,
      materialName: materials.name,
      city: sites.city,
      priceEurPerKg: offers.priceEurPerKg,
      description: sites.description,
      contactName: sites.contactName,
      contactEmail: sites.contactEmail,
      contactPhone: sites.contactPhone,
    })
    .from(offers)
    .innerJoin(materials, eq(offers.materialId, materials.id))
    .innerJoin(sites, eq(offers.sellerSiteId, sites.id))
    .where(and(...filters))
    .orderBy(desc(offers.createdAt))
    .limit(query.limit);
  return rows.map((row) => offerView(row, viewer));
}
