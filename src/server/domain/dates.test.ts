import { describe, expect, it } from "vitest";
import { URGENT_WITHIN_DAYS, addDays, calendarDay, isUrgent } from "./dates";

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

describe("isUrgent (function no. 41: deadline in the listing)", () => {
  const today = "2026-11-27";

  it("is urgent from today up to the last day of the window", () => {
    expect(isUrgent(today, today)).toBe(true);
    expect(isUrgent(addDays(today, URGENT_WITHIN_DAYS), today)).toBe(true);
  });

  it("is not urgent without a deadline, after the window or when the deadline has passed", () => {
    expect(isUrgent(null, today)).toBe(false);
    expect(isUrgent(addDays(today, URGENT_WITHIN_DAYS + 1), today)).toBe(false);
    expect(isUrgent("2026-11-26", today)).toBe(false);
  });

  it("counts calendar days across month and year ends", () => {
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2028-02-27", 2)).toBe("2028-02-29");
  });
});
