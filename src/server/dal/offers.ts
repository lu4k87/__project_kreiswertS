// Data Access Layer: der einzige Weg zu den Angeboten. Routen rufen nur diese Funktionen auf.
// Station 5 – ORM: Drizzle baut daraus parametrisierte SQL-Abfragen (kein SQL-Injection-Risiko).
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { materials, offers, sites } from "../db/schema";
import type { OfferListQuery } from "../validation/offers";
import type { Viewer } from "../viewer";
import { offerView } from "./offer-view";

export async function listOffers(viewer: Viewer, query: OfferListQuery) {
  const filters = [
    query.materialId ? eq(offers.materialId, query.materialId) : undefined,
    query.city ? eq(sites.city, query.city) : undefined,
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
