/**
 * Celebration Event Date Validator
 */

export interface DateValidationResult {
  isValid: boolean;
  normalizedDate: string;
  error?: string;
}

/**
 * Validates celebration event dates.
 * Requirements:
 * 1. Must match strict format `YYYY-MM-DD`
 * 2. Must be a valid calendar date (e.g. Feb 31 rejected)
 * 3. Must not be in the past (must be today or later)
 * 4. Must not be excessively in the future (capped at 24 months / 730 days)
 */
export function validateEventDate(input: unknown): DateValidationResult {
  if (typeof input !== "string") {
    return {
      isValid: false,
      normalizedDate: "",
      error: "Event date must be a valid date string.",
    };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalizedDate: "",
      error: "Please select your planned event date.",
    };
  }

  // Strict regex format check: YYYY-MM-DD
  const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = trimmed.match(DATE_REGEX);
  if (!match) {
    return {
      isValid: false,
      normalizedDate: "",
      error: "Please provide a valid date in YYYY-MM-DD format.",
    };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      normalizedDate: "",
      error: "Event month must be between 01 and 12.",
    };
  }

  // Check days in month
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      normalizedDate: "",
      error: `Invalid calendar date. Month ${month} has ${daysInMonth} days in ${year}.`,
    };
  }

  // Construct UTC midnight date objects for comparison
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  // Check if date is in the past
  if (parsedDate.getTime() < todayUtc.getTime()) {
    return {
      isValid: false,
      normalizedDate: "",
      error: "Event date cannot be in the past.",
    };
  }

  // Check forward-looking celebration window: max 24 months (730 days)
  const MAX_FORWARD_DAYS = 730;
  const maxFutureDate = new Date(todayUtc.getTime() + MAX_FORWARD_DAYS * 24 * 60 * 60 * 1000);
  if (parsedDate.getTime() > maxFutureDate.getTime()) {
    return {
      isValid: false,
      normalizedDate: "",
      error: "Event date cannot be more than 2 years in advance.",
    };
  }

  return {
    isValid: true,
    normalizedDate: trimmed,
  };
}
