// Beispiel für den Weg einer Anfrage (Folie 1): alle 5 Stationen an einer Stelle.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/server/viewer";
import { offerListQuery } from "@/server/validation/offers";
import { listOffers } from "@/server/dal/offers";
import { isDatabaseError } from "@/server/db/errors";

// 1 Einstiegspunkt: Next.js Route Handler  GET /api/offers?materialId=&city=&limit=
export async function GET(request: NextRequest) {
  try {
    const viewer = await getViewer(request.headers); // 2 Better Auth
    const query = offerListQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams)); // 3 Zod
    if (!query.success) {
      return NextResponse.json({ error: "Ungültige Anfrage", details: z.flattenError(query.error) }, { status: 400 });
    }
    const offers = await listOffers(viewer, query.data); // 4 Data Access Layer → 5 Drizzle
    return NextResponse.json({ role: viewer.role, offers });
  } catch (error) {
    if (!isDatabaseError(error)) throw error; // Programmfehler bleibt ein 500 im Server-Log
    // Datenbank nicht erreichbar → klare Antwort statt leerem 500 (wie /api/health)
    console.error("GET /api/offers: Datenbank nicht erreichbar", error);
    return NextResponse.json({ error: "Datenbank nicht erreichbar" }, { status: 503 });
  }
}
