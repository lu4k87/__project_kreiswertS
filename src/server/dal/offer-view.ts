// Station 4 – authorisation: which fields of an offer a role may see.
// Pure function without a database → testable on its own (offer-view.test.ts).
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
/** Member: additionally price, description, contact */
export type MemberOffer = OfferRow;

export function offerView(row: OfferRow, viewer: Pick<Viewer, "role">): GuestOffer | MemberOffer {
  if (viewer.role === "member") return row;
  const { id, title, availableQuantityKg, materialName, city } = row;
  return { id, title, availableQuantityKg, materialName, city };
}
