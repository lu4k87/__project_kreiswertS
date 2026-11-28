// The flakes exist twice: inline in brand-mark.tsx (follows the theme switch) and as files in public/brand/ (favicon,
// downloads). This test fails as soon as one side is changed without the other.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const table = [...read("src/components/ui/brand-mark.tsx").matchAll(/\["([\d., ]+)", "(#[0-9a-f]{6})", "(#[0-9a-f]{6})"\]/g)].map(
  ([, points, light, dark]) => ({ points, light, dark }),
);
const polygons = (file: string) =>
  [...read(file).matchAll(/<polygon[^>]*points="([^"]+)"[^>]*fill="(#[0-9a-f]{6})"/g)].map(([, points, fill]) => ({ points, fill }));

describe("brand mark", () => {
  it("has the 8 flakes of the chosen spiral", () => {
    expect(table).toHaveLength(8);
  });

  it("matches public/brand/kreiswerts-mark.svg (light) and -dark.svg", () => {
    expect(polygons("public/brand/kreiswerts-mark.svg")).toEqual(table.map((f) => ({ points: f.points, fill: f.light })));
    expect(polygons("public/brand/kreiswerts-mark-dark.svg")).toEqual(table.map((f) => ({ points: f.points, fill: f.dark })));
  });

  it("uses the same flakes and colours in the small mark and the app icon", () => {
    const fills = table.map((f) => f.light);
    expect(polygons("public/brand/kreiswerts-mark-small.svg").map((p) => p.fill)).toEqual(fills);
    expect(read("src/app/icon.svg")).toBe(read("public/brand/favicon.svg"));
    expect(polygons("src/app/icon.svg").map((p) => p.fill)).toEqual(fills);
  });
});
