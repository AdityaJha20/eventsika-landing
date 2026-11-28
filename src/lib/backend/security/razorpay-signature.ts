/**
 * Razorpay signature verification (official spec, razorpay.com/docs):
 *
 * Checkout:  hex(HMAC-SHA256(key_secret, order_id + "|" + razorpay_payment_id))
 *            order_id MUST come from Eventsika's database, never from the browser.
 * Webhook:   hex(HMAC-SHA256(webhook_secret, raw_request_body)) in X-Razorpay-Signature.
 *            Computed over the exact raw bytes, before any JSON parsing.
 *
 * Both comparisons are constant-time. The webhook secret and the API key secret are
 * distinct and are never interchangeable.
 */

import crypto from "node:crypto";

const HEX_SHA256 = /^[a-f0-9]{64}$/;

export function hmacSha256Hex(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

export function constantTimeHexEqual(expectedHex: string, receivedHex: string): boolean {
  if (!HEX_SHA256.test(expectedHex) || !HEX_SHA256.test(receivedHex)) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(receivedHex, "hex"));
}

export function computeRazorpayCheckoutSignature(
  trustedOrderId: string,
  paymentId: string,
  keySecret: string
): string {
  return hmacSha256Hex(keySecret, `${trustedOrderId}|${paymentId}`);
}

export function verifyRazorpayCheckoutSignature(params: {
  trustedOrderId: string;
  paymentId: string;
  signature: string | null | undefined;
  keySecret: string | null | undefined;
}): boolean {
  const { trustedOrderId, paymentId, signature, keySecret } = params;
  if (!keySecret || !trustedOrderId || !paymentId || typeof signature !== "string") return false;
  const expected = computeRazorpayCheckoutSignature(trustedOrderId, paymentId, keySecret);
  return constantTimeHexEqual(expected, signature.trim().toLowerCase());
}

export type RazorpayWebhookVerificationCode =
  | "VALID"
  | "MISSING_SIGNATURE"
  | "MISSING_SECRET"
  | "INVALID_SIGNATURE";

export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signature: string | null | undefined;
  webhookSecret: string | null | undefined;
}): { isValid: boolean; code: RazorpayWebhookVerificationCode } {
  if (!params.webhookSecret) return { isValid: false, code: "MISSING_SECRET" };
  if (!params.signature || !params.signature.trim()) return { isValid: false, code: "MISSING_SIGNATURE" };
  const expected = hmacSha256Hex(params.webhookSecret, params.rawBody);
  return constantTimeHexEqual(expected, params.signature.trim().toLowerCase())
    ? { isValid: true, code: "VALID" }
    : { isValid: false, code: "INVALID_SIGNATURE" };
}
