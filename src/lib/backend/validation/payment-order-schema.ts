/**
 * Payment Order Input Validation Schema (Step 4)
 *
 * Strictly validates incoming client payload for POST /api/consultations/payment/order.
 * Enforces UUIDv4 for consultationId and 64-character hexadecimal for reservationToken.
 * Ensures the client NEVER controls amount, currency, or gateway parameters.
 */

export interface RawPaymentOrderInput {
  consultationId?: unknown;
  reservationToken?: unknown;
  [key: string]: unknown;
}

export interface ValidatedPaymentOrderInput {
  consultationId: string;
  reservationToken: string;
}

export type PaymentOrderValidationResult =
  | { success: true; data: ValidatedPaymentOrderInput }
  | { success: false; error: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESERVATION_TOKEN_REGEX = /^[0-9a-f]{64}$/;

// Forbidden payment control fields that client must never supply
const FORBIDDEN_FIELDS = [
  "amount",
  "amountInPaise",
  "currency",
  "status",
  "gatewayOrderId",
  "paymentSessionId",
] as const;

export function validatePaymentOrderInput(raw: unknown): PaymentOrderValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Invalid request payload format." };
  }

  const payload = raw as RawPaymentOrderInput;

  // Explicitly reject forbidden client tampering fields
  for (const forbidden of FORBIDDEN_FIELDS) {
    if (payload[forbidden] !== undefined) {
      return {
        success: false,
        error: `Client modification of '${forbidden}' is forbidden. Pricing and order state are strictly server-authoritative.`,
      };
    }
  }

  // 1. consultationId
  if (typeof payload.consultationId !== "string" || !payload.consultationId.trim()) {
    return { success: false, error: "Please provide a valid consultation identifier." };
  }
  const consultationId = payload.consultationId.trim();
  if (!UUID_REGEX.test(consultationId)) {
    return { success: false, error: "Invalid consultation identifier format." };
  }

  // 2. reservationToken
  if (typeof payload.reservationToken !== "string" || !payload.reservationToken.trim()) {
    return { success: false, error: "Please provide a valid reservation token." };
  }
  const reservationToken = payload.reservationToken.trim();
  if (!RESERVATION_TOKEN_REGEX.test(reservationToken)) {
    return { success: false, error: "Invalid reservation token format. Must be a 64-character hexadecimal token." };
  }

  return {
    success: true,
    data: {
      consultationId,
      reservationToken,
    },
  };
}
