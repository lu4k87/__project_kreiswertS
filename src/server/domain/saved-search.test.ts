// Function no. 19: a saved search notices exactly the offers its list would show.
import { describe, expect, it } from "vitest";
import { matchesSavedSearch, type PublishedOffer, type SavedSearchFilters, type Searcher } from "./saved-search";

const kg = { key: "kg", dimension: "mass" as const, toBase: 1 };
const t = { key: "t", dimension: "mass" as const, toBase: 1000 };
const piece = { key: "pcs", dimension: "count" as const, toBase: 1 };

/** Site C in park 1 (Duisburg area), looking for PE film. */
const searcher: Searcher = { siteId: 3, parkId: 1, latitude: 51.4866, longitude: 6.5441 };
const filters: SavedSearchFilters = { scope: "park", radiusKm: 25, categoryId: 1, typeId: 10 };
/** Site B in the same park, about 4.5 km away. */
const offer: PublishedOffer = {
  siteId: 2,
  parkId: 1,
  latitude: 51.4684,
  longitude: 6.6001,
  categoryId: 1,
  typeId: 10,
  formId: 100,
  origin: "pre_consumer",
  frequency: "one_time",
  deliveryTerms: ["exw"],
  quantity: 2,
  unit: t,
};

describe("matchesSavedSearch (function no. 19)", () => {
  it("acceptance: an offer in the own park with the saved material matches", () => {
    expect(matchesSavedSearch(filters, searcher, offer)).toBe(true);
  });

  it("negative: other material, other park or the own offer never match", () => {
    expect(matchesSavedSearch(filters, searcher, { ...offer, typeId: 11 })).toBe(false);
    expect(matchesSavedSearch(filters, searcher, { ...offer, parkId: 2 })).toBe(false);
    expect(matchesSavedSearch(filters, searcher, { ...offer, siteId: searcher.siteId })).toBe(false);
  });

  it("local search without a known park matches nothing (the list asks for an area instead)", () => {
    expect(matchesSavedSearch(filters, { ...searcher, parkId: null }, offer)).toBe(false);
    expect(matchesSavedSearch({ ...filters, parkId: 1 }, { ...searcher, parkId: null }, offer)).toBe(true);
  });

  it("radius: inside matches, outside does not, unknown coordinates are not filtered (as in the list)", () => {
    const radius: SavedSearchFilters = { scope: "radius", radiusKm: 5 };
    expect(matchesSavedSearch(radius, searcher, { ...offer, parkId: 9 })).toBe(true);
    expect(matchesSavedSearch(radius, searcher, { ...offer, latitude: 52.52, longitude: 13.405 })).toBe(false);
    expect(matchesSavedSearch(radius, searcher, { ...offer, latitude: null, longitude: null })).toBe(true);
  });

  it("delivery filter looks at the handover mode of the terms", () => {
    expect(matchesSavedSearch({ ...filters, delivery: "collection" }, searcher, offer)).toBe(true);
    expect(matchesSavedSearch({ ...filters, delivery: "delivered" }, searcher, offer)).toBe(false);
    expect(matchesSavedSearch({ ...filters, delivery: "delivered" }, searcher, { ...offer, deliveryTerms: ["exw", "dap"] })).toBe(true);
  });

  it("minimum quantity compares masses only, at the boundary inclusive", () => {
    expect(matchesSavedSearch({ ...filters, minQuantityKg: 2000 }, searcher, offer)).toBe(true);
    expect(matchesSavedSearch({ ...filters, minQuantityKg: 2001 }, searcher, offer)).toBe(false);
    expect(matchesSavedSearch({ ...filters, minQuantityKg: 1 }, searcher, { ...offer, quantity: 5, unit: piece })).toBe(false);
    expect(matchesSavedSearch({ ...filters, minQuantityKg: 1 }, searcher, { ...offer, quantity: null, unit: kg })).toBe(false);
  });

  it("form, origin and frequency filters must agree when set", () => {
    expect(matchesSavedSearch({ ...filters, formId: 101 }, searcher, offer)).toBe(false);
    expect(matchesSavedSearch({ ...filters, origin: "post_consumer" }, searcher, offer)).toBe(false);
    expect(matchesSavedSearch({ ...filters, frequency: "recurring" }, searcher, offer)).toBe(false);
  });
});
