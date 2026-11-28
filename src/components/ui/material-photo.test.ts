// Every material form of the catalogue has an example photo (except "other"), every photo file exists, and every
// credit names title, author, licence and source – the licences require all four.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain JS seed data without type declarations
import { CATEGORIES } from "../../../scripts/seed/reference.mjs";
import { FORM_PHOTOS, PHOTO_CREDITS, STATUS_PHOTOS, photoFor, type PhotoKey } from "./material-photo";

const root = path.resolve(__dirname, "../../..");
const plastics = (CATEGORIES as { key: string; forms: [string][] }[]).find((category) => category.key === "plastics")!;
const forms = plastics.forms.map(([key]) => key);

describe("material photos", () => {
  it("cover every plastics form except 'other'", () => {
    expect(forms.filter((form) => form !== "other" && !FORM_PHOTOS[form])).toEqual([]);
  });

  it("exist as files for every form and every legal status", () => {
    const keys = new Set<PhotoKey>([...Object.values(FORM_PHOTOS), ...Object.values(STATUS_PHOTOS)]);
    for (const key of keys) expect(existsSync(path.join(root, "public", photoFor(key).src)), key).toBe(true);
  });

  it("name title, author, licence and source", () => {
    for (const credit of PHOTO_CREDITS) {
      expect(credit.title && credit.author && credit.licence, credit.source).toBeTruthy();
      expect(credit.licenceUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
      expect(credit.source).toMatch(/^https:\/\//);
    }
  });
});
