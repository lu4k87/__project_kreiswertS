// Datenmodell nach dem ER-Diagramm vom 2026-11-18 (5 Tabellen, Typen 1:1 übernommen).
// Quelle der Wahrheit ist die Datenbank der DB-Verantwortlichen: sobald sie steht,
// ersetzt `npm run db:pull` diese Datei durch den echten Stand.
// Abweichungen zum Bild, weil PostgreSQL sie verlangt, sind mit „Abweichung“ markiert.
import {
  bigint,
  doublePrecision,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Abweichung: Das Bild nennt nur BIGINT; „identity“ lässt PostgreSQL die id selbst vergeben.
const id = () => bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity();
const ref = (name: string) => bigint(name, { mode: "number" }).notNull();

/** Betrieb mit Standort */
export const sites = pgTable("sites", {
  id: id(),
  companyName: varchar("company_name", { length: 200 }).notNull(),
  branchName: varchar("branch_name", { length: 200 }).notNull(),
  description: text("description"),
  streetAddress: varchar("street_address", { length: 255 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull(),
  contactName: varchar("contact_name", { length: 150 }).notNull(),
  contactEmail: varchar("contact_email", { length: 254 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 30 }).notNull(),
});

/** Login eines Standorts (Bild: 1 Standort : 1 Login) */
export const users = pgTable("users", {
  id: id(),
  siteId: ref("site_id").references(() => sites.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  accountStatus: varchar("account_status", { length: 20 }).notNull(),
});

/** Materialkatalog */
export const materials = pgTable("materials", {
  id: id(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  impactFactorKgCo2ePerKg: integer("impact_factor_kg_co2e_per_kg").notNull(),
});

/** Angebot eines Standorts */
export const offers = pgTable("offers", {
  id: id(),
  sellerSiteId: ref("seller_site_id").references(() => sites.id),
  materialId: ref("material_id").references(() => materials.id),
  title: varchar("title", { length: 200 }).notNull(),
  availableQuantityKg: bigint("available_quantity_kg", { mode: "number" }).notNull(),
  priceEurPerKg: doublePrecision("price_eur_per_kg").notNull(), // Bild: FLOAT
  availableFrom: timestamp("available_from").notNull(), // Abweichung: Bild DATETIME, gibt es in PostgreSQL nicht
  status: varchar("status", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Match: Käufer + Angebot (auf den Folien „Matches“) */
export const agreements = pgTable("agreements", {
  id: id(),
  offerId: ref("offer_id").references(() => offers.id),
  buyerSiteId: ref("buyer_site_id").references(() => sites.id),
  agreedQuantityKg: bigint("agreed_quantity_kg", { mode: "number" }).notNull(),
  agreedPriceEurPerKg: integer("agreed_price_eur_per_kg").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  buyerConfirmedAt: timestamp("buyer_confirmed_at"),
  sellerConfirmedAt: timestamp("seller_confirmed_at"),
  actualQuantityKg: bigint("actual_quantity_kg", { mode: "number" }),
  completedAt: timestamp("completed_at"),
  impactFactorUsed: integer("impact_factor_used"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
