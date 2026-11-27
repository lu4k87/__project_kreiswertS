#!/usr/bin/env node
// Seed: writes reference data and, on request, the fictional demo data into the database of DATABASE_URL.
//
//   npm run db:seed                  reference data only (catalogue, units, parks) – safe to repeat
//   npm run db:seed -- --demo        additionally the demo sites, logins, listings and cases A–E
//   npm run db:seed -- --reset-demo  remove all demo records first, then seed them again
//
// The demo sites share one password (DEMO_PASSWORD), the demo administrator has its own (DEMO_ADMIN_PASSWORD).
// Put both into `.env.demo` (never committed, like .env) to keep them across re-seeds; without the variables
// random ones are generated and printed once at the end.
// Run `npm run db:push` first: the tables must exist.
import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import { CATEGORIES, PARKS, UNITS } from "./seed/reference.mjs";
import { ADMIN, CASES, COMPANIES, DEMO_EMAIL_DOMAIN, OFFERS, REQUESTS, RESPONSES, SITES } from "./seed/demo.mjs";

// Variables already set in the shell win over the files; .env.demo is optional.
dotenv.config({ path: [".env.demo", ".env"], quiet: true });

const args = new Set(process.argv.slice(2));
const withDemo = args.has("--demo") || args.has("--reset-demo");
const VALIDITY_DAYS = 30;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing – create .env from .env.example");
  process.exit(1);
}

const id = () => randomBytes(16).toString("hex");
const json = (value) => JSON.stringify(value ?? []);
/** street + postal code without case, spaces and punctuation – same rule as addressKey() in src/server/validation/sites.ts */
const addressKey = (street, postalCode) => {
  const fold = (value) =>
    value.toLowerCase().replace(/ß/g, "ss").replace(/stra(ss|ß)e\b|str\.?(?=\s|\d|$)/g, "str").normalize("NFKD").replace(/[^a-z0-9]/g, "");
  return `${fold(postalCode)}|${fold(street)}`;
};

async function seedReference(db) {
  for (const [index, unit] of UNITS.entries()) {
    await db.query(
      `insert into units (key, name_en, name_de, dimension, to_base, sort_order) values ($1, $2, $3, $4, $5, $6)
       on conflict (key) do update set name_en = excluded.name_en, name_de = excluded.name_de, dimension = excluded.dimension,
         to_base = excluded.to_base, sort_order = excluded.sort_order`,
      [unit.key, unit.nameEn, unit.nameDe, unit.dimension, unit.toBase, index],
    );
  }
  for (const [index, category] of CATEGORIES.entries()) {
    // `enabled` is only set for a new category: a switch made on the admin page survives a re-seed.
    const { rows } = await db.query(
      `insert into material_categories (key, name_en, name_de, enabled, sort_order) values ($1, $2, $3, $4, $5)
       on conflict (key) do update set name_en = excluded.name_en, name_de = excluded.name_de, sort_order = excluded.sort_order
       returning id`,
      [category.key, category.nameEn, category.nameDe, category.enabled, index],
    );
    const categoryId = rows[0].id;
    for (const unitKey of category.units ?? []) {
      await db.query(`insert into category_units (category_id, unit_key) values ($1, $2) on conflict do nothing`, [categoryId, unitKey]);
    }
    for (const [table, items] of [["material_types", category.types], ["material_forms", category.forms]]) {
      for (const [order, [key, nameEn, nameDe]] of (items ?? []).entries()) {
        await db.query(
          `insert into ${table} (category_id, key, name_en, name_de, sort_order) values ($1, $2, $3, $4, $5)
           on conflict (category_id, key) do update set name_en = excluded.name_en, name_de = excluded.name_de, sort_order = excluded.sort_order`,
          [categoryId, key, nameEn, nameDe, order],
        );
      }
    }
    for (const [order, a] of (category.attributes ?? []).entries()) {
      await db.query(
        `insert into attribute_definitions
           (category_id, key, name_en, name_de, data_type, unit, min_value, max_value, options, forms, required, critical, required_with, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         on conflict (category_id, key) do update set name_en = excluded.name_en, name_de = excluded.name_de,
           data_type = excluded.data_type, unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
           options = excluded.options, forms = excluded.forms, required = excluded.required, critical = excluded.critical,
           required_with = excluded.required_with, sort_order = excluded.sort_order`,
        [categoryId, a.key, a.nameEn, a.nameDe, a.dataType, a.unit ?? null, a.minValue ?? null, a.maxValue ?? null,
          json(a.options), json(a.forms), a.required ?? false, a.critical ?? false, a.requiredWith ?? null, order],
      );
    }
  }
  for (const park of PARKS) {
    await db.query(
      `insert into industrial_parks (slug, name, city, latitude, longitude, radius_m, source_note) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (slug) do update set name = excluded.name, city = excluded.city, latitude = excluded.latitude,
         longitude = excluded.longitude, radius_m = excluded.radius_m, source_note = excluded.source_note`,
      [park.slug, park.name, park.city, park.latitude, park.longitude, park.radiusM, park.sourceNote],
    );
  }
  console.log(`Reference data: ${CATEGORIES.length} categories, ${UNITS.length} units, ${PARKS.length} industrial parks`);
}

/**
 * Removes every demo record: the fictional sites and the sites registered by accounts of the demo e-mail domain
 * (test registrations), with their listings, requests, enquiries and responses, those logins and the demo admin.
 * Other data stays.
 */
async function resetDemo(db) {
  const demoSites = `select id from sites where provenance = 'synthetic'
                       or id in (select site_id from auth_users where email like $1 and site_id is not null)`;
  const domain = [`%@${DEMO_EMAIL_DOMAIN}`];
  await db.query(`delete from demo_cases`);
  await db.query(`delete from enquiries where from_site_id in (${demoSites}) or to_site_id in (${demoSites})`, domain);
  await db.query(`delete from request_responses where from_site_id in (${demoSites}) or to_site_id in (${demoSites})`, domain);
  await db.query(`delete from requests where site_id in (${demoSites})`, domain);
  await db.query(`delete from offers where site_id in (${demoSites})`, domain);
  await db.query(`create temporary table demo_site_ids on commit drop as ${demoSites}`, domain);
  await db.query(`delete from auth_users where email like $1`, domain);
  await db.query(`update sites set duplicate_of_site_id = null where duplicate_of_site_id in (select id from demo_site_ids)`);
  await db.query(`delete from sites where id in (select id from demo_site_ids)`);
  await db.query(`delete from companies where not exists (select 1 from sites where sites.company_id = companies.id)`);
  console.log("Demo data removed");
}

async function createLogin(db, { username, name, email, passwordHash, siteId, role, companyName, vatId }) {
  const userId = id();
  await db.query(
    `insert into auth_users (id, name, email, email_verified, username, site_id, role, company_name, vat_id, material_interest)
     values ($1, $2, $3, true, $4, $5, $6, $7, $8, 'plastics')`,
    [userId, name, email, username, siteId, role, companyName, vatId],
  );
  await db.query(
    `insert into auth_accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
     values ($1, $2, 'credential', $2, $3, now(), now())`,
    [id(), userId, passwordHash],
  );
  return userId;
}

async function seedDemo(db, password, adminPassword) {
  const existing = await db.query(`select 1 from sites where provenance = 'synthetic' limit 1`);
  if (existing.rowCount > 0) {
    console.log("Demo data already present – use --reset-demo to replace it");
    return false;
  }
  const passwordHash = await hashPassword(password);
  const lookup = async (table, where, params) => (await db.query(`select id from ${table} where ${where}`, params)).rows[0]?.id;
  const plastics = await lookup("material_categories", "key = 'plastics'", []);
  // The administrator verifies sites: knowing a site's demo password must not be enough to log in as administrator.
  const adminId = await createLogin(db, {
    username: ADMIN.username, name: ADMIN.name, email: `admin@${DEMO_EMAIL_DOMAIN}`, passwordHash: await hashPassword(adminPassword), siteId: null, role: "admin", companyName: null, vatId: null,
  });

  const companyIds = {};
  for (const company of COMPANIES) {
    const { rows } = await db.query(`insert into companies (name, vat_id) values ($1, $2) returning id`, [company.name, company.vatId]);
    companyIds[company.key] = rows[0].id;
  }

  const siteIds = {};
  const userIds = {};
  for (const site of SITES) {
    const company = COMPANIES.find((entry) => entry.key === site.company);
    const parkId = await lookup("industrial_parks", "slug = $1", [site.park]);
    const email = `${site.username.replace("_", "-")}@${DEMO_EMAIL_DOMAIN}`;
    const verified = site.status === "verified";
    const { rows } = await db.query(
      `insert into sites (company_id, name, description, street_address, postal_code, city, address_key, park_id, latitude, longitude,
         contact_name, contact_email, contact_phone, capabilities, verification_status, verified_by, verified_at, verification_note,
         contact_visible, public_listed, provenance, industry)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true, $19, 'synthetic', $20) returning id`,
      [companyIds[site.company], site.name, site.description, site.street, site.postalCode, site.city, addressKey(site.street, site.postalCode),
        parkId, site.latitude, site.longitude, site.contact, email, "+49 0000 000000", json(site.capabilities), site.status,
        verified ? adminId : null, verified ? new Date() : null, verified ? "Fictional demo site, verified by the seed." : null, verified, site.industry],
    );
    siteIds[site.key] = rows[0].id;
    if (verified) {
      await db.query(
        `insert into site_verification_events (site_id, actor_user_id, from_status, to_status, note) values ($1, $2, 'pending', 'verified', $3)`,
        [rows[0].id, adminId, "Fictional demo site, verified by the seed."],
      );
    }
    userIds[site.key] = await createLogin(db, {
      username: site.username, name: site.contact, email, passwordHash, siteId: rows[0].id, role: "member", companyName: company.name, vatId: company.vatId,
    });
  }

  const offerIds = {};
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  for (const offer of OFFERS) {
    const typeId = await lookup("material_types", "category_id = $1 and key = $2", [plastics, offer.type]);
    const formId = await lookup("material_forms", "category_id = $1 and key = $2", [plastics, offer.form]);
    const amount = offer.priceMode === "free" ? 0 : (offer.priceAmount ?? null);
    const payer = offer.priceMode === "paid_recovery" ? "offerer" : ["fixed", "negotiable"].includes(offer.priceMode) ? "requester" : null;
    const { rows } = await db.query(
      `insert into offers (site_id, status, title, description, category_id, type_id, form_id, origin, legal_status, waste_code,
         quantity, unit_key, min_lot, frequency, recurrence_period, recurrence_quantity, available_from, validity_days, expires_at,
         price_mode, price_amount, price_unit_key, vat_basis, payer, delivery_pricing, max_delivery_distance_km, packaging, loading_equipment,
         evidence_status, datasheet_available, datasheet_access, photos_available, sample_available, provenance, published_at)
       values ($1, 'active', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, current_date, $16, $17, $18, $19, $20, 'net', $21,
         $22, $23, $24, $25, $26, $27, 'on_enquiry', true, $28, 'synthetic', $29) returning id`,
      [siteIds[offer.site], offer.title, offer.description, plastics, typeId, formId, offer.origin, offer.legalStatus, offer.wasteCode ?? null,
        offer.quantity, offer.unit, offer.minLot ?? null, offer.frequency, offer.period ?? null, offer.recurrenceQuantity ?? null,
        VALIDITY_DAYS, expiresAt, offer.priceMode, amount, amount ? offer.priceUnit : null, payer,
        offer.deliveryPricing ?? null, offer.maxDistance ?? null, offer.packaging, offer.loadingEquipment,
        offer.evidence, offer.datasheet ?? false, offer.sample, now],
    );
    const offerId = rows[0].id;
    offerIds[offer.key] = offerId;
    const site = SITES.find((entry) => entry.key === offer.site);
    for (const option of offer.delivery) {
      const formal = option.term !== "custom";
      const place = option.place === "site" ? `${site.name}, ${site.city}` : option.place;
      await db.query(
        `insert into offer_delivery_options (offer_id, term, named_place, incoterms_version, custom_note) values ($1, $2, $3, $4, $5)`,
        [offerId, option.term, formal ? place : null, formal ? "2020" : null, formal ? null : option.note],
      );
    }
    for (const [key, value] of Object.entries(offer.attributes)) {
      const attributeId = await lookup("attribute_definitions", "category_id = $1 and key = $2", [plastics, key]);
      await db.query(
        `insert into offer_attribute_values (offer_id, attribute_id, value_min, value_max, comparator, value_text) values ($1, $2, $3, $4, $5, $6)`,
        [offerId, attributeId, value.min ?? null, value.max ?? null, value.comparator ?? null, value.text ?? null],
      );
    }
    await db.query(
      `insert into offer_revisions (offer_id, revision, actor_user_id, action, status, snapshot) values ($1, 1, $2, 'published', 'active', $3)`,
      [offerId, userIds[offer.site], JSON.stringify({ seeded: true, title: offer.title })],
    );
  }

  for (const entry of CASES) {
    await db.query(
      `insert into demo_cases (code, title_en, title_de, text_en, text_de, pathway, offer_id, from_site_id, to_site_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [entry.code, entry.titleEn, entry.titleDe, entry.textEn, entry.textDe, entry.pathway, offerIds[entry.offer], siteIds[entry.from], entry.to ? siteIds[entry.to] : null],
    );
  }
  const requestIds = {};
  for (const request of REQUESTS) {
    const { rows } = await db.query(
      `insert into requests (site_id, status, title, description, category_id, origins, quantity, unit_key, min_lot, frequency,
         recurrence_period, validity_days, expires_at, max_price_amount, max_price_unit_key, delivery_terms, evidence_status,
         sample_required, provenance, published_at)
       values ($1, 'active', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'synthetic', $18) returning id`,
      [siteIds[request.site], request.title, request.description, plastics, json(request.origins), request.quantity, request.unit, request.minLot,
        request.frequency, request.period, VALIDITY_DAYS, expiresAt, request.maxPrice, request.maxPriceUnit, json(request.delivery),
        request.evidence, request.sampleRequired, now],
    );
    const requestId = rows[0].id;
    requestIds[request.key] = requestId;
    for (const type of request.types) {
      await db.query(`insert into request_types (request_id, type_id) values ($1, $2)`, [requestId, await lookup("material_types", "category_id = $1 and key = $2", [plastics, type])]);
    }
    for (const form of request.forms) {
      await db.query(`insert into request_forms (request_id, form_id) values ($1, $2)`, [requestId, await lookup("material_forms", "category_id = $1 and key = $2", [plastics, form])]);
    }
    for (const [key, value] of Object.entries(request.criteria)) {
      const attributeId = await lookup("attribute_definitions", "category_id = $1 and key = $2", [plastics, key]);
      await db.query(
        `insert into request_criteria (request_id, attribute_id, kind, value_min, value_max, value_text) values ($1, $2, $3, $4, $5, $6)`,
        [requestId, attributeId, value.kind, value.min ?? null, value.max ?? null, value.text ?? null],
      );
    }
    await db.query(
      `insert into request_revisions (request_id, revision, actor_user_id, action, status, snapshot) values ($1, 1, $2, 'published', 'active', $3)`,
      [requestId, userIds[request.site], JSON.stringify({ seeded: true, title: request.title })],
    );
  }
  for (const response of RESPONSES) {
    const request = REQUESTS.find((entry) => entry.key === response.request);
    await db.query(
      `insert into request_responses (request_id, from_site_id, to_site_id, sender_user_id, offer_id, request_revision, message)
       values ($1, $2, $3, $4, $5, 1, $6)`,
      [requestIds[response.request], siteIds[response.from], siteIds[request.site], userIds[response.from], offerIds[response.offer], response.message],
    );
  }
  console.log(`Demo data: ${SITES.length} fictional sites, ${OFFERS.length} listings, ${REQUESTS.length} requests, ${CASES.length} illustrative cases`);
  return true;
}

// Given passwords must meet at least the rule of the app (and be longer): they protect logins anyone can guess the names of.
const PASSWORD_RULE = /^(?=.*\d)(?=.*\p{Lu}).{12,128}$/u;
for (const name of ["DEMO_PASSWORD", "DEMO_ADMIN_PASSWORD"]) {
  if (process.env[name] !== undefined && !PASSWORD_RULE.test(process.env[name])) {
    console.error(`${name}: at least 12 characters with a digit and a capital letter`);
    process.exit(1);
  }
}
const randomPassword = (prefix) => `${prefix}-${randomBytes(9).toString("base64url")}-7K`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await seedReference(client);
  if (args.has("--reset-demo")) await resetDemo(client);
  let logins = null;
  if (withDemo) {
    const password = process.env.DEMO_PASSWORD ?? randomPassword("Demo");
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? randomPassword("Admin");
    if (await seedDemo(client, password, adminPassword)) logins = { password, adminPassword };
  }
  await client.query("commit");
  if (logins) {
    console.log("\nDemo logins (username – role):");
    console.log(`  ${ADMIN.username} – administrator`);
    for (const site of SITES) console.log(`  ${site.username} – ${site.name}, ${site.status}`);
    console.log(process.env.DEMO_PASSWORD ? "Password of the demo sites: the value of DEMO_PASSWORD" : `Password of the demo sites (shown once): ${logins.password}`);
    console.log(process.env.DEMO_ADMIN_PASSWORD ? "Password of admin_demo: the value of DEMO_ADMIN_PASSWORD" : `Password of admin_demo (shown once): ${logins.adminPassword}`);
  }
} catch (error) {
  await client.query("rollback");
  console.error("Seed failed, nothing was changed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
