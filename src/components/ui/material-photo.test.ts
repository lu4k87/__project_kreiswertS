// Every material form of the catalogue has an example picture (except "other"), so does every category and every
// kind of company (except "other"), and every picture file exists. The pictures are own renders (no credits needed).
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain JS seed data without type declarations
import { CATEGORIES } from "../../../scripts/seed/reference.mjs";
import { INDUSTRIES } from "@/server/domain/listing";
import { CATEGORY_PHOTOS, FORM_PHOTOS, INDUSTRY_PHOTOS, STATUS_PHOTOS, photoFor, type PhotoKey } from "./material-photo";

const root = path.resolve(__dirname, "../../..");
const plastics = (CATEGORIES as { key: string; forms: [string][] }[]).find((category) => category.key === "plastics")!;
const forms = plastics.forms.map(([key]) => key);
const categories = (CATEGORIES as { key: string }[]).map((category) => category.key);

describe("material photos", () => {
  it("cover every plastics form except 'other'", () => {
    expect(forms.filter((form) => form !== "other" && !FORM_PHOTOS[form])).toEqual([]);
  });

  it("cover every material category", () => {
    expect(categories.filter((category) => !CATEGORY_PHOTOS[category])).toEqual([]);
  });

  it("cover every kind of company except 'other'", () => {
    expect(INDUSTRIES.filter((industry) => industry !== "other" && !INDUSTRY_PHOTOS[industry])).toEqual([]);
  });

  it("exist as files for every form, category, legal status and kind of company", () => {
    const keys = new Set<PhotoKey>([...Object.values(FORM_PHOTOS), ...Object.values(CATEGORY_PHOTOS), ...Object.values(STATUS_PHOTOS), ...Object.values(INDUSTRY_PHOTOS), "producer", "recycler"]);
    for (const key of keys) expect(existsSync(path.join(root, "public", photoFor(key).src)), key).toBe(true);
  });
});
