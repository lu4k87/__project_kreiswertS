// Station 3 – Validierung: Zod prüft jede Eingabe, bevor sie die Datenbank erreicht.
import { z } from "zod";

/** Leeres Feld (`?city=`, z. B. aus einem GET-Formular) zählt als nicht angegeben, nicht als ungültig. */
const optionalParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

/** Query-Parameter von GET /api/offers */
export const offerListQuery = z.object({
  materialId: optionalParam(z.coerce.number().int().positive().optional()),
  city: optionalParam(z.string().trim().min(1).max(100).optional()),
  limit: optionalParam(z.coerce.number().int().min(1).max(100).default(50)),
});

export type OfferListQuery = z.infer<typeof offerListQuery>;
