import { describe, it, expect } from "vitest";
import {
  calculateSecondsRemaining,
  formatCountdown,
  getCountdownStatus,
  formatIstDate,
  formatIstTime,
  formatIstSlotRange,
} from "../countdown-utils";

describe("Countdown & Date Utilities", () => {
  describe("calculateSecondsRemaining", () => {
    it("returns correct positive difference in seconds", () => {
      const now = new Date("2026-10-01T10:00:00.000Z").getTime();
      const expiry = "2026-10-01T10:15:00.000Z"; // 15 mins later = 900s
      expect(calculateSecondsRemaining(expiry, now)).toBe(900);
    });

    it("returns 0 when timestamp is in the past", () => {
      const now = new Date("2026-10-01T10:20:00.000Z").getTime();
      const expiry = "2026-10-01T10:15:00.000Z";
      expect(calculateSecondsRemaining(expiry, now)).toBe(0);
    });

    it("handles invalid or empty dates gracefully by returning 0", () => {
      expect(calculateSecondsRemaining("", Date.now())).toBe(0);
      expect(calculateSecondsRemaining("invalid-date", Date.now())).toBe(0);
    });
  });

  describe("formatCountdown", () => {
    it("formats 900 seconds as 15:00", () => {
      expect(formatCountdown(900)).toBe("15:00");
    });

    it("formats 75 seconds as 01:15", () => {
      expect(formatCountdown(75)).toBe("01:15");
    });

    it("formats 9 seconds as 00:09", () => {
      expect(formatCountdown(9)).toBe("00:09");
    });

    it("formats 0 seconds as 00:00", () => {
      expect(formatCountdown(0)).toBe("00:00");
    });

    it("handles negative numbers by pinning to 00:00", () => {
      expect(formatCountdown(-10)).toBe("00:00");
    });
  });

  describe("getCountdownStatus", () => {
    it("returns 'normal' when remaining seconds > 180", () => {
      expect(getCountdownStatus(900)).toBe("normal");
      expect(getCountdownStatus(181)).toBe("normal");
    });

    it("returns 'warning' when remaining seconds <= 180 and > 120", () => {
      expect(getCountdownStatus(180)).toBe("warning");
      expect(getCountdownStatus(150)).toBe("warning");
      expect(getCountdownStatus(121)).toBe("warning");
    });

    it("returns 'critical' when remaining seconds <= 120 and > 0", () => {
      expect(getCountdownStatus(120)).toBe("critical");
      expect(getCountdownStatus(60)).toBe("critical");
      expect(getCountdownStatus(1)).toBe("critical");
    });

    it("returns 'expired' when remaining seconds <= 0", () => {
      expect(getCountdownStatus(0)).toBe("expired");
      expect(getCountdownStatus(-5)).toBe("expired");
    });
  });

  describe("formatIstDate and formatIstTime", () => {
    it("formats UTC timestamp in Asia/Kolkata timezone", () => {
      // 2026-10-02T04:30:00.000Z is 10:00 AM IST on October 2, 2026
      const iso = "2026-10-02T04:30:00.000Z";
      const formattedDate = formatIstDate(iso);
      expect(formattedDate).toContain("October");
      expect(formattedDate).toContain("2026");

      const formattedTime = formatIstTime(iso);
      expect(formattedTime).toMatch(/10:00\s*(AM|am)/i);
    });

    it("formats IST slot range nicely", () => {
      const start = "2026-10-02T04:30:00.000Z"; // 10:00 AM IST
      const end = "2026-10-02T05:30:00.000Z";   // 11:00 AM IST
      const range = formatIstSlotRange(start, end);
      expect(range).toContain("10:00");
      expect(range).toContain("11:00");
      expect(range).toContain("IST");
    });
  });
});
