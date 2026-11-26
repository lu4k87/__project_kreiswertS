import { api, readId, readJson } from "@/server/http";
import { setCategoryEnabled } from "@/server/dal/catalogue";
import { categoryToggle } from "@/server/validation/sites";

/** POST /api/admin/categories/[id] – switch a material category on or off (administrator). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/admin/categories/[id]", async ({ viewer }) => {
    const { enabled } = await readJson(request, categoryToggle, 1024);
    return setCategoryEnabled(viewer, await readId(params), enabled);
  });
}
