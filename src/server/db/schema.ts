// Data model per the ER diagram from 2026-11-18 (5 tables, types taken over 1:1).
// The source of truth is the database of the database owners: once it exists,
// `npm run db:pull` replaces this file with the real state.
// Deviations from the diagram that PostgreSQL requires are marked with "Deviation".
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

// Deviation: the diagram only says BIGINT; "identity" lets PostgreSQL assign the id itself.
const id = () => bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity();
const ref = (name: string) => bigint(name, { mode: "number" }).notNull();

/** Business with site */
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
  availableFrom: timestamp("available_from").notNull(), // Deviation: diagram says DATETIME, which PostgreSQL does not have
  status: varchar("status", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Match: buyer + offer ("Matches" on the slides) */
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
