/**
 * Validation for customer payment verification / status / rebook payloads.
 * Reuses the order schema for consultationId + reservationToken so the format rules
 * (UUIDv4, 64 hex chars, forbidden financial fields) stay in one place.
 */

import { validatePaymentOrderInput } from "./payment-order-schema";

const RAZORPAY_ID = /^[A-Za-z0-9_]{6,64}$/;
const HEX_SIGNATURE = /^[a-f0-9]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface ValidatedCheckoutVerification {
  consultationId: string;
  reservationToken: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

function base(raw: Record<string, unknown>) {
  // Pass the whole payload so client-supplied amount/currency/status are rejected.
  return validatePaymentOrderInput(raw);
}

export function validateCheckoutVerification(raw: Record<string, unknown>): Result<ValidatedCheckoutVerification> {
  const b = base(raw);
  if (!b.success) return b;
  const orderId = raw.razorpay_order_id;
  const paymentId = raw.razorpay_payment_id;
  const signature = raw.razorpay_signature;
  if (typeof orderId !== "string" || !orderId.startsWith("order_") || !RAZORPAY_ID.test(orderId)) {
    return { success: false, error: "Invalid payment order reference." };
  }
  if (typeof paymentId !== "string" || !paymentId.startsWith("pay_") || !RAZORPAY_ID.test(paymentId)) {
    return { success: false, error: "Invalid payment reference." };
  }
  if (typeof signature !== "string" || !HEX_SIGNATURE.test(signature)) {
    return { success: false, error: "Invalid payment signature." };
  }
  return {
    success: true,
    data: {
      ...b.data,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature.toLowerCase(),
    },
  };
}

export function validateStatusRequest(raw: Record<string, unknown>): Result<{ consultationId: string; reservationToken: string }> {
  return base(raw);
}

export function validateRebookRequest(
  raw: Record<string, unknown>
): Result<{ consultationId: string; reservationToken: string; newSlotId: string }> {
  const b = base(raw);
  if (!b.success) return b;
  if (typeof raw.slotId !== "string" || !UUID.test(raw.slotId)) {
    return { success: false, error: "Please choose a valid slot." };
  }
  return { success: true, data: { ...b.data, newSlotId: raw.slotId } };
}
