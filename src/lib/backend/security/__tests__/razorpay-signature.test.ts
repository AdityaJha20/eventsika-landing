import crypto from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import {
  computeRazorpayCheckoutSignature,
  constantTimeHexEqual,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "../razorpay-signature";

const KEY_SECRET = "unit-test-key-secret";
const WEBHOOK_SECRET = "unit-test-webhook-secret";

describe("Razorpay checkout signature", () => {
  it("matches the documented HMAC-SHA256(order_id|payment_id, key_secret) hex digest", () => {
    const expected = crypto.createHmac("sha256", KEY_SECRET).update("order_A1|pay_B2").digest("hex");
    expect(computeRazorpayCheckoutSignature("order_A1", "pay_B2", KEY_SECRET)).toBe(expected);
  });

  it("accepts a correct signature (case-insensitive hex, surrounding whitespace tolerated)", () => {
    const sig = computeRazorpayCheckoutSignature("order_A1", "pay_B2", KEY_SECRET);
    expect(verifyRazorpayCheckoutSignature({ trustedOrderId: "order_A1", paymentId: "pay_B2", signature: sig, keySecret: KEY_SECRET })).toBe(true);
    expect(verifyRazorpayCheckoutSignature({ trustedOrderId: "order_A1", paymentId: "pay_B2", signature: ` ${sig.toUpperCase()} `, keySecret: KEY_SECRET })).toBe(true);
  });

  it.each([
    ["wrong order id", { trustedOrderId: "order_X9" }],
    ["wrong payment id", { paymentId: "pay_X9" }],
    ["missing signature", { signature: undefined }],
    ["malformed signature", { signature: "not-hex" }],
    ["truncated signature", { signature: "ab".repeat(16) }],
    ["missing key secret", { keySecret: undefined }],
    ["webhook secret used instead of key secret", { keySecret: WEBHOOK_SECRET }],
  ])("rejects %s", (_label, overrides) => {
    const base = {
      trustedOrderId: "order_A1",
      paymentId: "pay_B2",
      signature: computeRazorpayCheckoutSignature("order_A1", "pay_B2", KEY_SECRET),
      keySecret: KEY_SECRET,
    };
    expect(verifyRazorpayCheckoutSignature({ ...base, ...overrides } as typeof base)).toBe(false);
  });

  it("compares with crypto.timingSafeEqual", () => {
    const spy = vi.spyOn(crypto, "timingSafeEqual");
    const sig = computeRazorpayCheckoutSignature("order_A1", "pay_B2", KEY_SECRET);
    verifyRazorpayCheckoutSignature({ trustedOrderId: "order_A1", paymentId: "pay_B2", signature: sig, keySecret: KEY_SECRET });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("constantTimeHexEqual refuses non-SHA256-length input without throwing", () => {
    expect(constantTimeHexEqual("a".repeat(64), "a".repeat(63))).toBe(false);
  });
});

describe("Razorpay webhook signature", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
  const sign = (raw: string, secret = WEBHOOK_SECRET) => crypto.createHmac("sha256", secret).update(raw).digest("hex");

  it("accepts the HMAC of the exact raw body", () => {
    expect(verifyRazorpayWebhookSignature({ rawBody: body, signature: sign(body), webhookSecret: WEBHOOK_SECRET })).toEqual({ isValid: true, code: "VALID" });
  });

  it("rejects a changed body, even a whitespace-only change (no re-serialization)", () => {
    const reformatted = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyRazorpayWebhookSignature({ rawBody: reformatted, signature: sign(body), webhookSecret: WEBHOOK_SECRET }).isValid).toBe(false);
  });

  it("rejects a signature made with the API key secret", () => {
    expect(verifyRazorpayWebhookSignature({ rawBody: body, signature: sign(body, KEY_SECRET), webhookSecret: WEBHOOK_SECRET }).code).toBe("INVALID_SIGNATURE");
  });

  it("reports missing signature and missing secret distinctly", () => {
    expect(verifyRazorpayWebhookSignature({ rawBody: body, signature: null, webhookSecret: WEBHOOK_SECRET }).code).toBe("MISSING_SIGNATURE");
    expect(verifyRazorpayWebhookSignature({ rawBody: body, signature: sign(body), webhookSecret: undefined }).code).toBe("MISSING_SECRET");
  });
});
