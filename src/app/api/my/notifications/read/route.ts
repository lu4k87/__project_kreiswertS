import { api, readJson } from "@/server/http";
import { markNotificationsRead } from "@/server/dal/alerts";
import { notificationsRead } from "@/server/validation/saved-searches";

/** POST /api/my/notifications/read – mark the given notices (or all) of the own site as read. */
export function POST(request: Request) {
  return api(request, "POST /api/my/notifications/read", async ({ viewer }) => {
    const { ids } = await readJson(request, notificationsRead, 4096);
    return markNotificationsRead(viewer, ids);
  });
}
