import { describe, it, expect, vi } from "vitest";
import { openRazorpayCheckout } from "../razorpay-loader";
import { isTerminalForPolling, parseRecoveryFragment, POLL_DELAYS_MS } from "../payment-status-client";
import type { PaymentOrderResponseData } from "../booking-types";

const order: PaymentOrderResponseData = {
  keyId: "rzp_test_UnitTestKey000",
  orderId: "order_TestOrder0001",
  amount: 299900,
  currency: "INR",
  reference: "rcpt_x",
  prefill: { name: "Asha Rao", email: "asha@example.com", contact: "9876543210" },
  reservationExpiresInSeconds: 600,
};

type Handlers = { options: Record<string, unknown>; failed?: (r: { error?: { description?: string } }) => void };

function fakeRazorpay(script: (h: Handlers) => void) {
  const captured: Handlers[] = [];
  class FakeRazorpay {
    private h: Handlers;
    constructor(options: Record<string, unknown>) {
      this.h = { options };
      captured.push(this.h);
    }
    on(_event: string, cb: Handlers["failed"]) {
      this.h.failed = cb;
    }
    open() {
      script(this.h);
    }
  }
  return { Ctor: FakeRazorpay as never, captured };
}

describe("openRazorpayCheckout", () => {
  it("opens Standard Checkout with the server order, key id and amount only", async () => {
    const { Ctor, captured } = fakeRazorpay((h) =>
      (h.options.handler as (r: unknown) => void)({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_TestOrder0001", razorpay_signature: "s" })
    );
    const outcome = await openRazorpayCheckout(order, "Consultation", Ctor);
    expect(outcome.type).toBe("success");
    const opts = captured[0].options;
    expect(opts).toMatchObject({ key: "rzp_test_UnitTestKey000", order_id: "order_TestOrder0001", amount: 299900, currency: "INR" });
    expect(JSON.stringify(opts)).not.toMatch(/secret/i);
  });

  it("reports a failed attempt only when the customer closes the modal after it", async () => {
    const { Ctor } = fakeRazorpay((h) => {
      h.failed?.({ error: { description: "Card declined by bank" } });
      ((h.options.modal as Record<string, () => void>).ondismiss)();
    });
    expect(await openRazorpayCheckout(order, "Consultation", Ctor)).toEqual({ type: "failed", message: "Card declined by bank" });
  });

  it("treats a plain dismissal as 'dismissed', not as a failure", async () => {
    const { Ctor } = fakeRazorpay((h) => ((h.options.modal as Record<string, () => void>).ondismiss)());
    expect(await openRazorpayCheckout(order, "Consultation", Ctor)).toEqual({ type: "dismissed" });
  });

  it("settles once even if handler and dismiss both fire (duplicate callback)", async () => {
    const handler = vi.fn();
    const { Ctor } = fakeRazorpay((h) => {
      (h.options.handler as (r: unknown) => void)({ razorpay_payment_id: "pay_1", razorpay_order_id: "o", razorpay_signature: "s" });
      ((h.options.modal as Record<string, () => void>).ondismiss)();
      handler();
    });
    const outcome = await openRazorpayCheckout(order, "Consultation", Ctor);
    expect(outcome.type).toBe("success");
    expect(handler).toHaveBeenCalled();
  });
});

describe("payment status client helpers", () => {
  it("parses a valid recovery fragment and rejects malformed ones", () => {
    const token = "a".repeat(64);
    expect(parseRecoveryFragment(`#c=c7c88b90-d461-4fa3-a75d-f152d113ba4c&t=${token}`)).toEqual({
      consultationId: "c7c88b90-d461-4fa3-a75d-f152d113ba4c",
      reservationToken: token,
    });
    expect(parseRecoveryFragment("#c=x&t=y")).toBeNull();
    expect(parseRecoveryFragment("")).toBeNull();
  });

  it("polls a bounded number of times (about three minutes in total)", () => {
    const total = POLL_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(POLL_DELAYS_MS.length).toBeLessThanOrEqual(20);
    expect(total).toBeLessThanOrEqual(4 * 60 * 1000);
  });

  it("keeps polling while verifying and stops on a terminal state", () => {
    const base = { booking: "pending" as const, slotStartTime: null, amountInPaise: 299900, reference: null, canRetryPayment: false };
    expect(isTerminalForPolling({ ...base, payment: "verifying" })).toBe(false);
    expect(isTerminalForPolling({ ...base, payment: "awaiting_payment" })).toBe(false);
    expect(isTerminalForPolling({ ...base, payment: "paid" })).toBe(true);
    expect(isTerminalForPolling({ ...base, payment: "failed" })).toBe(true);
  });
});
