// Station 3 – Validierung: Zod prüft jede Eingabe, bevor sie die Datenbank erreicht.
import { z } from "zod";

/** Query-Parameter von GET /api/offers */
export const offerListQuery = z.object({
  materialId: z.coerce.number().int().positive().optional(),
  city: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type OfferListQuery = z.infer<typeof offerListQuery>;
