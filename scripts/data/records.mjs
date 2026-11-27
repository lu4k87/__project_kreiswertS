// Rows of the region data files (scripts/data-csv.mjs): columns, checks and the address rule shared with the seed.
// Pure – no database. The value lists copy src/server/domain/listing.ts (plain Node cannot import TypeScript);
// scripts/data/records.test.mjs fails when the two drift apart.

export const INDUSTRIES = ["manufacturing", "recycling", "packaging", "construction", "logistics", "other"];
export const CAPABILITIES = ["cutting", "grinding", "sorting", "regranulation", "compounding", "other"];
export const SITE_PROVENANCES = ["synthetic", "registered"];

/** street + postal code without case, spaces and punctuation – same rule as addressKey() in src/server/validation/sites.ts */
export const addressKey = (street, postalCode) => {
  const fold = (value) =>
    value.toLowerCase().replace(/ß/g, "ss").replace(/stra(ss|ß)e\b|str\.?(?=\s|\d|$)/g, "str").normalize("NFKD").replace(/[^a-z0-9]/g, "");
  return `${fold(postalCode)}|${fold(street)}`;
};

const KEY = /^[a-z0-9_]{2,40}$/;
const SLUG = /^[a-z0-9-]{2,60}$/;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()/-]{6,30}$/;
const VAT_ID = /^[A-Z]{2}[A-Za-z0-9]{2,18}$/;
const POSTAL_CODE = /^[A-Za-z0-9 -]{3,10}$/;

// Column kinds: each returns [value] or [undefined, message]. An empty cell is null unless the column is required.
const HINTS = new Map([
  [KEY, "lower-case letters, digits and _"], [SLUG, "lower-case letters, digits and -"], [EMAIL, "an e-mail address"],
  [PHONE, "digits, spaces and + ( ) / -"], [VAT_ID, "country code and number, e.g. DE123456789"], [POSTAL_CODE, "letters, digits, spaces and -"],
  [LETTER_OR_DIGIT, "with a letter or digit"],
]);
const text = (max, { min = 1, pattern = LETTER_OR_DIGIT } = {}) => (raw) =>
  raw.length < min || raw.length > max || !pattern.test(raw) ? [undefined, `${min}–${max} characters, ${HINTS.get(pattern)}`] : [raw];
const decimal = (min, max) => (raw) => {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= min && value <= max ? [value] : [undefined, `a number from ${min} to ${max}`];
};
const integer = (min, max) => (raw) => (/^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= max ? [Number(raw)] : [undefined, `a whole number from ${min} to ${max}`]);
const oneOf = (values) => (raw) => (values.includes(raw) ? [raw] : [undefined, `one of ${values.join(", ")}`]);
const listOf = (values) => (raw) => {
  const items = [...new Set(raw.split("|").map((item) => item.trim()).filter(Boolean))];
  const wrong = items.filter((item) => !values.includes(item));
  return wrong.length ? [undefined, `"${wrong.join("|")}" – allowed, separated by |: ${values.join(", ")}`] : [items];
};
const yesNo = (raw) => (/^(true|yes|ja|1)$/i.test(raw) ? [true] : /^(false|no|nein|0)$/i.test(raw) ? [false] : [undefined, "true or false"]);

/**
 * The files of a region: column → [check, required, default]. Row order is the sort order of categories and
 * materials. Units, attributes and emission factors stay in scripts/seed/reference.mjs (they carry rules, not lists).
 */
export const FILES = {
  "parks.csv": {
    slug: [text(60, { min: 2, pattern: SLUG }), true],
    name: [text(150, { min: 2 }), true],
    city: [text(100, { min: 2 }), true],
    latitude: [decimal(-90, 90), true],
    longitude: [decimal(-180, 180), true],
    radius_m: [integer(100, 5000), false, 600],
    source_note: [text(500, { min: 2 }), true],
  },
  "categories.csv": {
    key: [text(40, { min: 2, pattern: KEY }), true],
    name_en: [text(100), true],
    name_de: [text(100), true],
    enabled: [yesNo, false, false],
  },
  "materials.csv": {
    category: [text(40, { min: 2, pattern: KEY }), true],
    kind: [oneOf(["type", "form"]), true],
    key: [text(40, { min: 2, pattern: KEY }), true],
    name_en: [text(100), true],
    name_de: [text(100), true],
  },
  "sites.csv": {
    company_name: [text(200, { min: 2 }), true],
    company_vat_id: [text(20, { min: 4, pattern: VAT_ID }), false],
    name: [text(200, { min: 2 }), true],
    industry: [oneOf(INDUSTRIES), false, "other"],
    street_address: [text(255, { min: 3 }), true],
    postal_code: [text(10, { min: 3, pattern: POSTAL_CODE }), true],
    city: [text(100, { min: 2 }), true],
    park: [text(60, { min: 2, pattern: SLUG }), false],
    latitude: [decimal(-90, 90), false],
    longitude: [decimal(-180, 180), false],
    description: [text(1500), false],
    capabilities: [listOf(CAPABILITIES), false, []],
    contact_name: [text(150, { min: 2 }), true],
    contact_email: [text(254, { min: 3, pattern: EMAIL }), true],
    contact_phone: [text(30, { min: 6, pattern: PHONE }), false],
    contact_visible: [yesNo, false, true],
    public_listed: [yesNo, false, false],
    provenance: [oneOf(SITE_PROVENANCES), false, "registered"],
    // written by the export for information; the import never sets it – the administrator verifies in the app
    verification_status: [() => [null], false],
  },
};

/**
 * Checks the rows of one file (first row = header). Returns the records as objects and every problem as
 * "file:line column – message"; unknown columns are refused, so a typo never drops data silently.
 */
export function readRecords(file, rows) {
  const columns = FILES[file];
  if (!columns) return { records: [], errors: [`${file} – not a region data file (${Object.keys(FILES).join(", ")})`] };
  const [header = [], ...body] = rows;
  const names = header.map((name) => name.trim().toLowerCase());
  const errors = [];
  for (const name of names.filter((entry) => !(entry in columns))) errors.push(`${file}:1 ${name} – unknown column`);
  for (const [name, [, required]] of Object.entries(columns)) {
    if (required && !names.includes(name)) errors.push(`${file}:1 ${name} – required column is missing`);
  }
  if (errors.length) return { records: [], errors };

  const records = [];
  for (const [index, row] of body.entries()) {
    const line = index + 2;
    const record = {};
    for (const [name, [check, required, fallback = null]] of Object.entries(columns)) {
      const raw = (row[names.indexOf(name)] ?? "").trim();
      if (raw === "") {
        if (required) errors.push(`${file}:${line} ${name} – required`);
        record[name] = fallback;
        continue;
      }
      const [value, message] = check(raw);
      if (message) errors.push(`${file}:${line} ${name} – ${message}`);
      record[name] = value;
    }
    if (file === "sites.csv" && record.latitude !== undefined && record.longitude !== undefined && (record.latitude === null) !== (record.longitude === null)) {
      errors.push(`${file}:${line} latitude/longitude – both or none`);
    }
    records.push({ line, ...record });
  }
  const identity = { "parks.csv": (r) => r.slug, "categories.csv": (r) => r.key, "materials.csv": (r) => `${r.category}/${r.kind}/${r.key}`,
    "sites.csv": (r) => `${r.company_vat_id ?? r.company_name}|${addressKey(r.street_address ?? "", r.postal_code ?? "")}` }[file];
  const seen = new Map();
  for (const record of records) {
    const key = identity(record);
    if (seen.has(key)) errors.push(`${file}:${record.line} – same entry as line ${seen.get(key)}`);
    else seen.set(key, record.line);
  }
  return { records, errors };
}
