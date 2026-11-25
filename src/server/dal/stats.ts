// Data Access Layer: Kennzahlen der Plattform für die Startseite (Gäste dürfen sie sehen – nur Summen, keine Details).
import "server-only";
import { count } from "drizzle-orm";
import { db } from "../db/client";
import { offers, sites } from "../db/schema";

export type PlatformStats = {
  /** Betriebe (Standorte) auf der Plattform */
  businesses: number;
  /** eingestellte Angebote; Filter auf „aktiv“ folgt, sobald die Status-Werte für offers.status feststehen */
  materials: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const [[siteRow], [offerRow]] = await Promise.all([
    db.select({ n: count() }).from(sites),
    db.select({ n: count() }).from(offers),
  ]);
  return { businesses: siteRow?.n ?? 0, materials: offerRow?.n ?? 0 };
}
