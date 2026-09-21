/**
 * Countdown & Date Formatting Utilities (Step 5)
 *
 * Pure functions for calculating reservation expiration, formatting
 * mm:ss timers, determining threshold statuses, and formatting IST dates.
 */

import { CountdownStatus } from "./booking-types";

export const SAFETY_THRESHOLD_SECONDS = 120;
export const WARNING_THRESHOLD_SECONDS = 180;

/**
 * Calculates authoritative remaining seconds until server-provided reservedUntil timestamp.
 */
export function calculateSecondsRemaining(
  reservedUntilIso: string,
  nowMs: number = Date.now()
): number {
  if (!reservedUntilIso) return 0;
  const expiryMs = new Date(reservedUntilIso).getTime();
  if (isNaN(expiryMs)) return 0;

  const diffSeconds = Math.floor((expiryMs - nowMs) / 1000);
  return Math.max(0, diffSeconds);
}

/**
 * Formats integer seconds into mm:ss display.
 * E.g. 900 -> "15:00", 75 -> "01:15", 0 -> "00:00"
 */
export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Evaluates countdown status against safety thresholds:
 * - 'normal': > 180s (> 3m)
 * - 'warning': <= 180s and > 120s (yellow/amber urgency)
 * - 'critical': <= 120s and > 0s (red urgency, unsafe to dispatch payment order)
 * - 'expired': <= 0s
 */
export function getCountdownStatus(secondsRemaining: number): CountdownStatus {
  if (secondsRemaining <= 0) {
    return "expired";
  }
  if (secondsRemaining <= SAFETY_THRESHOLD_SECONDS) {
    return "critical";
  }
  if (secondsRemaining <= WARNING_THRESHOLD_SECONDS) {
    return "warning";
  }
  return "normal";
}

/**
 * Formats an ISO date string into Indian Standard Time (IST) readable format.
 * E.g. "Tuesday, 24 October 2026"
 */
export function formatIstDate(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formats an ISO time string into 12-hour IST format (e.g. "10:00 AM").
 */
export function formatIstTime(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Formats a slot interval into a friendly string: "10:00 AM – 11:00 AM IST"
 */
export function formatIstSlotRange(startTimeIso: string, endTimeIso: string): string {
  const start = formatIstTime(startTimeIso);
  const end = formatIstTime(endTimeIso);
  if (!start || !end) return "";
  return `${start} – ${end} IST`;
}
