import { api, readId, readJson } from "@/server/http";
import { deleteRequestDraft, getMyRequest, updateRequest } from "@/server/dal/requests";
import { requestUpdate } from "@/server/validation/requests";

type Context = { params: Promise<{ id: string }> };

/** GET /api/my/requests/[id] – own request in the shape of the edit form, with its revision. */
export function GET(request: Request, { params }: Context) {
  return api(request, "GET /api/my/requests/[id]", async ({ viewer }) => getMyRequest(viewer, await readId(params)));
}

/** PUT /api/my/requests/[id] – change an own request; an outdated `expectedRevision` is answered with HTTP 409. */
export function PUT(request: Request, { params }: Context) {
  return api(request, "PUT /api/my/requests/[id]", async ({ viewer }) =>
    updateRequest(viewer, await readId(params), await readJson(request, requestUpdate)),
  );
}

/** DELETE /api/my/requests/[id] – delete an own draft (published requests are closed instead). */
export function DELETE(request: Request, { params }: Context) {
  return api(request, "DELETE /api/my/requests/[id]", async ({ viewer }) => deleteRequestDraft(viewer, await readId(params)));
}
