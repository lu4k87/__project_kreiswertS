// Station 4 – Autorisierung: welche Felder eines Angebots eine Rolle sehen darf.
// Reine Funktion ohne Datenbank → einzeln testbar (offer-view.test.ts).
import type { Viewer } from "../viewer";

export type OfferRow = {
  id: number;
  title: string;
  availableQuantityKg: number;
  materialName: string;
  city: string;
  priceEurPerKg: number;
  description: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

/** Gast: Titel, Material, Menge, Stadt */
export type GuestOffer = Pick<OfferRow, "id" | "title" | "availableQuantityKg" | "materialName" | "city">;
/** Mitglied: zusätzlich Preis, Beschreibung, Kontakt */
export type MemberOffer = OfferRow;

export function offerView(row: OfferRow, viewer: Pick<Viewer, "role">): GuestOffer | MemberOffer {
  if (viewer.role === "member") return row;
  const { id, title, availableQuantityKg, materialName, city } = row;
  return { id, title, availableQuantityKg, materialName, city };
}
