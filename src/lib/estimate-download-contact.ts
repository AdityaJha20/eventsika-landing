/**
 * Estimate PDF download contact capture: wording and contact parsing shared by
 * the download modal and `POST /api/estimate-downloads`.
 *
 * Bump ESTIMATE_DOWNLOAD_CONSENT_VERSION whenever the disclosure or checkbox
 * wording changes, so every stored record shows which text the visitor saw.
 * This consent covers follow-up about the estimate only, not marketing.
 */

import { validateEmail } from "./backend/validation/email";
import { validateIndianPhone } from "./backend/validation/phone";

export const ESTIMATE_DOWNLOAD_CONSENT_VERSION = "2026-11-26.v1";

export const ESTIMATE_DOWNLOAD_DISCLOSURE =
  "We will store your mobile number or email address, along with your selected package, guest count and services, so Eventsika can follow up about this estimate. Your details will not be used for unrelated marketing.";

export const ESTIMATE_DOWNLOAD_CONSENT_LABEL =
  "I agree that Eventsika may store these details and contact me about this estimate.";

export type EstimateContactResult =
  | { ok: true; kind: "phone" | "email"; value: string }
  | { ok: false; error: string };

/**
 * Accepts one Indian mobile number (optionally +91) or one email address and
 * returns it normalized: 10 digits, or a trimmed lowercase email.
 */
export function parseEstimateContact(raw: unknown): EstimateContactResult {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false, error: "Enter your mobile number or email address." };
  if (value.includes("@")) {
    const email = validateEmail(value);
    return email.isValid
      ? { ok: true, kind: "email", value: email.normalizedEmail }
      : { ok: false, error: "Enter a valid email address, e.g. name@example.com." };
  }
  const phone = validateIndianPhone(value);
  return phone.isValid
    ? { ok: true, kind: "phone", value: phone.normalizedPhone }
    : { ok: false, error: "Enter a valid 10-digit Indian mobile number, e.g. 98765 43210." };
}
