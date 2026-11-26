import { describe, expect, it } from "vitest";
import { calendarDay } from "./dates";

describe("calendarDay (review 2026-11-26: \"today\" is the day in Germany, not in UTC)", () => {
  it("is already the next day shortly after midnight in Germany", () => {
    // 23:30 UTC on 26 Nov = 00:30 on 27 Nov in Berlin (winter time)
    expect(calendarDay(new Date("2026-11-26T23:30:00Z"))).toBe("2026-11-27");
    expect(calendarDay(new Date("2026-11-26T22:30:00Z"))).toBe("2026-11-26");
  });

  it("follows summer time", () => {
    // 22:30 UTC on 30 Jun = 00:30 on 1 Jul in Berlin (summer time)
    expect(calendarDay(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
  });
});
