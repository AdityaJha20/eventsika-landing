/**
 * Email Address Validator & Normalizer
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL_LENGTH = 254;

export interface EmailValidationResult {
  isValid: boolean;
  normalizedEmail: string;
  error?: string;
}

/** Trims, lowercases and validates an email address. */
export function validateEmail(input: unknown): EmailValidationResult {
  if (typeof input !== "string" || !input.trim()) {
    return { isValid: false, normalizedEmail: "", error: "Please enter your email address." };
  }

  const normalizedEmail = input.trim().toLowerCase();
  if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    return { isValid: false, normalizedEmail: "", error: "Please enter a valid email address." };
  }

  return { isValid: true, normalizedEmail };
}
