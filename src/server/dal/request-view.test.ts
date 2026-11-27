// Projections of a request (D08): what reaches the browser – no contact, no address, the revision only for the owner.
import { describe, expect, it } from "vitest";
import { matchRequestOf, requestCard, requestDetail, unavailableRequest, type RequestRecord } from "./request-view";

const record: RequestRecord = {
  id: 12,
  status: "active",
  revision: 3,
  title: "HDPE regrind",
  description: "For boxes",
  category: { id: 1, key: "plastics", nameEn: "Plastics", nameDe: "Kunststoffe" },
  types: [{ id: 10, key: "hdpe", nameEn: "HDPE", nameDe: "HDPE" }],
  forms: [{ id: 101, key: "regrind", nameEn: "Regrind", nameDe: "Mahlgut" }],
  origins: ["pre_consumer"],
  quantity: 500,
  unitKey: "kg",
  minLot: null,
  frequency: "recurring",
  recurrencePeriod: "monthly",
  neededFrom: null,
  neededUntil: "2027-01-31",
  validityDays: 30,
  expiresAt: new Date("2099-01-01T00:00:00Z"),
  maxPriceAmount: 400,
  maxPriceUnitKey: "t",
  deliveryTerms: ["dap"],
  evidenceStatus: null,
  sampleRequired: true,
  closureReason: null,
  provenance: "synthetic",
  publishedAt: new Date("2026-11-27T08:00:00Z"),
  closedAt: null,
  updatedAt: new Date("2026-11-27T08:00:00Z"),
  site: {
    id: 3,
    name: "Werk C",
    companyName: "Demo Formteile GmbH (fiktiv)",
    industry: "manufacturing",
    city: "Kamp-Lintfort",
    parkId: 2,
    parkName: "Dieprahm",
    latitude: 51.4866,
    longitude: 6.5441,
    verificationStatus: "verified",
    capabilities: ["compounding"],
  },
  criteria: { contamination: { kind: "required", valueMin: null, valueMax: 2, valueText: null } },
};

describe("request projections", () => {
  it("card: reference, distance from the viewer, no coordinates of the site", () => {
    const card = requestCard(record, { latitude: 51.5131, longitude: 6.5672 });
    expect(card.ref).toBe("RQ-000012");
    expect(card.distanceKm).toBeGreaterThan(0);
    expect(JSON.stringify(card)).not.toContain("51.4866");
  });

  it("detail: the revision only for the owner; the requesting site without contact or address", () => {
    expect(requestDetail(record, null, false).revision).toBeNull();
    expect(requestDetail(record, null, true).revision).toBe(3);
    const text = JSON.stringify(requestDetail(record, null, false));
    expect(text).not.toMatch(/street|postal|email|phone|contact/i);
  });

  it("expired is derived; an unavailable request tells nothing but that", () => {
    const expired = { ...record, expiresAt: new Date("2020-01-01T00:00:00Z") };
    expect(requestCard(expired, null).status).toBe("expired");
    expect(Object.keys(unavailableRequest(expired)).sort()).toEqual(["id", "ref", "status", "title", "unavailable"]);
  });

  it("matching side: catalogue keys instead of ids", () => {
    const match = matchRequestOf(record);
    expect(match.typeKeys).toEqual(["hdpe"]);
    expect(match.formKeys).toEqual(["regrind"]);
    expect(match.categoryId).toBe(1);
  });
});
