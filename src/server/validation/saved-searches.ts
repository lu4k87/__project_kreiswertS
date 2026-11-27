// Station 3 – validation of saved searches (function no. 19). The browser sends the query string of /offers; it is
// parsed with the same schema as the search itself, so a saved search can only hold filters the search knows.
import { z } from "zod";
import { HAS_LETTER_OR_DIGIT, line } from "./common";
import { offerSearchQuery } from "./offers";

/** Stored filters: everything of the search except sort order and page size. */
export const savedSearchFilters = offerSearchQuery.omit({ sort: true, limit: true });

/** Body of POST /api/my/saved-searches. */
export const savedSearchInput = z.object({
  name: line(80).min(2).regex(HAS_LETTER_OR_DIGIT),
  /** Query string of /offers, e.g. "scope=radius&radiusKm=10&typeId=4"; unknown parameters are dropped. */
  query: z
    .string()
    .max(1000)
    .transform((query): Record<string, unknown> => Object.fromEntries(new URLSearchParams(query)))
    .pipe(savedSearchFilters),
});
export type SavedSearchInput = z.infer<typeof savedSearchInput>;

/** Body of POST /api/my/notifications/read: the notices to mark as read; none given = all of the site. */
export const notificationsRead = z.object({ ids: z.array(z.number().int().positive()).max(200).optional() });
