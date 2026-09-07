import { AdminVendorItem } from "@/lib/backend/services/admin-vendor-service";

/**
 * Sanitizes a single cell value for CSV export, protecting against
 * spreadsheet formula injection (CWE-1236) while preserving valid text.
 */
export function sanitizeCsvCell(value: string): string {
  const str = value ?? "";
  // Strip leading whitespace and ASCII control characters to inspect first meaningful character
  const trimmedStart = str.replace(/^[\s\x00-\x1f]+/, "");
  const startsWithDangerous = /^[=+\-@]/.test(trimmedStart);

  // If first meaningful character is a dangerous formula prefix, neutralize it with a leading quote
  const safeStr = startsWithDangerous ? `'${str}` : str;

  // Perform standard RFC 4180 CSV escaping: double quotes, and wrap in quotes if containing delimiter/newline/quote
  if (
    safeStr.includes(",") ||
    safeStr.includes('"') ||
    safeStr.includes("\n") ||
    safeStr.includes("\r")
  ) {
    return `"${safeStr.replace(/"/g, '""')}"`;
  }
  return safeStr;
}

/**
 * Builds clean, allowlisted CSV content from an array of vendor applications.
 * Strictly includes only the 9 approved operational columns.
 * Excludes internal IDs, request correlation tokens, and database timestamps.
 */
export function buildVendorCsvContent(vendors: AdminVendorItem[]): string {
  const headers = [
    "Business Name",
    "Contact Name",
    "Phone",
    "Email",
    "City",
    "Categories",
    "Experience",
    "Portfolio URL",
    "Applied Date",
  ];

  const headerLine = headers.map(sanitizeCsvCell).join(",");

  const dataRows = vendors.map((vendor) => {
    const row = [
      vendor.businessName,
      vendor.contactName,
      vendor.phone,
      vendor.email,
      vendor.city,
      vendor.categories.join(", "),
      vendor.experience,
      vendor.portfolioUrl,
      formatDisplayDate(vendor.createdAt),
    ];
    return row.map((cell) => sanitizeCsvCell(cell ?? "")).join(",");
  });

  return [headerLine, ...dataRows].join("\r\n");
}

/**
 * Validates and sanitizes an email address for safe mailto: URL generation.
 * Follows a strict rejection-over-repair model:
 * If CR, LF, or control characters are detected, rejects immediately to prevent header injection.
 */
export function sanitizeEmailForMailto(email: string): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();

  // Reject immediately if CR, LF, or control characters (\x00-\x1f, \x7f) are present
  if (/[\r\n\x00-\x1f\x7f]/.test(trimmed)) {
    return null;
  }

  // Validate canonical email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 150) {
    return null;
  }

  return trimmed;
}

/**
 * Validates external URLs, permitting strictly http: and https: protocols.
 * Blocks dangerous schemes including javascript:, data:, file:, vbscript:, etc.
 */
export function sanitizeExternalUrl(rawUrl: string): string | null {
  if (typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts clean 10-digit Indian mobile number for tel: and wa.me actions.
 */
export function cleanIndianPhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length === 10 ? digits : digits.slice(-10);
}

/**
 * Formats ISO date string to readable Indian English format (e.g. 7 Sep 2026).
 */
export function formatDisplayDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

/**
 * Formats ISO timestamp to readable date and time (e.g. 7 Sep 2026, 10:30 am).
 */
export function formatDisplayDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}
