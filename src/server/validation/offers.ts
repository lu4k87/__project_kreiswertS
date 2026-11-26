// Station 3 – validation: Zod checks every input before it reaches the database.
import { z } from "zod";

/** Empty field (`?city=`, e.g. from a GET form) counts as not given, not as invalid. */
const optionalParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

/** No control characters: PostgreSQL rejects NUL, and the route would report that failed query as "database not reachable". */
const NO_CONTROL_CHARACTERS = /^\P{Cc}*$/u;

/** Query parameters of GET /api/offers */
export const offerListQuery = z.object({
  materialId: optionalParam(z.coerce.number().int().positive().optional()),
  city: optionalParam(z.string().trim().min(1).max(100).regex(NO_CONTROL_CHARACTERS).optional()),
  limit: optionalParam(z.coerce.number().int().min(1).max(100).default(50)),
});

export type OfferListQuery = z.infer<typeof offerListQuery>;
