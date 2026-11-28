/**
 * Razorpay webhook envelope parsing (runs only AFTER signature verification).
 *
 * Event names and payload paths from the official docs:
 *   payment.authorized | payment.captured | payment.failed  -> payload.payment.entity
 *   order.paid                                             -> payload.payment.entity + payload.order.entity
 *   refund.created | refund.processed | refund.failed      -> payload.refund.entity (+ payload.payment.entity)
 * Anything else (e.g. refund.speed_changed) is acknowledged and stored as ignored.
 *
 * `minimalPayload` is what gets persisted: enough to reprocess the event later,
 * without customer contact details, card metadata or other unneeded PII.
 */

import { mapRazorpayPayment, mapRazorpayRefund } from "../integrations/razorpay-payment-gateway";
import { ProviderPayment, ProviderRefund } from "../integrations/payment-gateway.interface";

export const RAZORPAY_PAYMENT_EVENTS = ["payment.authorized", "payment.captured", "payment.failed", "order.paid"] as const;
export const RAZORPAY_REFUND_EVENTS = ["refund.created", "refund.processed", "refund.failed"] as const;

export type RazorpayPaymentEventType = (typeof RAZORPAY_PAYMENT_EVENTS)[number];
export type RazorpayRefundEventType = (typeof RAZORPAY_REFUND_EVENTS)[number];

export type ParsedRazorpayWebhook =
  | { kind: "payment"; eventType: RazorpayPaymentEventType; payment: ProviderPayment; minimalPayload: Record<string, unknown> }
  | { kind: "refund"; eventType: RazorpayRefundEventType; refund: ProviderRefund; minimalPayload: Record<string, unknown> }
  | { kind: "ignored"; eventType: string; minimalPayload: Record<string, unknown> };

export type RazorpayWebhookParseResult =
  | { success: true; data: ParsedRazorpayWebhook }
  | { success: false; error: string };

function entityAt(payload: Record<string, unknown>, key: string): unknown {
  const holder = payload[key];
  if (!holder || typeof holder !== "object") return undefined;
  return (holder as Record<string, unknown>).entity;
}

export function parseRazorpayWebhook(envelope: unknown): RazorpayWebhookParseResult {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { success: false, error: "Malformed webhook envelope." };
  }
  const env = envelope as Record<string, unknown>;
  const eventType = typeof env.event === "string" ? env.event.trim() : "";
  if (!eventType || eventType.length > 100) {
    return { success: false, error: "Missing event type." };
  }
  const payload =
    env.payload && typeof env.payload === "object" && !Array.isArray(env.payload)
      ? (env.payload as Record<string, unknown>)
      : {};
  const createdAt = typeof env.created_at === "number" ? env.created_at : null;

  try {
    if ((RAZORPAY_PAYMENT_EVENTS as readonly string[]).includes(eventType)) {
      const payment = mapRazorpayPayment(entityAt(payload, "payment"));
      if (!payment.orderId) {
        return { success: false, error: "Payment event without order_id." };
      }
      return {
        success: true,
        data: {
          kind: "payment",
          eventType: eventType as RazorpayPaymentEventType,
          payment,
          minimalPayload: { event: eventType, created_at: createdAt, payment },
        },
      };
    }

    if ((RAZORPAY_REFUND_EVENTS as readonly string[]).includes(eventType)) {
      const refund = mapRazorpayRefund(entityAt(payload, "refund"));
      return {
        success: true,
        data: {
          kind: "refund",
          eventType: eventType as RazorpayRefundEventType,
          refund,
          minimalPayload: { event: eventType, created_at: createdAt, refund },
        },
      };
    }
  } catch {
    return { success: false, error: `Malformed ${eventType} payload.` };
  }

  return {
    success: true,
    data: { kind: "ignored", eventType, minimalPayload: { event: eventType, created_at: createdAt } },
  };
}

/** Rebuilds a parsed event from the minimal payload persisted in webhook_events. */
export function parseStoredRazorpayEvent(stored: Record<string, unknown>): RazorpayWebhookParseResult {
  const eventType = typeof stored.event === "string" ? stored.event : "";
  if (stored.payment && typeof stored.payment === "object") {
    return {
      success: true,
      data: {
        kind: "payment",
        eventType: eventType as RazorpayPaymentEventType,
        payment: stored.payment as ProviderPayment,
        minimalPayload: stored,
      },
    };
  }
  if (stored.refund && typeof stored.refund === "object") {
    return {
      success: true,
      data: {
        kind: "refund",
        eventType: eventType as RazorpayRefundEventType,
        refund: stored.refund as ProviderRefund,
        minimalPayload: stored,
      },
    };
  }
  return { success: true, data: { kind: "ignored", eventType, minimalPayload: stored } };
}

/** Maps a verified provider payment status to the ledger event status. */
export function toLedgerPaymentStatus(
  status: ProviderPayment["status"]
): "authorized" | "captured" | "failed" | null {
  switch (status) {
    case "captured":
    case "refunded": // a refunded payment was captured first; refunds are tracked separately
      return "captured";
    case "authorized":
      return "authorized";
    case "failed":
      return "failed";
    default:
      return null; // 'created': nothing has happened yet
  }
}
