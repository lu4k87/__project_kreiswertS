import { api } from "@/server/http";
import { getCatalogue, listParks } from "@/server/dal/catalogue";

/** GET /api/catalogue – material categories, types, forms, units, attribute definitions and industrial parks. */
export function GET(request: Request) {
  return api(
    request,
    "GET /api/catalogue",
    async () => {
      const [catalogue, parks] = await Promise.all([getCatalogue(), listParks()]);
      return { ...catalogue, parks: parks.map(({ id, name, city }) => ({ id, name, city })) };
    },
    { anonymous: true },
  );
}
