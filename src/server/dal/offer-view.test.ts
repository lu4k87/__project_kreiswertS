import { describe, expect, it } from "vitest";
import { offerView, type OfferRow } from "./offer-view";

const row: OfferRow = {
  id: 1,
  title: "PP-Mahlgut, grau",
  availableQuantityKg: 500,
  materialName: "Polypropylen",
  city: "Kamp-Lintfort",
  priceEurPerKg: 0.4,
  description: "Demo-Betrieb",
  contactName: "Demo Kontakt",
  contactEmail: "demo@example.org",
  contactPhone: "+49 0000 000",
};

describe("offerView", () => {
  it("Gast sieht nur Titel, Material, Menge, Stadt", () => {
    expect(offerView(row, { role: "guest" })).toEqual({
      id: 1,
      title: "PP-Mahlgut, grau",
      availableQuantityKg: 500,
      materialName: "Polypropylen",
      city: "Kamp-Lintfort",
    });
  });

  it("Mitglied sieht zusätzlich Preis, Beschreibung, Kontakt", () => {
    expect(offerView(row, { role: "member" })).toEqual(row);
  });
});
