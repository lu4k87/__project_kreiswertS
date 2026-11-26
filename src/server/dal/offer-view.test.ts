import { describe, expect, it } from "vitest";
import { offerCard, offerDetail, supplierView, unavailableOffer, type OfferRecord } from "./offer-view";

const now = new Date("2026-11-26T12:00:00Z");
const material = (id: number, key: string) => ({ id, key, nameEn: key, nameDe: key });

const record: OfferRecord = {
  id: 42,
  status: "active",
  revision: 3,
  title: "HDPE regrind",
  description: "Regrind from production offcuts.",
  category: material(1, "plastics"),
  type: material(10, "hdpe"),
  form: material(101, "regrind"),
  origin: "pre_consumer",
  legalStatus: "by_product",
  wasteCode: null,
  quantity: 500,
  unitKey: "kg",
  minLot: 250,
  frequency: "recurring",
  recurrencePeriod: "monthly",
  recurrenceQuantity: 500,
  availableFrom: "2026-11-26",
  collectionUntil: null,
  validityDays: 30,
  expiresAt: new Date("2026-12-26T12:00:00Z"),
  priceMode: "fixed",
  priceAmount: 400,
  priceUnitKey: "t",
  currency: "EUR",
  vatBasis: "net",
  payer: "requester",
  deliveryPricing: "quotation",
  maxDeliveryDistanceKm: 100,
  packaging: "big_bags",
  loadingEquipment: "forklift",
  evidenceStatus: "self_declared",
  datasheetAvailable: true,
  datasheetAccess: "on_enquiry",
  photosAvailable: false,
  sampleAvailable: "yes",
  provenance: "synthetic",
  publishedAt: new Date("2026-11-26T10:00:00Z"),
  closedAt: null,
  updatedAt: new Date("2026-11-26T10:00:00Z"),
  site: {
    id: 2,
    name: "Standort B",
    companyName: "Beispiel Recycling GmbH (fiktiv)",
    industry: "recycling",
    city: "Moers",
    parkId: 3,
    parkName: "Grafschafter Gewerbepark Genend",
    latitude: 51.4684,
    longitude: 6.6001,
    verificationStatus: "verified",
    capabilities: ["grinding"],
    contactVisible: true,
    contactName: "Kontakt Standort B",
    contactEmail: "site-b@kreiswerts.example",
    contactPhone: "+49 0000 000000",
  },
  deliveryOptions: [
    { term: "fca", namedPlace: "Standort B, Moers", incotermsVersion: "2020", customNote: null },
    { term: "dap", namedPlace: "Region", incotermsVersion: "2020", customNote: null },
  ],
  attributes: { particle_size: { valueMin: 3, valueMax: 6, comparator: null, valueText: null } },
};

const siteC = { latitude: 51.4866, longitude: 6.5441 };

describe("offerCard (L1-015)", () => {
  it("carries what a buyer needs to tell two batches apart", () => {
    const card = offerCard(record, siteC, now);
    expect(card).toMatchObject({
      ref: "KW-000042",
      title: "HDPE regrind",
      status: "active",
      quantity: 500,
      unitKey: "kg",
      frequency: "recurring",
      recurrencePeriod: "monthly",
      priceMode: "fixed",
      priceAmount: 400,
      priceUnitKey: "t",
      deliveryTerms: ["fca", "dap"],
      provenance: "synthetic",
      hasLocation: true,
    });
    expect(card.distanceKm).toBeGreaterThan(4);
    expect(card.distanceKm).toBeLessThan(5);
  });

  it("NT-L1-015: never invents a distance – unknown stays null", () => {
    expect(offerCard(record, null, now).distanceKm).toBeNull();
    const unmapped = offerCard({ ...record, site: { ...record.site, latitude: null, longitude: null } }, siteC, now);
    expect(unmapped.distanceKm).toBeNull();
    expect(unmapped.hasLocation).toBe(false);
  });

  it("exposes only the allow-listed site fields: no address, no contact, no coordinates", () => {
    const card = offerCard(record, siteC, now);
    expect(Object.keys(card.site).sort()).toEqual(["city", "companyName", "id", "name", "parkName"]);
    const text = JSON.stringify(card);
    for (const secret of ["site-b@", "+49", "51.4684", "6.6001", "Kontakt"]) expect(text).not.toContain(secret);
  });

  it("shows an active offer past its expiry date as expired", () => {
    expect(offerCard({ ...record, expiresAt: new Date("2026-11-20T00:00:00Z") }, siteC, now).status).toBe("expired");
  });
});

describe("supplierView (D08)", () => {
  it("shows the contact to members when the site allows it", () => {
    expect(supplierView(record.site, false).contact).toEqual({ name: "Kontakt Standort B", email: "site-b@kreiswerts.example", phone: "+49 0000 000000" });
  });

  it("NT-L1-018: hides the contact when the site keeps it private – except for the owner", () => {
    const hidden = { ...record.site, contactVisible: false };
    expect(supplierView(hidden, false).contact).toBeNull();
    expect(JSON.stringify(supplierView(hidden, false))).not.toContain("site-b@");
    expect(supplierView(hidden, true).contact?.email).toBe("site-b@kreiswerts.example");
  });

  it("NT-L1-016: the verified badge is about the site, separate from the evidence of the material", () => {
    const detail = offerDetail(record, siteC, false, now);
    expect(detail.supplier.verified).toBe(true);
    expect(detail.evidenceStatus).toBe("self_declared");
    expect(supplierView({ ...record.site, verificationStatus: "pending" }, false).verified).toBe(false);
  });
});

describe("offerDetail (L1-016)", () => {
  it("gives the revision to the owner only", () => {
    expect(offerDetail(record, null, true, now).revision).toBe(3);
    expect(offerDetail(record, siteC, false, now).revision).toBeNull();
  });

  it("AT-L1-016: unknown attributes are simply absent – nothing is filled in with 0", () => {
    const detail = offerDetail(record, siteC, false, now);
    expect(Object.keys(detail.attributes)).toEqual(["particle_size"]);
    expect(detail.attributes.melt_flow_rate).toBeUndefined();
  });
});

describe("unavailableOffer (L1-012)", () => {
  it("AT-L1-012: a closed listing shows that it is unavailable and nothing about quantity, price or supplier", () => {
    const view = unavailableOffer({ ...record, status: "closed" }, now);
    expect(view).toEqual({ unavailable: true, id: 42, ref: "KW-000042", title: "HDPE regrind", status: "closed" });
  });
});
