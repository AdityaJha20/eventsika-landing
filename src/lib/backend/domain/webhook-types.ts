/**
 * Cashfree Webhook Domain Types & Runtime Validation Guards (Step 6A)
 *
 * Defines authoritative compile-time interfaces and runtime parsing guards for
 * inbound Cashfree Payment Gateway webhooks (API v2023-08-01).
 *
 * Resilient Parsing:
 * Supports audited Cashfree payload variations where order and payment identifiers
 * may be placed in nested objects (`data.order.order_id`, `data.payment.cf_payment_id`)
 * or flat properties (`data.order_id`, `data.cf_payment_id`).
 */

// ==============================================================================
// 1. Authoritative Event Types
// ==============================================================================

export const CASHFREE_PAYMENT_EVENT_TYPES = [
  "PAYMENT_SUCCESS_WEBHOOK",
  "PAYMENT_FAILED_WEBHOOK",
  "PAYMENT_USER_DROPPED_WEBHOOK",
] as const;

export type CashfreePaymentEventType = (typeof CASHFREE_PAYMENT_EVENT_TYPES)[number];

/**
 * Type guard for supported Cashfree payment event discriminators.
 */
export function isCashfreePaymentEventType(
  type: unknown
): type is CashfreePaymentEventType {
  return (
    typeof type === "string" &&
    (CASHFREE_PAYMENT_EVENT_TYPES as readonly string[]).includes(type)
  );
}

// ==============================================================================
// 2. Raw Cashfree Payload Envelope (API v2023-08-01)
// ==============================================================================

export interface RawCashfreeOrderData {
  order_id?: string;
  orderId?: string;
  order_amount?: number | string;
  orderAmount?: number | string;
  order_currency?: string;
  orderCurrency?: string;
  order_tags?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface RawCashfreePaymentData {
  cf_payment_id?: string | number;
  payment_id?: string | number;
  payment_status?: string;
  payment_amount?: number | string;
  payment_currency?: string;
  payment_message?: string;
  payment_time?: string;
  bank_reference?: string;
  payment_group?: string;
  payment_method?: unknown;
  [key: string]: unknown;
}

export interface RawCashfreeErrorDetails {
  error_code?: string;
  error_description?: string;
  error_reason?: string;
  error_source?: string;
  [key: string]: unknown;
}

export interface RawCashfreeWebhookEnvelope {
  type?: string;
  event_type?: string;
  event_time?: string;
  data?: {
    order?: RawCashfreeOrderData;
    payment?: RawCashfreePaymentData;
    customer_details?: Record<string, unknown>;
    error_details?: RawCashfreeErrorDetails;
    // Flat / direct placement within data
    order_id?: string;
    orderId?: string;
    cf_payment_id?: string | number;
    payment_id?: string | number;
    payment_status?: string;
    payment_amount?: number | string;
    payment_currency?: string;
    payment_group?: string;
    bank_reference?: string;
    [key: string]: unknown;
  };
  // Flat root placement
  order_id?: string;
  cf_payment_id?: string | number;
  [key: string]: unknown;
}

// ==============================================================================
// 3. Normalized Internal Domain Representation
// ==============================================================================

export type NormalizedPaymentStatus =
  | "SUCCESS"
  | "FAILED"
  | "USER_DROPPED"
  | "PENDING"
  | "UNKNOWN";

export interface NormalizedCashfreePaymentWebhook {
  /**
   * Verified event discriminator.
   */
  eventType: CashfreePaymentEventType;

  /**
   * Eventsika order reference / Cashfree order ID (e.g. "ord_c7c88b90...").
   */
  orderId: string;

  /**
   * Cashfree gateway transaction ID (e.g. "12345678"), or null if unavailable.
   */
  gatewayPaymentId: string | null;

  /**
   * Normalized transaction outcome.
   */
  paymentStatus: NormalizedPaymentStatus;

  /**
   * Exact transaction amount in integer paise (₹2,999.00 -> 299900).
   */
  amountInPaise: number;

  /**
   * 3-letter currency code (e.g. "INR").
   */
  currency: string;

  /**
   * Payment method group (e.g. "upi", "card", "netbanking", "wallet"), or null.
   */
  paymentMethod: string | null;

  /**
   * Bank reference / UTR number if provided by the gateway, or null.
   */
  bankReference: string | null;

  /**
   * Gateway error code for failed transactions, or null.
   */
  errorCode: string | null;

  /**
   * Gateway error description / user message, or null.
   */
  errorDescription: string | null;

  /**
   * Event timestamp string from the gateway, or null.
   */
  eventTime: string | null;

  /**
   * Complete raw payload preserved for audit trail persistence.
   */
  rawPayload: Record<string, unknown>;
}

// ==============================================================================
// 4. Runtime Parsing & Validation Guards
// ==============================================================================

/**
 * Cashfree Order ID format specification: 3-45 characters, alphanumeric, hyphen, underscore.
 */
export const CASHFREE_ORDER_ID_REGEX = /^[a-zA-Z0-9_-]{3,45}$/;

export type CashfreeWebhookParseErrorCode =
  | "MALFORMED_ENVELOPE"
  | "UNSUPPORTED_OR_MISSING_EVENT_TYPE"
  | "MISSING_ORDER_ID"
  | "INVALID_ORDER_ID"
  | "INVALID_AMOUNT";

export type CashfreeWebhookParseResult =
  | { success: true; data: NormalizedCashfreePaymentWebhook }
  | { success: false; error: string; code: CashfreeWebhookParseErrorCode };

/**
 * Validates and normalizes an inbound Cashfree webhook JSON object into the
 * internal domain model.
 *
 * Resilient against:
 * - Nested (`data.order.order_id`) vs flat (`data.order_id`) placement
 * - Numeric vs string gateway payment IDs (`12345` -> "12345")
 * - Fractional rupee amounts converted deterministically to integer paise
 */
export function parseCashfreeWebhookPayload(
  raw: unknown
): CashfreeWebhookParseResult {
  // 1. Envelope Structure Guard
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      success: false,
      code: "MALFORMED_ENVELOPE",
      error: "Webhook payload must be a non-null JSON object.",
    };
  }

  const envelope = raw as Record<string, unknown>;

  // 2. Event Type Guard
  const rawType = envelope.type ?? envelope.event_type;
  if (!isCashfreePaymentEventType(rawType)) {
    return {
      success: false,
      code: "UNSUPPORTED_OR_MISSING_EVENT_TYPE",
      error: `Unsupported or missing event type: "${String(rawType)}"`,
    };
  }
  const eventType: CashfreePaymentEventType = rawType;

  // 3. Data Section Resolution
  const data =
    envelope.data &&
    typeof envelope.data === "object" &&
    !Array.isArray(envelope.data)
      ? (envelope.data as Record<string, unknown>)
      : envelope;

  const orderObj =
    data.order && typeof data.order === "object" && !Array.isArray(data.order)
      ? (data.order as Record<string, unknown>)
      : undefined;

  const paymentObj =
    data.payment &&
    typeof data.payment === "object" &&
    !Array.isArray(data.payment)
      ? (data.payment as Record<string, unknown>)
      : undefined;

  const errorObj =
    data.error_details &&
    typeof data.error_details === "object" &&
    !Array.isArray(data.error_details)
      ? (data.error_details as Record<string, unknown>)
      : undefined;

  // 4. Order ID Extraction (Supports nested and flat variants)
  const rawOrderId =
    orderObj?.order_id ??
    orderObj?.orderId ??
    data.order_id ??
    data.orderId ??
    envelope.order_id;

  if (typeof rawOrderId !== "string" || !rawOrderId.trim()) {
    return {
      success: false,
      code: "MISSING_ORDER_ID",
      error: "Webhook payload missing required order identifier (order_id).",
    };
  }
  const orderId = rawOrderId.trim();

  if (!CASHFREE_ORDER_ID_REGEX.test(orderId)) {
    return {
      success: false,
      code: "INVALID_ORDER_ID",
      error: `Invalid order ID format: "${orderId}". Must match ${CASHFREE_ORDER_ID_REGEX}.`,
    };
  }

  // 5. Gateway Payment ID Extraction
  const rawPaymentId =
    paymentObj?.cf_payment_id ??
    paymentObj?.payment_id ??
    data.cf_payment_id ??
    data.payment_id ??
    envelope.cf_payment_id;

  const gatewayPaymentId =
    rawPaymentId !== undefined &&
    rawPaymentId !== null &&
    String(rawPaymentId).trim() !== ""
      ? String(rawPaymentId).trim()
      : null;

  // 6. Payment Status Mapping
  const rawStatus = paymentObj?.payment_status ?? data.payment_status;
  let paymentStatus: NormalizedPaymentStatus;

  if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
    paymentStatus = "SUCCESS";
  } else if (eventType === "PAYMENT_FAILED_WEBHOOK") {
    paymentStatus = "FAILED";
  } else if (eventType === "PAYMENT_USER_DROPPED_WEBHOOK") {
    paymentStatus = "USER_DROPPED";
  } else {
    const statusStr = String(rawStatus ?? "").toUpperCase().trim();
    if (statusStr === "SUCCESS") {
      paymentStatus = "SUCCESS";
    } else if (statusStr === "FAILED") {
      paymentStatus = "FAILED";
    } else if (statusStr === "USER_DROPPED") {
      paymentStatus = "USER_DROPPED";
    } else if (statusStr === "PENDING") {
      paymentStatus = "PENDING";
    } else {
      paymentStatus = "UNKNOWN";
    }
  }

  // 7. Amount Extraction & Paise Conversion
  const rawAmount =
    paymentObj?.payment_amount ??
    orderObj?.order_amount ??
    data.payment_amount ??
    data.order_amount;

  let amountInPaise = 0;
  if (rawAmount !== undefined && rawAmount !== null) {
    if (
      typeof rawAmount !== "number" &&
      (typeof rawAmount !== "string" || !rawAmount.trim())
    ) {
      return {
        success: false,
        code: "INVALID_AMOUNT",
        error: `Invalid payment amount type or empty value: "${String(rawAmount)}"`,
      };
    }

    const num = Number(rawAmount);
    if (!Number.isFinite(num) || num < 0) {
      return {
        success: false,
        code: "INVALID_AMOUNT",
        error: `Invalid payment amount value: "${String(rawAmount)}"`,
      };
    }
    amountInPaise = Math.round(num * 100);
  }

  // PAYMENT_SUCCESS_WEBHOOK requires a strictly positive amount (> 0 paise)
  if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
    if (rawAmount === undefined || rawAmount === null || amountInPaise <= 0) {
      return {
        success: false,
        code: "INVALID_AMOUNT",
        error: "PAYMENT_SUCCESS_WEBHOOK requires a valid positive payment amount.",
      };
    }
  }

  // 8. Currency Extraction
  const rawCurrency =
    paymentObj?.payment_currency ??
    orderObj?.order_currency ??
    data.payment_currency ??
    data.order_currency ??
    "INR";
  const currency =
    typeof rawCurrency === "string" && rawCurrency.trim()
      ? rawCurrency.trim().toUpperCase()
      : "INR";

  // 9. Payment Method Group Extraction
  const paymentMethod =
    typeof paymentObj?.payment_group === "string"
      ? paymentObj.payment_group.trim().toLowerCase()
      : typeof data.payment_group === "string"
      ? data.payment_group.trim().toLowerCase()
      : null;

  // 10. Bank Reference Extraction
  const bankReference =
    typeof paymentObj?.bank_reference === "string"
      ? paymentObj.bank_reference.trim()
      : typeof data.bank_reference === "string"
      ? data.bank_reference.trim()
      : null;

  // 11. Error Details Extraction
  const errorCode =
    typeof errorObj?.error_code === "string"
      ? errorObj.error_code.trim()
      : null;

  const errorDescription =
    typeof errorObj?.error_description === "string"
      ? errorObj.error_description.trim()
      : typeof paymentObj?.payment_message === "string"
      ? paymentObj.payment_message.trim()
      : null;

  // 12. Event Time Extraction
  const eventTime =
    typeof envelope.event_time === "string"
      ? envelope.event_time.trim()
      : null;

  return {
    success: true,
    data: {
      eventType,
      orderId,
      gatewayPaymentId,
      paymentStatus,
      amountInPaise,
      currency,
      paymentMethod,
      bankReference,
      errorCode,
      errorDescription,
      eventTime,
      rawPayload: envelope,
    },
  };
}
