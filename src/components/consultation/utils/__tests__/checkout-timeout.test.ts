import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CHECKOUT_SAFETY_BUFFER_SECONDS,
  MIN_CHECKOUT_WINDOW_SECONDS,
  computeCheckoutTimeoutSeconds,
  openRazorpayCheckout,
} from "../razorpay-loader";
import { decideAfterCheckoutClosed, type StatusFetchResult } from "../payment-status-client";
import type { CustomerPaymentState, PaymentOrderResponseData } from "../booking-types";

/**
 * F3 regression: checkout is bounded by the SERVER-reported remaining reservation,
 * is never opened once the hold is (nearly) gone, and a closed/timed-out window is
 * never treated as a failed payment. No real Razorpay script is loaded.
 */

const orderWith = (reservationExpiresInSeconds: number): PaymentOrderResponseData => ({
  keyId: "rzp_test_UnitTestKey000",
  orderId: "order_TestOrder0001",
  amount: 299900,
  currency: "INR",
  reference: "rcpt_x",
  prefill: { name: "Asha Rao", email: "asha@example.com", contact: "9876543210" },
  reservationExpiresInSeconds,
});

type Captured = { options: Record<string, unknown> };

function fakeRazorpay(onOpen: (h: Captured) => void) {
  const captured: Captured[] = [];
  class FakeRazorpay {
    private h: Captured;
    constructor(options: Record<string, unknown>) {
      this.h = { options };
      captured.push(this.h);
    }
    on() {}
    open() {
      onOpen(this.h);
    }
  }
  return { Ctor: FakeRazorpay as never, captured };
}

const dismiss = (h: Captured) => (h.options.modal as Record<string, () => void>).ondismiss();
const succeed = (h: Captured) =>
  (h.options.handler as (r: unknown) => void)({
    razorpay_payment_id: "pay_1",
    razorpay_order_id: "order_TestOrder0001",
    razorpay_signature: "s",
  });

const statusOf = (payment: CustomerPaymentState): StatusFetchResult => ({
  kind: "ok",
  status: { payment, booking: "pending", slotStartTime: null, amountInPaise: 299900, reference: null, canRetryPayment: false },
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeCheckoutTimeoutSeconds", () => {
  it("uses server remaining time minus elapsed time and the safety buffer", () => {
    expect(computeCheckoutTimeoutSeconds(900, 0)).toBe(900 - CHECKOUT_SAFETY_BUFFER_SECONDS);
    expect(computeCheckoutTimeoutSeconds(900, 30_000)).toBe(870 - CHECKOUT_SAFETY_BUFFER_SECONDS);
  });

  it("never exceeds the 15-minute reservation window", () => {
    expect(computeCheckoutTimeoutSeconds(15 * 60, 0)!).toBeLessThan(15 * 60);
  });

  it("refuses windows below the minimum, expired holds and invalid input", () => {
    expect(computeCheckoutTimeoutSeconds(MIN_CHECKOUT_WINDOW_SECONDS + CHECKOUT_SAFETY_BUFFER_SECONDS - 1, 0)).toBeNull();
    expect(computeCheckoutTimeoutSeconds(0, 0)).toBeNull();
    expect(computeCheckoutTimeoutSeconds(-5, 0)).toBeNull();
    expect(computeCheckoutTimeoutSeconds(Number.NaN, 0)).toBeNull();
  });
});

describe("openRazorpayCheckout — reservation-bound timeout", () => {
  it("normal checkout: passes a server-derived timeout and resolves success", async () => {
    const { Ctor, captured } = fakeRazorpay(succeed);
    const outcome = await openRazorpayCheckout(orderWith(600), "Consultation", Ctor, { receivedAtMs: 1_000, now: () => 1_000 });
    expect(outcome.type).toBe("success");
    expect(captured[0].options.timeout).toBe(600 - CHECKOUT_SAFETY_BUFFER_SECONDS);
  });

  it("almost-expired reservation: does not open checkout", async () => {
    const { Ctor, captured } = fakeRazorpay(succeed);
    const outcome = await openRazorpayCheckout(orderWith(70), "Consultation", Ctor, { receivedAtMs: 0, now: () => 0 });
    expect(outcome).toEqual({ type: "expired" });
    expect(captured).toHaveLength(0);
  });

  it("expired reservation (time passed since the server response): does not open checkout", async () => {
    const { Ctor, captured } = fakeRazorpay(succeed);
    const outcome = await openRazorpayCheckout(orderWith(300), "Consultation", Ctor, { receivedAtMs: 0, now: () => 300_000 });
    expect(outcome).toEqual({ type: "expired" });
    expect(captured).toHaveLength(0);
  });

  it("checkout timeout: a close at the deadline is reported as timed_out, not failed or dismissed", async () => {
    let clock = 0;
    const { Ctor } = fakeRazorpay((h) => {
      clock = (h.options.timeout as number) * 1000; // Razorpay closes the modal at its timeout
      dismiss(h);
    });
    const outcome = await openRazorpayCheckout(orderWith(600), "Consultation", Ctor, { receivedAtMs: 0, now: () => clock });
    expect(outcome).toEqual({ type: "timed_out" });
  });

  it("checkout timeout fallback: settles timed_out even if Razorpay never calls back", async () => {
    vi.useFakeTimers();
    const { Ctor } = fakeRazorpay(() => {}); // modal never reports anything
    const pending = openRazorpayCheckout(orderWith(200), "Consultation", Ctor, { receivedAtMs: 0, now: () => 0 });
    await vi.advanceTimersByTimeAsync((200 - CHECKOUT_SAFETY_BUFFER_SECONDS) * 1000 + 6_000);
    expect(await pending).toEqual({ type: "timed_out" });
  });

  it("an early manual close is still 'dismissed'", async () => {
    const { Ctor } = fakeRazorpay(dismiss);
    expect(await openRazorpayCheckout(orderWith(600), "Consultation", Ctor, { receivedAtMs: 0, now: () => 0 })).toEqual({
      type: "dismissed",
    });
  });
});

describe("decideAfterCheckoutClosed — server status is the only authority", () => {
  it("successful payment arriving late (after timeout): proceeds to the status view, never 'failed'", () => {
    expect(decideAfterCheckoutClosed("timed_out", statusOf("verifying"))).toBe("proceed");
    expect(decideAfterCheckoutClosed("timed_out", statusOf("paid"))).toBe("proceed");
  });

  it("timed out with no payment: reservation ended, no retry on this hold", () => {
    expect(decideAfterCheckoutClosed("timed_out", statusOf("awaiting_payment"))).toBe("reservation_ended");
  });

  it("dismissed or failed with server-confirmed no payment: another attempt is allowed", () => {
    expect(decideAfterCheckoutClosed("dismissed", statusOf("awaiting_payment"))).toBe("retry_allowed");
    expect(decideAfterCheckoutClosed("failed", statusOf("failed"))).toBe("retry_allowed");
  });

  it("unknown server status: never offers another payment", () => {
    expect(decideAfterCheckoutClosed("dismissed", { kind: "retry_later" })).toBe("unverified");
    expect(decideAfterCheckoutClosed("timed_out", { kind: "not_found" })).toBe("unverified");
  });
});
