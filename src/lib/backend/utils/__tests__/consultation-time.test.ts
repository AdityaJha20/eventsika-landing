import { describe, it, expect } from "vitest";
import {
  isSundayInIst,
  calculateAvailabilityWindow,
  generateSlotsForDateRange,
  isSlotPastLeadTime,
  getIstDayOfWeek,
} from "../consultation-time";
import {
  DAILY_CONSULTATION_SLOTS_IST,
  MIN_BOOKING_LEAD_TIME_HOURS,
  ROLLING_AVAILABILITY_DAYS,
  CONSULTATION_DURATION_MINUTES,
  CONSULTATION_BUFFER_MINUTES,
} from "../../types/payment-and-consultation";

describe("Consultation Time Utility (Asia/Kolkata Authoritative)", () => {
  describe("Daily Slots Configuration & Invariants", () => {
    it("has exactly six daily slots", () => {
      expect(DAILY_CONSULTATION_SLOTS_IST).toHaveLength(6);
    });

    it("enforces 60-minute duration and 30-minute buffer for all daily slots", () => {
      const expectedSlots = [
        { startHour: 10, startMinute: 0, endHour: 11, endMinute: 0 },
        { startHour: 11, startMinute: 30, endHour: 12, endMinute: 30 },
        { startHour: 14, startMinute: 0, endHour: 15, endMinute: 0 },
        { startHour: 15, startMinute: 30, endHour: 16, endMinute: 30 },
        { startHour: 17, startMinute: 0, endHour: 18, endMinute: 0 },
        { startHour: 18, startMinute: 30, endHour: 19, endMinute: 30 },
      ];

      expect(DAILY_CONSULTATION_SLOTS_IST).toEqual(expectedSlots);

      for (let i = 0; i < DAILY_CONSULTATION_SLOTS_IST.length; i++) {
        const slot = DAILY_CONSULTATION_SLOTS_IST[i];
        const durationMin =
          slot.endHour * 60 + slot.endMinute - (slot.startHour * 60 + slot.startMinute);
        expect(durationMin).toBe(CONSULTATION_DURATION_MINUTES);

        if (i < DAILY_CONSULTATION_SLOTS_IST.length - 1) {
          const nextSlot = DAILY_CONSULTATION_SLOTS_IST[i + 1];
          const bufferMin =
            nextSlot.startHour * 60 + nextSlot.startMinute - (slot.endHour * 60 + slot.endMinute);
          // Slots have either 30 min buffer (e.g. 11:00-11:30) or lunch break (12:30-14:00 is 90 min)
          expect(bufferMin).toBeGreaterThanOrEqual(CONSULTATION_BUFFER_MINUTES);
        }
      }
    });
  });

  describe("Sunday Exclusion and Day-of-Week Detection", () => {
    it("correctly identifies Sundays in IST", () => {
      // 2026-09-20 is a Sunday
      expect(isSundayInIst("2026-09-20")).toBe(true);
      expect(getIstDayOfWeek("2026-09-20")).toBe(0);

      // 2026-09-21 is a Monday
      expect(isSundayInIst("2026-09-21")).toBe(false);
      expect(getIstDayOfWeek("2026-09-21")).toBe(1);

      // 2026-09-26 is a Saturday
      expect(isSundayInIst("2026-09-26")).toBe(false);
      expect(getIstDayOfWeek("2026-09-26")).toBe(6);
    });

    it("generates slots exclusively for Monday through Saturday, omitting Sunday", () => {
      // Range covering Friday 2026-09-18 through Monday 2026-09-21 in IST
      const start = new Date("2026-09-18T05:00:00.000Z");
      const end = new Date("2026-09-21T15:00:00.000Z"); // 20:30 IST on Monday Sept 21

      const slots = generateSlotsForDateRange(start, end);

      // Friday: 6 slots, Saturday: 6 slots, Sunday: 0 slots, Monday: 6 slots = 18 slots
      expect(slots).toHaveLength(18);

      // Verify no slot falls on Sunday 2026-09-20
      for (const slot of slots) {
        // Slot start time in UTC converted to IST date string
        const istDatePart = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(slot.startTime));

        expect(istDatePart).not.toBe("2026-09-20");
      }
    });
  });

  describe("Availability Window & Lead-Time Clamping", () => {
    const baseNow = new Date("2026-09-15T12:00:00.000Z");

    it("calculates default window: [now + 24h, now + 30d]", () => {
      const window = calculateAvailabilityWindow(baseNow);

      const expectedStart = new Date(
        baseNow.getTime() + MIN_BOOKING_LEAD_TIME_HOURS * 60 * 60 * 1000
      );
      const expectedEnd = new Date(
        baseNow.getTime() + ROLLING_AVAILABILITY_DAYS * 24 * 60 * 60 * 1000
      );

      expect(window.windowStart.getTime()).toBe(expectedStart.getTime());
      expect(window.windowEnd.getTime()).toBe(expectedEnd.getTime());
    });

    it("clamps query startDate if earlier than 24h lead time", () => {
      const queryStartDate = new Date(baseNow.getTime() + 2 * 60 * 60 * 1000).toISOString(); // only +2h
      const window = calculateAvailabilityWindow(baseNow, queryStartDate);

      const expectedEarliest = new Date(
        baseNow.getTime() + MIN_BOOKING_LEAD_TIME_HOURS * 60 * 60 * 1000
      );
      expect(window.windowStart.getTime()).toBe(expectedEarliest.getTime());
    });

    it("clamps query endDate if past 30-day window", () => {
      const queryEndDate = new Date(
        baseNow.getTime() + 45 * 24 * 60 * 60 * 1000
      ).toISOString(); // +45d
      const window = calculateAvailabilityWindow(baseNow, undefined, queryEndDate);

      const expectedLatest = new Date(
        baseNow.getTime() + ROLLING_AVAILABILITY_DAYS * 24 * 60 * 60 * 1000
      );
      expect(window.windowEnd.getTime()).toBe(expectedLatest.getTime());
    });

    it("throws error for malformed date inputs", () => {
      expect(() => calculateAvailabilityWindow(baseNow, "invalid-date")).toThrow(
        "Invalid startDate format"
      );
      expect(() => calculateAvailabilityWindow(baseNow, undefined, "not-a-date")).toThrow(
        "Invalid endDate format"
      );
    });

    it("throws error if startDate is strictly after endDate", () => {
      const start = new Date(baseNow.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const end = new Date(baseNow.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(() => calculateAvailabilityWindow(baseNow, start, end)).toThrow(
        "startDate must not be after endDate"
      );
    });
  });

  describe("isSlotPastLeadTime Reassertion", () => {
    const nowUtc = new Date("2026-09-15T12:00:00.000Z");

    it("returns false for slots strictly 24 hours or more in the future", () => {
      const futureSlot25h = new Date(
        nowUtc.getTime() + 25 * 60 * 60 * 1000
      ).toISOString();
      expect(isSlotPastLeadTime(futureSlot25h, nowUtc)).toBe(false);

      const futureSlotExact24h = new Date(
        nowUtc.getTime() + 24 * 60 * 60 * 1000
      ).toISOString();
      expect(isSlotPastLeadTime(futureSlotExact24h, nowUtc)).toBe(false);
    });

    it("returns true for slots within 24 hours or in the past", () => {
      const nearSlot23h = new Date(
        nowUtc.getTime() + 23 * 60 * 60 * 1000
      ).toISOString();
      expect(isSlotPastLeadTime(nearSlot23h, nowUtc)).toBe(true);

      const pastSlot = new Date(
        nowUtc.getTime() - 1 * 60 * 60 * 1000
      ).toISOString();
      expect(isSlotPastLeadTime(pastSlot, nowUtc)).toBe(true);
    });
  });

  describe("Calendar Boundaries: Month, Year, and Leap Year", () => {
    it("handles month boundaries seamlessly (e.g. Sept 30 to Oct 1)", () => {
      const start = new Date("2026-09-30T00:00:00.000Z");
      const end = new Date("2026-10-02T23:59:59.999Z");

      const slots = generateSlotsForDateRange(start, end);
      expect(slots.length).toBeGreaterThan(0);

      // Verify slots have correct UTC representations matching IST 10:00 = 04:30 UTC
      const firstSlot = slots[0];
      const slotDate = new Date(firstSlot.startTime);
      expect(slotDate.getUTCHours()).toBe(4);
      expect(slotDate.getUTCMinutes()).toBe(30);
    });

    it("handles year boundaries seamlessly (e.g. Dec 31 to Jan 2)", () => {
      const start = new Date("2026-12-31T00:00:00.000Z");
      const end = new Date("2027-01-02T23:59:59.999Z");

      const slots = generateSlotsForDateRange(start, end);
      expect(slots.length).toBeGreaterThan(0);

      const has2026 = slots.some((s) => s.startTime.startsWith("2026"));
      const has2027 = slots.some((s) => s.startTime.startsWith("2027"));
      expect(has2026).toBe(true);
      expect(has2027).toBe(true);
    });

    it("handles leap-year February 29 properly (e.g. 2028-02-28 to 2028-03-01)", () => {
      // 2028 is a leap year; 2028-02-29 is a Tuesday
      const start = new Date("2028-02-28T00:00:00.000Z");
      const end = new Date("2028-03-01T23:59:59.999Z");

      const slots = generateSlotsForDateRange(start, end);

      const feb29Slots = slots.filter((s) => {
        const istDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(s.startTime));
        return istDate === "2028-02-29";
      });

      // Tuesday 2028-02-29 should have all 6 slots
      expect(feb29Slots).toHaveLength(6);
    });
  });
});
