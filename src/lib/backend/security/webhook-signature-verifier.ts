import crypto from "node:crypto";
import { getServerConfig } from "../config/env";

/**
 * Server-only Cashfree Webhook Signature Verifier (Step 6A)
 *
 * Verifies authenticity and replay freshness of inbound Cashfree webhooks.
 *
 * Security Requirements:
 * 1. HMAC-SHA256 signature computed over `${rawTimestamp}${rawBody}` using CASHFREE_SECRET_KEY.
 * 2. Signature digest encoded as Base64.
 * 3. Timing-safe comparison via crypto.timingSafeEqual on byte Buffers (never string ===).
 * 4. Byte buffer length mismatch checked before timingSafeEqual to prevent RangeError crashes.
 * 5. Replay protection with strict 5-minute (300,000ms) tolerance window.
 * 6. Deterministic timestamp normalization handling both epoch seconds (10-digit) and epoch ms (13-digit).
 * 7. Server-only boundary enforcement preventing execution or bundling in browser context.
 * 8. Never logs or leaks secrets, signatures, or raw payloads.
 */

// Defensive boundary guard preventing accidental client bundling
if (typeof window !== "undefined") {
  throw new Error("Cashfree webhook signature verifier cannot be executed in browser context.");
}

/**
 * Standard replay freshness window: 5 minutes (300,000 milliseconds).
 */
export const DEFAULT_WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export type WebhookSignatureVerificationErrorCode =
  | "VALID"
  | "MISSING_RAW_BODY"
  | "MISSING_SIGNATURE"
  | "MISSING_TIMESTAMP"
  | "INVALID_TIMESTAMP"
  | "TIMESTAMP_OUT_OF_WINDOW"
  | "MISSING_SECRET"
  | "INVALID_SIGNATURE";

export interface CashfreeWebhookSignatureVerificationResult {
  isValid: boolean;
  code: WebhookSignatureVerificationErrorCode;
  error?: string;
  timestampMs?: number;
}

export interface VerifyCashfreeWebhookSignatureOptions {
  /**
   * The raw, unparsed request body string directly from the HTTP request.
   * MUST NOT be JSON-parsed or re-serialized before verification.
   */
  rawBody: string;

  /**
   * Value of the `x-webhook-signature` HTTP header.
   */
  signature: string | null | undefined;

  /**
   * Value of the `x-webhook-timestamp` HTTP header.
   */
  timestamp: string | number | null | undefined;

  /**
   * Optional secret key. If omitted, resolved from `getServerEnv().cashfree.secretKey`.
   */
  secretKey?: string;

  /**
   * Optional injected current timestamp (in milliseconds) for deterministic time testing.
   */
  currentTimestampMs?: number;

  /**
   * Optional tolerance window in milliseconds. Defaults to 300,000 (5 minutes).
   */
  toleranceMs?: number;
}

/**
 * Computes the authoritative HMAC-SHA256 signature for a Cashfree webhook.
 *
 * Algorithm: Base64( HMAC-SHA256( secretKey, `${rawTimestamp}${rawBody}` ) )
 *
 * @param rawBody - Raw untouched HTTP request body string
 * @param rawTimestamp - Exact string representation of timestamp header sent by Cashfree
 * @param secretKey - Cashfree API secret key
 */
export function computeCashfreeWebhookSignature(
  rawBody: string,
  rawTimestamp: string,
  secretKey: string
): string {
  if (typeof window !== "undefined") {
    throw new Error("Cashfree signature computation cannot be executed in browser context.");
  }
  const payloadToSign = `${rawTimestamp}${rawBody}`;
  return crypto
    .createHmac("sha256", secretKey)
    .update(payloadToSign, "utf-8")
    .digest("base64");
}

/**
 * Normalizes a Cashfree webhook timestamp to UTC epoch milliseconds.
 *
 * Cashfree timestamp representations:
 * - Epoch seconds (10 digits, e.g. 1728211200) -> multiplied by 1000
 * - Epoch milliseconds (13 digits, e.g. 1728211200000) -> used directly
 * - Numeric string formats of either seconds or milliseconds -> parsed and normalized
 * - Standard ISO-8601 strings -> parsed via Date.parse
 *
 * Returns null if the timestamp is non-finite, negative, zero, or unparseable.
 */
export function normalizeWebhookTimestamp(timestamp: string | number): number | null {
  if (typeof timestamp === "number") {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return null;
    }
    // Threshold: 100,000,000,000 (10^11) differentiates 10-digit seconds (~1.7e9)
    // from 13-digit milliseconds (~1.7e12).
    return timestamp < 100_000_000_000
      ? Math.round(timestamp * 1000)
      : Math.round(timestamp);
  }

  if (typeof timestamp === "string") {
    const trimmed = timestamp.trim();
    if (!trimmed) {
      return null;
    }

    // Pure positive integer string
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!Number.isFinite(num) || num <= 0 || num > Number.MAX_SAFE_INTEGER) {
        return null;
      }
      return num < 100_000_000_000
        ? Math.round(num * 1000)
        : Math.round(num);
    }

    // Try parsing as ISO-8601 date string
    const parsed = Date.parse(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  return null;
}

/**
 * Verifies a Cashfree webhook signature and enforces replay attack protection.
 *
 * Evaluates in order:
 * 1. Raw body presence & type validity
 * 2. Secret availability
 * 3. Signature presence
 * 4. Timestamp presence & validity
 * 5. Replay window freshness
 * 6. HMAC-SHA256 signature match (timing-safe)
 */
export function verifyCashfreeWebhookSignature(
  options: VerifyCashfreeWebhookSignatureOptions
): CashfreeWebhookSignatureVerificationResult {
  // 1. Raw Body Validation
  if (
    options.rawBody === null ||
    options.rawBody === undefined ||
    typeof options.rawBody !== "string"
  ) {
    return {
      isValid: false,
      code: "MISSING_RAW_BODY",
      error: "Missing or invalid rawBody: request body must be a string.",
    };
  }

  // 2. Secret Key Resolution
  let secretKey = options.secretKey;
  if (!secretKey) {
    try {
      secretKey = getServerConfig().cashfree.secretKey;
    } catch {
      secretKey = undefined;
    }
  }

  if (!secretKey || typeof secretKey !== "string" || !secretKey.trim()) {
    return {
      isValid: false,
      code: "MISSING_SECRET",
      error: "Cashfree secret key is unconfigured or empty.",
    };
  }

  // 2. Signature Header Validation
  if (
    options.signature === null ||
    options.signature === undefined ||
    typeof options.signature !== "string" ||
    !options.signature.trim()
  ) {
    return {
      isValid: false,
      code: "MISSING_SIGNATURE",
      error: "Missing or empty x-webhook-signature header.",
    };
  }
  const trimmedSignature = options.signature.trim();

  // 3. Timestamp Header Validation
  if (
    options.timestamp === null ||
    options.timestamp === undefined ||
    (typeof options.timestamp === "string" && !options.timestamp.trim())
  ) {
    return {
      isValid: false,
      code: "MISSING_TIMESTAMP",
      error: "Missing x-webhook-timestamp header.",
    };
  }

  const rawTimestampStr = String(options.timestamp).trim();
  const normalizedTimestampMs = normalizeWebhookTimestamp(options.timestamp);

  if (normalizedTimestampMs === null) {
    return {
      isValid: false,
      code: "INVALID_TIMESTAMP",
      error: "Malformed or unparseable webhook timestamp.",
    };
  }

  // 4. Replay Window Verification
  const nowMs = options.currentTimestampMs ?? Date.now();
  const toleranceMs = options.toleranceMs ?? DEFAULT_WEBHOOK_TOLERANCE_MS;
  const timeDifferenceMs = Math.abs(nowMs - normalizedTimestampMs);

  if (timeDifferenceMs > toleranceMs) {
    return {
      isValid: false,
      code: "TIMESTAMP_OUT_OF_WINDOW",
      error: `Webhook timestamp is outside allowed replay window (${timeDifferenceMs}ms skew exceeds ${toleranceMs}ms tolerance).`,
      timestampMs: normalizedTimestampMs,
    };
  }

  // 5. HMAC-SHA256 Signature Verification
  // Cashfree signs `${rawTimestamp}${rawBody}` using the exact raw timestamp string
  const expectedSignature = computeCashfreeWebhookSignature(
    options.rawBody,
    rawTimestampStr,
    secretKey
  );

  const receivedBuffer = Buffer.from(trimmedSignature, "utf-8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

  // Critical security check: timingSafeEqual throws RangeError if buffer lengths differ
  if (receivedBuffer.length !== expectedBuffer.length) {
    return {
      isValid: false,
      code: "INVALID_SIGNATURE",
      error: "Webhook signature verification failed.",
      timestampMs: normalizedTimestampMs,
    };
  }

  const isSignatureValid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

  if (!isSignatureValid) {
    return {
      isValid: false,
      code: "INVALID_SIGNATURE",
      error: "Webhook signature verification failed.",
      timestampMs: normalizedTimestampMs,
    };
  }

  return {
    isValid: true,
    code: "VALID",
    timestampMs: normalizedTimestampMs,
  };
}
