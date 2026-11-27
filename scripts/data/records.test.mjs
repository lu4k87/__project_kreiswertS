import { describe, expect, it } from "vitest";
import { CAPABILITIES, INDUSTRIES, SITE_PROVENANCES } from "../../src/server/domain/listing";
import { addressKey as appAddressKey } from "../../src/server/validation/sites";
import { COMPANIES, OFFERS, REQUESTS, SITES } from "../seed/demo.mjs";
import { parseCsv, toCsv } from "./csv.mjs";
import * as records from "./records.mjs";

describe("CSV", () => {
  it("reads quotes, delimiters and line breaks inside fields", () => {
    expect(parseCsv('a,b\r\n"x, ""y""","line\nbreak"\r\n\r\n')).toEqual([["a", "b"], ['x, "y"', "line\nbreak"]]);
  });

  it("detects the semicolon of German Excel and drops the byte order mark", () => {
    expect(parseCsv("﻿slug;name\ngenend;Gewerbepark, Moers")).toEqual([["slug", "name"], ["genend", "Gewerbepark, Moers"]]);
  });

  it("refuses an unclosed quote", () => {
    expect(() => parseCsv('a\n"open')).toThrow(/not closed/);
  });

  it("round-trips what it writes, also with the other delimiter", () => {
    const rows = [["name", "note"], ["Werk A", 'sagt "hallo"; dann, Pause\nzweite Zeile'], ["-6.5", ""]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    expect(parseCsv(toCsv(rows, ";"))).toEqual(rows);
  });

  it("never writes a cell a spreadsheet would run as a formula (CWE-1236), and reads it back unchanged", () => {
    const csv = toCsv([["description"], ["=HYPERLINK(\"http://evil.example\")"], ["@SUM(A1)"], ["-12.5"], ["+49 2842 1234"]]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@SUM");
    expect(csv).toContain("\r\n-12.5\r\n+49 2842 1234\r\n");
    expect(parseCsv(csv).slice(1).map(([cell]) => cell)).toEqual(['=HYPERLINK("http://evil.example")', "@SUM(A1)", "-12.5", "+49 2842 1234"]);
  });
});

describe("region data records", () => {
  it("keeps the value lists and the address rule of the app", () => {
    expect(records.INDUSTRIES).toEqual([...INDUSTRIES]);
    expect(records.CAPABILITIES).toEqual([...CAPABILITIES]);
    expect(records.SITE_PROVENANCES).toEqual([...SITE_PROVENANCES]);
    for (const [street, postal] of [["Musterstraße 1", "47475"], ["Muster Str. 1", "47475"], ["Hauptstr.12a", "D-1234"]]) {
      expect(records.addressKey(street, postal)).toBe(appAddressKey(street, postal));
    }
  });

  const site = ["Firma GmbH (fiktiv)", "DE000000099", "Werk Z", "recycling", "Weg 1", "47475", "Kamp-Lintfort", "genend", "51,5", "6.5", "", "grinding|sorting|grinding", "Kontakt Z", "z@kreiswerts.example", "", "nein", "true"];
  const header = ["company_name", "company_vat_id", "name", "industry", "street_address", "postal_code", "city", "park", "latitude", "longitude", "description", "capabilities", "contact_name", "contact_email", "contact_phone", "contact_visible", "public_listed"];

  it("turns a site row into typed values with defaults", () => {
    const { records: [row], errors } = records.readRecords("sites.csv", [header, site]);
    expect(errors).toEqual([]);
    expect(row).toMatchObject({ line: 2, latitude: 51.5, longitude: 6.5, capabilities: ["grinding", "sorting"], contact_visible: false, public_listed: true, provenance: "registered", description: null });
  });

  it("names file, line and column of every problem", () => {
    const bad = [...site];
    bad[3] = "mining";
    bad[9] = "";
    bad[11] = "grinding|melting";
    bad[13] = "no-mail";
    const { errors } = records.readRecords("sites.csv", [header, bad]);
    expect(errors).toEqual([
      expect.stringMatching(/^sites\.csv:2 industry – one of/),
      expect.stringMatching(/^sites\.csv:2 capabilities – "melting"/),
      expect.stringMatching(/^sites\.csv:2 contact_email – /),
      "sites.csv:2 latitude/longitude – both or none",
    ]);
  });

  it("refuses unknown and missing columns, and the same site twice", () => {
    expect(records.readRecords("parks.csv", [["slug", "nmae"]]).errors).toEqual(expect.arrayContaining(["parks.csv:1 nmae – unknown column", "parks.csv:1 name – required column is missing"]));
    const twice = [...site];
    twice[4] = "Weg  1."; // same address after folding
    expect(records.readRecords("sites.csv", [header, site, twice]).errors).toEqual(["sites.csv:3 – same entry as line 2"]);
    expect(records.readRecords("units.csv", []).errors[0]).toMatch(/not a region data file/);
  });
});

describe("demo data", () => {
  it("documents at least ten fictional companies, each with a site (project goal)", () => {
    expect(COMPANIES.length).toBeGreaterThanOrEqual(10);
    expect(COMPANIES.every((company) => company.name.endsWith("(fiktiv)"))).toBe(true);
    expect(COMPANIES.every((company) => SITES.some((entry) => entry.company === company.key))).toBe(true);
    expect(new Set(COMPANIES.map((company) => company.vatId)).size).toBe(COMPANIES.length);
  });

  it("uses only known values and unique logins", () => {
    expect(new Set(SITES.map((entry) => entry.username)).size).toBe(SITES.length);
    for (const entry of SITES) {
      expect(INDUSTRIES).toContain(entry.industry);
      for (const capability of entry.capabilities) expect(CAPABILITIES).toContain(capability);
    }
    const siteKeys = SITES.map((entry) => entry.key);
    expect([...OFFERS, ...REQUESTS].every((listing) => siteKeys.includes(listing.site))).toBe(true);
  });

  it("keeps the gaps the acceptance runs count on", () => {
    const near = (offer) => SITES.find((entry) => entry.key === offer.site).status === "verified";
    const offers = OFFERS.filter(near);
    expect(offers.filter((offer) => offer.type === "hdpe" && offer.form === "sheet").map((offer) => offer.quantity)).toEqual([80, 200]);
    expect(offers.some((offer) => offer.type === "pp")).toBe(false);
    expect(offers.some((offer) => ["ldpe", "pvc"].includes(offer.type) && offer.form === "regrind")).toBe(false);
    expect(SITES.filter((entry) => entry.status === "pending").map((entry) => entry.key)).toEqual(["e"]);
  });
});
