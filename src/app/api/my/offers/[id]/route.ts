import { api, readId, readJson } from "@/server/http";
import { deleteDraft, getMyOffer, updateOffer } from "@/server/dal/offers";
import { offerUpdate } from "@/server/validation/offers";

type Context = { params: Promise<{ id: string }> };

/** GET /api/my/offers/[id] – own offer in the shape of the edit form, with its revision. */
export function GET(request: Request, { params }: Context) {
  return api(request, "GET /api/my/offers/[id]", async ({ viewer }) => getMyOffer(viewer, await readId(params)));
}

/** PUT /api/my/offers/[id] – change an own offer; an outdated `expectedRevision` is answered with HTTP 409. */
export function PUT(request: Request, { params }: Context) {
  return api(request, "PUT /api/my/offers/[id]", async ({ viewer }) =>
    updateOffer(viewer, await readId(params), await readJson(request, offerUpdate)),
  );
}

/** DELETE /api/my/offers/[id] – delete an own draft (published listings are closed instead). */
export function DELETE(request: Request, { params }: Context) {
  return api(request, "DELETE /api/my/offers/[id]", async ({ viewer }) => deleteDraft(viewer, await readId(params)));
}
