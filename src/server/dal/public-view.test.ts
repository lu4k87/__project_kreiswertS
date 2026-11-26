import { describe, expect, it } from "vitest";
import { MIN_SITES_FOR_AGGREGATE, publicCategories } from "./public-view";

const plastics = { key: "plastics", nameEn: "Plastics", nameDe: "Kunststoffe" };

describe("publicCategories (D12, review 2026-11-26: no small-group disclosure)", () => {
  it("names the categories once enough listed sites stand behind them", () => {
    expect(publicCategories(MIN_SITES_FOR_AGGREGATE, [plastics])).toEqual([plastics]);
  });

  it("stays empty below the threshold – one listed site's activity is not readable from the public map", () => {
    expect(publicCategories(MIN_SITES_FOR_AGGREGATE - 1, [plastics])).toEqual([]);
    expect(publicCategories(1, [plastics])).toEqual([]);
    expect(publicCategories(0, [])).toEqual([]);
  });

  it("returns each category once", () => {
    expect(publicCategories(5, [plastics, { ...plastics }])).toEqual([plastics]);
  });
});
