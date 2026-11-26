// Station 3 – validation: Zod checks every input before it reaches the database.
import { z } from "zod";

/** Empty field (`?city=`, e.g. from a GET form) counts as not given, not as invalid. */
const optionalParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

/** Query-Parameter von GET /api/offers */
export const offerListQuery = z.object({
  materialId: optionalParam(z.coerce.number().int().positive().optional()),
  city: optionalParam(z.string().trim().min(1).max(100).optional()),
  limit: optionalParam(z.coerce.number().int().min(1).max(100).default(50)),
});

export type OfferListQuery = z.infer<typeof offerListQuery>;
