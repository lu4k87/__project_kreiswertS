#!/usr/bin/env node
// Region data as spreadsheets (function 34): industrial parks, material catalogue, companies and sites as CSV files
// that Excel or LibreOffice open – export them, edit them, import them into the database of DATABASE_URL.
//
//   node scripts/data-csv.mjs export [dir] [--skip-demo] [--delimiter ";"]   write parks, categories, materials, sites
//   node scripts/data-csv.mjs import [dir] [--dry-run] [--prune-parks]       check every file, then write all or nothing
//
// dir defaults to data-export/ (ignored by Git: sites.csv holds contact data). Import reads only the files that are
// there. It adds or updates, never deletes – except --prune-parks: parks missing from parks.csv that no site uses.
// Imported sites start as "pending" without a login; the administrator verifies them in the app. A site is the same
// when company (VAT ID, else name) and address match – the duplicate rule of the registration. Guide: docs/REPLICATION.md
// Run `npm run db:push` and `npm run db:seed` first: units, attributes and emission factors come from the seed.
import dotenv from "dotenv";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { parseCsv, toCsv } from "./data/csv.mjs";
import { FILES, addressKey, readRecords } from "./data/records.mjs";

dotenv.config({ path: ".env", quiet: true });

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((arg) => arg.startsWith("--")));
const delimiterIndex = rest.indexOf("--delimiter");
const delimiter = delimiterIndex >= 0 ? rest[delimiterIndex + 1] : ",";
const dir = rest.find((arg, index) => !arg.startsWith("--") && rest[index - 1] !== "--delimiter") ?? "data-export";

if (!["export", "import"].includes(command) || ![",", ";"].includes(delimiter)) {
  console.error('Usage: node scripts/data-csv.mjs export|import [dir] [--skip-demo] [--delimiter ";"] [--dry-run] [--prune-parks]');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing – create .env from .env.example");
  process.exit(1);
}

async function exportFiles(db) {
  const skipDemo = flags.has("--skip-demo") ? "where s.provenance <> 'synthetic'" : "";
  const queries = {
    "parks.csv": `select slug, name, city, latitude, longitude, radius_m, source_note from industrial_parks order by id`,
    "categories.csv": `select key, name_en, name_de, enabled from material_categories order by sort_order, id`,
    "materials.csv": `select c.key as category, m.kind, m.key, m.name_en, m.name_de from material_categories c
       join (select category_id, 'type' as kind, key, name_en, name_de, sort_order, id from material_types
             union all select category_id, 'form', key, name_en, name_de, sort_order, id from material_forms) m on m.category_id = c.id
       order by c.sort_order, c.id, m.kind desc, m.sort_order, m.id`,
    "sites.csv": `select c.name as company_name, c.vat_id as company_vat_id, s.name, s.industry, s.street_address, s.postal_code, s.city,
         p.slug as park, s.latitude, s.longitude, s.description, s.capabilities, s.contact_name, s.contact_email, s.contact_phone,
         s.contact_visible, s.public_listed, s.provenance, s.verification_status
       from sites s join companies c on c.id = s.company_id left join industrial_parks p on p.id = s.park_id ${skipDemo} order by c.name, s.id`,
  };
  mkdirSync(dir, { recursive: true });
  for (const [file, sql] of Object.entries(queries)) {
    const { rows } = await db.query(sql);
    const columns = Object.keys(FILES[file]);
    const cells = rows.map((row) => columns.map((name) => (Array.isArray(row[name]) ? row[name].join("|") : row[name])));
    writeFileSync(path.join(dir, file), toCsv([columns, ...cells], delimiter), { mode: 0o600 });
    console.log(`${file}: ${rows.length} rows`);
  }
  console.log(`Written to ${dir}/ – sites.csv holds contact data: never commit or mail it unencrypted`);
}

async function importFiles(db) {
  const data = {};
  const errors = [];
  for (const file of Object.keys(FILES)) {
    const full = path.join(dir, file);
    if (!existsSync(full)) continue;
    const result = readRecords(file, parseCsv(readFileSync(full, "utf8")));
    data[file] = result.records;
    errors.push(...result.errors);
  }
  if (Object.keys(data).length === 0) throw new Error(`no region data file in ${dir}/ (${Object.keys(FILES).join(", ")})`);

  // References may point at rows of the same import or at rows already in the database.
  const known = async (sql, values) => new Set((await db.query(sql)).rows.map((row) => row.key).concat(values));
  const parks = await known(`select slug as key from industrial_parks`, (data["parks.csv"] ?? []).map((park) => park.slug));
  const categories = await known(`select key from material_categories`, (data["categories.csv"] ?? []).map((category) => category.key));
  for (const material of data["materials.csv"] ?? []) {
    if (material.category && !categories.has(material.category)) errors.push(`materials.csv:${material.line} category – "${material.category}" is neither in categories.csv nor in the database`);
  }
  for (const site of data["sites.csv"] ?? []) {
    if (site.park && !parks.has(site.park)) errors.push(`sites.csv:${site.line} park – "${site.park}" is neither in parks.csv nor in the database`);
  }
  if (errors.length) throw new Error(`${errors.length} problem(s)\n${errors.map((error) => `  ${error}`).join("\n")}`);

  const counts = {};
  const count = (file, created) => {
    counts[file] ??= { created: 0, updated: 0 };
    counts[file][created ? "created" : "updated"] += 1;
  };
  const created = (rows) => rows[0].created;

  for (const park of data["parks.csv"] ?? []) {
    count("parks.csv", created((await db.query(
      `insert into industrial_parks (slug, name, city, latitude, longitude, radius_m, source_note) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (slug) do update set name = excluded.name, city = excluded.city, latitude = excluded.latitude,
         longitude = excluded.longitude, radius_m = excluded.radius_m, source_note = excluded.source_note
       returning (xmax = 0) as created`,
      [park.slug, park.name, park.city, park.latitude, park.longitude, park.radius_m, park.source_note],
    )).rows));
  }
  if (flags.has("--prune-parks") && data["parks.csv"]) {
    const { rowCount } = await db.query(
      `delete from industrial_parks where not (slug = any($1)) and not exists (select 1 from sites where sites.park_id = industrial_parks.id)`,
      [data["parks.csv"].map((park) => park.slug)],
    );
    console.log(`parks.csv: ${rowCount} unused park(s) removed`);
  }
  // `enabled` only counts for a new category – a switch made on the admin page survives, as in the seed.
  for (const [order, category] of (data["categories.csv"] ?? []).entries()) {
    count("categories.csv", created((await db.query(
      `insert into material_categories (key, name_en, name_de, enabled, sort_order) values ($1, $2, $3, $4, $5)
       on conflict (key) do update set name_en = excluded.name_en, name_de = excluded.name_de, sort_order = excluded.sort_order
       returning (xmax = 0) as created`,
      [category.key, category.name_en, category.name_de, category.enabled, order],
    )).rows));
  }
  const order = {};
  for (const material of data["materials.csv"] ?? []) {
    const table = material.kind === "type" ? "material_types" : "material_forms";
    const position = (order[`${material.category}/${material.kind}`] ??= 0);
    order[`${material.category}/${material.kind}`] += 1;
    count("materials.csv", created((await db.query(
      `insert into ${table} (category_id, key, name_en, name_de, sort_order)
       values ((select id from material_categories where key = $1), $2, $3, $4, $5)
       on conflict (category_id, key) do update set name_en = excluded.name_en, name_de = excluded.name_de, sort_order = excluded.sort_order
       returning (xmax = 0) as created`,
      [material.category, material.key, material.name_en, material.name_de, position],
    )).rows));
  }

  for (const site of data["sites.csv"] ?? []) {
    let company = site.company_vat_id
      ? (await db.query(`select id from companies where vat_id = $1`, [site.company_vat_id])).rows[0]
      : (await db.query(`select id from companies where vat_id is null and name = $1 order by id limit 1`, [site.company_name])).rows[0];
    // the name of an existing company stays: the first verified site decides it (FEATURES.md, registration)
    company ??= (await db.query(`insert into companies (name, vat_id) values ($1, $2) returning id`, [site.company_name, site.company_vat_id])).rows[0];
    const key = addressKey(site.street_address, site.postal_code);
    const parkId = site.park ? (await db.query(`select id from industrial_parks where slug = $1`, [site.park])).rows[0].id : null;
    const values = [site.name, site.industry, site.description, site.city, parkId, site.latitude, site.longitude, site.contact_name,
      site.contact_email, site.contact_phone, JSON.stringify(site.capabilities), site.contact_visible, site.public_listed];
    const existing = (await db.query(`select id from sites where company_id = $1 and address_key = $2 order by id limit 1`, [company.id, key])).rows[0];
    if (existing) {
      await db.query(
        `update sites set name = $1, industry = $2, description = $3, city = $4, park_id = $5, latitude = $6, longitude = $7, contact_name = $8,
           contact_email = $9, contact_phone = $10, capabilities = $11, contact_visible = $12, public_listed = $13, updated_at = now() where id = $14`,
        [...values, existing.id],
      );
    } else {
      await db.query(
        `insert into sites (name, industry, description, city, park_id, latitude, longitude, contact_name, contact_email, contact_phone,
           capabilities, contact_visible, public_listed, company_id, street_address, postal_code, address_key, provenance, verification_status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'pending')`,
        [...values, company.id, site.street_address, site.postal_code, key, site.provenance],
      );
    }
    count("sites.csv", !existing);
  }

  for (const [file, { created: added, updated }] of Object.entries(counts)) console.log(`${file}: ${added} new, ${updated} updated`);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (command === "export") {
    await exportFiles(client);
  } else {
    await client.query("begin");
    await importFiles(client);
    await client.query(flags.has("--dry-run") ? "rollback" : "commit");
    console.log(flags.has("--dry-run") ? "Dry run: every file checked, nothing was saved" : "Import saved");
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`${command} failed, nothing was changed:`, error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
