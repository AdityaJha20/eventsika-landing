/**
 * Indian Mobile Phone Number Validator & Normalizer
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalizedPhone: string;
  error?: string;
}

/**
 * Validates and normalizes an Indian phone number.
 * Accepts:
 * - 10-digit mobile number starting with 6, 7, 8, or 9
 * - 11-digit prefixed with 0 (e.g. 09876543210)
 * - 12-digit prefixed with 91 or +91 (e.g. +91 9876543210)
 */
export function validateIndianPhone(input: unknown): PhoneValidationResult {
  if (typeof input !== "string") {
    return {
      isValid: false,
      normalizedPhone: "",
      error: "Phone number must be a string.",
    };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalizedPhone: "",
      error: "Please enter your phone number.",
    };
  }

  // Reject strings containing letters or suspicious characters
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) {
    return {
      isValid: false,
      normalizedPhone: "",
      error: "Phone number contains invalid characters.",
    };
  }

  const cleanDigits = trimmed.replace(/\D/g, "");

  // 10-digit format starting with 6, 7, 8, 9
  if (/^[6-9]\d{9}$/.test(cleanDigits)) {
    return {
      isValid: true,
      normalizedPhone: cleanDigits,
    };
  }

  // 11-12 digit format with country code / zero prefix (e.g. 919876543210 or 09876543210)
  if (/^(91|0)[6-9]\d{9}$/.test(cleanDigits)) {
    const standard10Digits = cleanDigits.slice(-10);
    return {
      isValid: true,
      normalizedPhone: standard10Digits,
    };
  }

  return {
    isValid: false,
    normalizedPhone: "",
    error: "Please provide a valid 10-digit Indian phone number.",
  };
}
