/**
 * Vendor Portfolio URL Validator
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  error?: string;
}

const BLOCKED_SCHEMES = ["javascript:", "data:", "file:", "vbscript:"];

/**
 * Validates portfolio / social link URLs submitted by vendors.
 * Handles both full URLs (https://instagram.com/handle) and domain shorthands (instagram.com/handle).
 */
export function validatePortfolioUrl(input: unknown): UrlValidationResult {
  if (typeof input !== "string") {
    return {
      isValid: false,
      normalizedUrl: "",
      error: "Portfolio link must be a valid URL string.",
    };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalizedUrl: "",
      error: "Please provide your portfolio or Instagram link.",
    };
  }

  if (trimmed.length > 300) {
    return {
      isValid: false,
      normalizedUrl: "",
      error: "Portfolio URL must not exceed 300 characters.",
    };
  }

  const lower = trimmed.toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return {
        isValid: false,
        normalizedUrl: "",
        error: "Invalid or unsafe URL scheme.",
      };
    }
  }

  // Prepend https:// if protocol is omitted to test URL validity
  let candidate = trimmed;
  if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return {
        isValid: false,
        normalizedUrl: "",
        error: "Please provide a valid website or social profile domain.",
      };
    }

    // Must be http or https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        isValid: false,
        normalizedUrl: "",
        error: "Portfolio link must use HTTP or HTTPS.",
      };
    }

    return {
      isValid: true,
      normalizedUrl: candidate,
    };
  } catch {
    return {
      isValid: false,
      normalizedUrl: "",
      error: "Please provide a valid portfolio or Instagram link.",
    };
  }
}
