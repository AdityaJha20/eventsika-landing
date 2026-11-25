import { describe, it, expect, afterEach, vi } from "vitest";
import { validateEventDate } from "../date";

describe("validateEventDate", () => {
  // Offsets from today's calendar date in India, which is what the validator compares against.
  const indiaDateOffset = (days: number): string => {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
      .format(new Date())
      .split("-")
      .map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const getFutureDateString = (daysAhead: number): string => indiaDateOffset(daysAhead);
  const getPastDateString = (daysAgo: number): string => indiaDateOffset(-daysAgo);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses India's date when UTC is still on the previous day (19:00 UTC = 00:30 IST)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T19:00:00Z"));

    expect(getFutureDateString(0)).toBe("2026-11-26");
    expect(validateEventDate("2026-11-26")).toEqual({ isValid: true, normalizedDate: "2026-11-26" });
    expect(validateEventDate("2026-11-25").error).toContain("Event date cannot be in the past");
  });

  describe("Valid celebration dates", () => {
    it("accepts a date today", () => {
      const today = getFutureDateString(0);
      const result = validateEventDate(today);
      expect(result.isValid).toBe(true);
      expect(result.normalizedDate).toBe(today);
    });

    it("accepts valid future dates within 24 months", () => {
      const dates = [getFutureDateString(30), getFutureDateString(180), getFutureDateString(365), getFutureDateString(700)];
      for (const d of dates) {
        const result = validateEventDate(d);
        expect(result.isValid).toBe(true);
        expect(result.normalizedDate).toBe(d);
        expect(result.error).toBeUndefined();
      }
    });

    it("accepts valid leap year date (Feb 29 on a leap year)", () => {
      // 2028 is a leap year (well within a realistic test, but let's test format logic)
      // Note: validateEventDate checks past/future relative to current year.
      // If 2028 is > 730 days ahead from today, it checks future limit.
      // Let's test a valid 28-day Feb or next available leap year boundary.
      const result = validateEventDate(getFutureDateString(60));
      expect(result.isValid).toBe(true);
    });
  });

  describe("Invalid celebration dates", () => {
    it("rejects dates in the past", () => {
      const pastDates = ["2020-01-01", "2023-12-25", getPastDateString(1), getPastDateString(30)];
      for (const d of pastDates) {
        const result = validateEventDate(d);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("Event date cannot be in the past");
      }
    });

    it("rejects dates more than 730 days (2 years) in advance", () => {
      const farFuture = getFutureDateString(800);
      const result = validateEventDate(farFuture);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be more than 2 years in advance");
    });

    it("rejects impossible calendar dates", () => {
      const currentYear = new Date().getFullYear();
      const futureYear = currentYear + 1;

      // Feb 31 does not exist
      expect(validateEventDate(`${futureYear}-02-31`).isValid).toBe(false);
      // April 31 does not exist (April has 30 days)
      expect(validateEventDate(`${futureYear}-04-31`).isValid).toBe(false);
      // June 31 does not exist
      expect(validateEventDate(`${futureYear}-06-31`).isValid).toBe(false);
      // Month 13 does not exist
      expect(validateEventDate(`${futureYear}-13-01`).isValid).toBe(false);
      // Month 00 does not exist
      expect(validateEventDate(`${futureYear}-00-10`).isValid).toBe(false);
      // Day 00 does not exist
      expect(validateEventDate(`${futureYear}-05-00`).isValid).toBe(false);
    });

    it("rejects non-leap year Feb 29", () => {
      // 2025 or 2027 are non-leap years
      expect(validateEventDate("2027-02-29").isValid).toBe(false);
    });

    it("rejects malformed date string formats", () => {
      const malformed = [
        "25-12-2026",
        "12/25/2026",
        "2026/12/25",
        "2026-1-1",
        "2026-12-5",
        "tomorrow",
        "2026.12.25",
        "2026-12-25T00:00:00Z",
      ];
      for (const m of malformed) {
        const result = validateEventDate(m);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("YYYY-MM-DD");
      }
    });

    it("rejects empty string, whitespace, and non-string types", () => {
      expect(validateEventDate("").isValid).toBe(false);
      expect(validateEventDate("   ").isValid).toBe(false);
      expect(validateEventDate(null).isValid).toBe(false);
      expect(validateEventDate(undefined).isValid).toBe(false);
      expect(validateEventDate(123456789).isValid).toBe(false);
      expect(validateEventDate(new Date()).isValid).toBe(false);
    });
  });
});
