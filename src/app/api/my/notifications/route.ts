import { api } from "@/server/http";
import { listNotifications } from "@/server/dal/alerts";

/** GET /api/my/notifications – notices of the own site (newest 50) and the number of unread ones (function no. 19). */
export function GET(request: Request) {
  return api(request, "GET /api/my/notifications", async ({ viewer }) => listNotifications(viewer));
}
