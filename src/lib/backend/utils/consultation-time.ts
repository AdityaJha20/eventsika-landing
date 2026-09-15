/**
 * Pure Consultation Time & Scheduling Utilities
 *
 * Enforces server-authoritative Asia/Kolkata timezone rules,
 * fixed Monday–Saturday schedules, Sunday exclusion, 60-minute duration,
 * 30-minute buffers, 24-hour minimum booking lead time, and rolling 30-day window.
 */

import {
  CONSULTATION_TIMEZONE,
  DAILY_CONSULTATION_SLOTS_IST,
  MIN_BOOKING_LEAD_TIME_HOURS,
  ROLLING_AVAILABILITY_DAYS,
} from "../types/payment-and-consultation";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // 5 hours 30 minutes in ms

/**
 * Returns the formatted calendar date string (YYYY-MM-DD) in Asia/Kolkata.
 */
export function getIstDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONSULTATION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Normalizes Date or string to a Date object evaluated in IST.
 */
function toDate(input: Date | string): Date {
  if (typeof input === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return parseIstDateStringToUtc(input, 12, 0);
    }
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) {
      throw new RangeError("Invalid time value");
    }
    return parsed;
  }
  return input;
}

/**
 * Checks if the given instant falls on a Sunday in Asia/Kolkata.
 */
export function isSundayInIst(date: Date | string): boolean {
  const d = toDate(date);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CONSULTATION_TIMEZONE,
    weekday: "short",
  });
  return formatter.format(d) === "Sun";
}

/**
 * Returns the day of the week in Asia/Kolkata (0 for Sunday, 1 for Monday, ..., 6 for Saturday).
 */
export function getIstDayOfWeek(date: Date | string): number {
  const d = toDate(date);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CONSULTATION_TIMEZONE,
    weekday: "short",
  }).format(d);

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[weekday] ?? 0;
}

/**
 * Converts an Asia/Kolkata calendar date (YYYY-MM-DD) and IST hour/minute into a UTC Date.
 */
export function parseIstDateStringToUtc(
  dateStr: string,
  hour: number,
  minute: number
): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid IST date format: ${dateStr}. Expected YYYY-MM-DD.`);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Calculates the server-authoritative availability window:
 * - windowStart: serverNow + 24 hours (minimum lead time)
 * - windowEnd: serverNow + 30 days (rolling availability)
 */
export function getAvailabilityWindow(serverNow: Date = new Date()): {
  windowStart: Date;
  windowEnd: Date;
} {
  const windowStart = new Date(
    serverNow.getTime() + MIN_BOOKING_LEAD_TIME_HOURS * 60 * 60 * 1000
  );
  const windowEnd = new Date(
    serverNow.getTime() + ROLLING_AVAILABILITY_DAYS * 24 * 60 * 60 * 1000
  );
  return { windowStart, windowEnd };
}

/**
 * Calculates and validates the availability window, clamping optional query params.
 * Throws explicit errors on malformed date input or if startDate > endDate.
 */
export function calculateAvailabilityWindow(
  serverNow: Date = new Date(),
  queryStart?: string | null,
  queryEnd?: string | null
): { windowStart: Date; windowEnd: Date } {
  const { windowStart, windowEnd } = getAvailabilityWindow(serverNow);

  let effectiveStart = windowStart;
  if (queryStart) {
    const parsedStart = new Date(queryStart);
    if (isNaN(parsedStart.getTime())) {
      throw new Error("Invalid startDate format");
    }
    if (parsedStart.getTime() > windowStart.getTime()) {
      effectiveStart = parsedStart;
    }
  }

  let effectiveEnd = windowEnd;
  if (queryEnd) {
    const parsedEnd = new Date(queryEnd);
    if (isNaN(parsedEnd.getTime())) {
      throw new Error("Invalid endDate format");
    }
    if (parsedEnd.getTime() < windowEnd.getTime()) {
      effectiveEnd = parsedEnd;
    }
  }

  if (queryStart && queryEnd) {
    const parsedStart = new Date(queryStart);
    const parsedEnd = new Date(queryEnd);
    if (parsedStart.getTime() > parsedEnd.getTime()) {
      throw new Error("startDate must not be after endDate");
    }
  }

  return { windowStart: effectiveStart, windowEnd: effectiveEnd };
}

/**
 * Clamps a query date range strictly within the server-authoritative availability window.
 */
export function clampAvailabilityRange(
  serverNow: Date = new Date(),
  queryStart?: string | null,
  queryEnd?: string | null
): { effectiveStart: Date; effectiveEnd: Date } {
  const { windowStart, windowEnd } = calculateAvailabilityWindow(serverNow, queryStart, queryEnd);
  return { effectiveStart: windowStart, effectiveEnd: windowEnd };
}

/**
 * Determines whether a slot start time violates the minimum 24-hour lead time.
 * Returns true if the slot is in the past or starts sooner than 24 hours from serverNow.
 */
export function isPastLeadTime(
  slotStartTime: string | Date,
  serverNow: Date = new Date()
): boolean {
  const startMs = typeof slotStartTime === "string" ? new Date(slotStartTime).getTime() : slotStartTime.getTime();
  const minAllowedMs = serverNow.getTime() + MIN_BOOKING_LEAD_TIME_HOURS * 60 * 60 * 1000;
  return startMs < minAllowedMs;
}

export const isSlotPastLeadTime = isPastLeadTime;

/**
 * Generates the fixed daily slot intervals for a single IST calendar date (YYYY-MM-DD).
 * Returns empty array if the date falls on a Sunday.
 */
export function generateSlotsForIstDate(
  dateStr: string
): Array<{ startTime: string; endTime: string }> {
  const sampleUtc = parseIstDateStringToUtc(dateStr, 12, 0);
  if (isSundayInIst(sampleUtc)) {
    return [];
  }

  return DAILY_CONSULTATION_SLOTS_IST.map((slotCfg) => {
    const start = parseIstDateStringToUtc(dateStr, slotCfg.startHour, slotCfg.startMinute);
    const end = parseIstDateStringToUtc(dateStr, slotCfg.endHour, slotCfg.endMinute);
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  });
}

/**
 * Generates all fixed slot intervals for a range of dates in Asia/Kolkata.
 * Iterates day-by-day in IST, excluding Sundays.
 */
export function generateSlotsForDateRange(
  startDate: Date,
  endDate: Date
): Array<{ startTime: string; endTime: string }> {
  const slots: Array<{ startTime: string; endTime: string }> = [];

  const startIstStr = getIstDateString(startDate);
  const endIstStr = getIstDateString(endDate);

  const startUtcMid = parseIstDateStringToUtc(startIstStr, 12, 0);
  const endUtcMid = parseIstDateStringToUtc(endIstStr, 12, 0);

  const current = new Date(startUtcMid.getTime());
  const oneDayMs = 24 * 60 * 60 * 1000;

  while (current.getTime() <= endUtcMid.getTime()) {
    const currentIstStr = getIstDateString(current);
    const daySlots = generateSlotsForIstDate(currentIstStr);
    slots.push(...daySlots);
    current.setTime(current.getTime() + oneDayMs);
  }

  return slots;
}
