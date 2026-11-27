import { api, readId } from "@/server/http";
import { deleteSavedSearch } from "@/server/dal/alerts";

/** DELETE /api/my/saved-searches/[id] – delete a saved search of the own site together with its notices. */
export function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "DELETE /api/my/saved-searches/[id]", async ({ viewer }) => deleteSavedSearch(viewer, await readId(params)));
}
