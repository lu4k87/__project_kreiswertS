// Example of the path of a request (slide 1): all 5 stations in one place.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/server/viewer";
import { offerListQuery } from "@/server/validation/offers";
import { listOffers } from "@/server/dal/offers";
import { describeDatabaseError, isDatabaseError } from "@/server/db/errors";

// The response depends on the login (guest/member) → neither browser nor proxy may cache it.
const headers = { "Cache-Control": "private, no-store" };

// 1 Einstiegspunkt: Next.js Route Handler  GET /api/offers?materialId=&city=&limit=
export async function GET(request: NextRequest) {
  try {
    const viewer = await getViewer(request.headers); // 2 Better Auth
    const query = offerListQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams)); // 3 Zod
    if (!query.success) {
      return NextResponse.json({ error: "Invalid request", details: z.flattenError(query.error) }, { status: 400, headers });
    }
    const offers = await listOffers(viewer, query.data); // 4 Data Access Layer → 5 Drizzle
    return NextResponse.json({ role: viewer.role, offers }, { headers });
  } catch (error) {
    if (!isDatabaseError(error)) throw error; // a programming error stays a 500 in the server log
    // Database unreachable → clear answer instead of an empty 500 (like /api/health)
    // Only the summary: the error object contains query and parameters, e.g. the session token.
    console.error("GET /api/offers: database unreachable –", describeDatabaseError(error));
    return NextResponse.json({ error: "Database unreachable" }, { status: 503, headers });
  }
}
