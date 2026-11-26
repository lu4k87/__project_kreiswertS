import { describe, expect, it } from "vitest";
import { addressKey, siteProfile, siteRegistration, verificationDecision } from "./sites";

const site = {
  industry: "manufacturing",
  siteName: "Werk A",
  streetAddress: "Musterstraße 1",
  postalCode: "47475",
  city: "Kamp-Lintfort",
  parkId: 1,
  contactName: "Kontakt Werk A",
  contactPhone: "+49 0000 000000",
  capabilities: ["cutting", "cutting"],
};

describe("siteRegistration (L1-001)", () => {
  it("accepts a complete site and removes duplicate capabilities", () => {
    expect(siteRegistration.parse(site)).toMatchObject({ siteName: "Werk A", parkId: 1, capabilities: ["cutting"] });
  });

  it("an unknown park and a missing phone are allowed (unknown stays unknown)", () => {
    expect(siteRegistration.parse({ ...site, parkId: null, contactPhone: "" })).toMatchObject({ parkId: null, contactPhone: null });
  });

  it("AT-L1-003: drops fields only the server may set – a site cannot verify itself", () => {
    const parsed = siteRegistration.parse({ ...site, verificationStatus: "verified", provenance: "registered", latitude: 51.5, companyId: 1, role: "admin" });
    for (const field of ["verificationStatus", "provenance", "latitude", "companyId", "role"]) expect(parsed).not.toHaveProperty(field);
  });

  it("rejects a malformed postal code, phone or capability", () => {
    expect(siteRegistration.safeParse({ ...site, postalCode: "4" }).success).toBe(false);
    expect(siteRegistration.safeParse({ ...site, contactPhone: "call me" }).success).toBe(false);
    expect(siteRegistration.safeParse({ ...site, capabilities: ["teleport"] }).success).toBe(false);
    expect(siteRegistration.safeParse({ ...site, siteName: "\u0000" }).success).toBe(false);
  });
});

describe("review 2026-11-26: look-alike names", () => {
  it("rejects a site name with a zero-width character (would pass as an existing name)", () => {
    expect(siteRegistration.safeParse({ ...site, siteName: `Werk${String.fromCodePoint(0x200c)} A` }).success).toBe(false);
    expect(siteRegistration.safeParse({ ...site, city: `Kamp${String.fromCodePoint(0xfeff)}Lintfort` }).success).toBe(false);
  });
});

describe("siteProfile (PG-14)", () => {
  const profile = { description: "", contactName: "Kontakt", contactEmail: "a@kreiswerts.example", contactPhone: null, capabilities: [], contactVisible: false, publicListed: true };

  it("cannot carry a verification status, an address or coordinates", () => {
    const parsed = siteProfile.parse({ ...profile, verificationStatus: "verified", streetAddress: "Other street 9", latitude: 0, parkId: 2 });
    expect(Object.keys(parsed).sort()).toEqual(["capabilities", "contactEmail", "contactName", "contactPhone", "contactVisible", "description", "publicListed"]);
  });

  it("needs a valid contact e-mail", () => {
    expect(siteProfile.safeParse({ ...profile, contactEmail: "not-an-address" }).success).toBe(false);
  });
});

describe("verificationDecision (L1-003)", () => {
  it("accepts the three statuses and coordinates inside the globe", () => {
    expect(verificationDecision.parse({ status: "verified", note: "" })).toEqual({ status: "verified", note: null });
    expect(verificationDecision.parse({ status: "declined", note: "Address not found.", latitude: 51.4, longitude: 6.6 }).latitude).toBe(51.4);
    expect(verificationDecision.safeParse({ status: "approved" }).success).toBe(false);
    expect(verificationDecision.safeParse({ status: "verified", latitude: 91, longitude: 0 }).success).toBe(false);
  });
});

describe("addressKey (D01, NT-L1-001)", () => {
  it("treats spellings of one address as the same", () => {
    const key = addressKey("Musterstraße 1", "47475");
    for (const spelling of ["Musterstr. 1", "musterstrasse 1", "MUSTERSTRASSE  1", "Muster-Straße 1", "Musterstr.1"]) {
      expect(addressKey(spelling, " 47475 ")).toBe(key);
    }
  });

  it("keeps different house numbers, streets and postal codes apart", () => {
    const key = addressKey("Musterstraße 1", "47475");
    expect(addressKey("Musterstraße 11", "47475")).not.toBe(key);
    expect(addressKey("Beispielweg 1", "47475")).not.toBe(key);
    expect(addressKey("Musterstraße 1", "47441")).not.toBe(key);
  });
});
