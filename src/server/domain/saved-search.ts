// Saved search + in-app notice (function no. 19): does a newly published offer match a site's saved search?
// The same filters as the offer search (GET /api/offers, dal/offers.ts searchOffers) – a notice never promises
// more than the list would show. Pure → tested on its own (saved-search.test.ts).
import { deliveryMode } from "./delivery";
import { coordinatesOf, distanceKm } from "./geo";
import type { DeliveryTerm } from "./listing";
import type { Unit } from "./units";

/** At most this many saved searches per site – keeps the check at publish time small. */
export const MAX_SAVED_SEARCHES = 20;

/** Stored filters of a saved search: the search parameters without sort order and page size. */
export type SavedSearchFilters = {
  scope: "park" | "radius";
  parkId?: number;
  radiusKm: number;
  categoryId?: number;
  typeId?: number;
  formId?: number;
  origin?: string;
  frequency?: string;
  delivery?: "collection" | "delivered";
  minQuantityKg?: number;
};

/** The site that saved the search, as the search would see it. */
export type Searcher = { siteId: number; parkId: number | null; latitude: number | null; longitude: number | null };

/** What the check needs from the published offer. */
export type PublishedOffer = {
  siteId: number;
  parkId: number | null;
  latitude: number | null;
  longitude: number | null;
  categoryId: number | null;
  typeId: number | null;
  formId: number | null;
  origin: string | null;
  frequency: string | null;
  deliveryTerms: DeliveryTerm[];
  quantity: number | null;
  unit: Unit | null;
};

/** true = the offer would appear in the list of this saved search. */
export function matchesSavedSearch(filters: SavedSearchFilters, searcher: Searcher, offer: PublishedOffer): boolean {
  if (offer.siteId === searcher.siteId) return false; // own offers are never in the own search
  if (filters.scope === "park") {
    const parkId = filters.parkId ?? searcher.parkId;
    if (parkId === null || offer.parkId !== parkId) return false;
  } else {
    // Like the list: without coordinates on either side the radius is not applied (labelled there, never dropped).
    const distance = distanceKm(coordinatesOf(searcher), coordinatesOf(offer));
    if (distance !== null && distance > filters.radiusKm) return false;
  }
  if (filters.categoryId !== undefined && offer.categoryId !== filters.categoryId) return false;
  if (filters.typeId !== undefined && offer.typeId !== filters.typeId) return false;
  if (filters.formId !== undefined && offer.formId !== filters.formId) return false;
  if (filters.origin !== undefined && offer.origin !== filters.origin) return false;
  if (filters.frequency !== undefined && offer.frequency !== filters.frequency) return false;
  if (filters.delivery !== undefined && !offer.deliveryTerms.some((term) => deliveryMode(term) === filters.delivery)) return false;
  if (filters.minQuantityKg !== undefined) {
    // Only masses can be compared with a minimum in kg; other units drop out instead of being converted.
    if (offer.quantity === null || offer.unit?.dimension !== "mass") return false;
    if (offer.quantity * offer.unit.toBase < filters.minQuantityKg) return false;
  }
  return true;
}
