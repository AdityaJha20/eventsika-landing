import { describe, it, expect } from "vitest";
import { parseRazorpayWebhook, parseStoredRazorpayEvent, toLedgerPaymentStatus } from "../razorpay-webhook";

const paymentEntity = {
  id: "pay_TestPayment01",
  entity: "payment",
  amount: 299900,
  currency: "INR",
  status: "captured",
  order_id: "order_TestOrder0001",
  method: "card",
  email: "customer@example.com",
  contact: "+919876543210",
  card: { last4: "1111", network: "Visa", name: "Customer Name" },
  created_at: 1790000100,
};

describe("parseRazorpayWebhook", () => {
  it.each(["payment.authorized", "payment.captured", "payment.failed", "order.paid"])(
    "parses %s from payload.payment.entity",
    (event) => {
      const result = parseRazorpayWebhook({ entity: "event", event, payload: { payment: { entity: paymentEntity } }, created_at: 1790000200 });
      expect(result.success).toBe(true);
      if (result.success && result.data.kind === "payment") {
        expect(result.data.payment.orderId).toBe("order_TestOrder0001");
        expect(result.data.payment.amountInPaise).toBe(299900);
      } else {
        throw new Error("expected payment event");
      }
    }
  );

  it("persists a minimal payload without contact or card details", () => {
    const result = parseRazorpayWebhook({ event: "payment.captured", payload: { payment: { entity: paymentEntity } } });
    const stored = JSON.stringify(result.success ? result.data.minimalPayload : {});
    expect(stored).not.toContain("customer@example.com");
    expect(stored).not.toContain("9876543210");
    expect(stored).not.toContain("1111");
    expect(stored).not.toContain("Customer Name");
  });

  it.each(["refund.created", "refund.processed", "refund.failed"])("parses %s from payload.refund.entity", (event) => {
    const result = parseRazorpayWebhook({
      event,
      payload: {
        refund: { entity: { id: "rfnd_TestRefund01", entity: "refund", amount: 1000, payment_id: "pay_TestPayment01", status: "processed" } },
        payment: { entity: paymentEntity },
      },
    });
    expect(result.success && result.data.kind).toBe("refund");
  });

  it("acknowledges unknown events as ignored instead of treating them as payments", () => {
    const result = parseRazorpayWebhook({ event: "refund.speed_changed", payload: {} });
    expect(result.success && result.data.kind).toBe("ignored");
  });

  it.each([
    ["non-object", "nope"],
    ["missing event", { payload: {} }],
    ["payment event without entity", { event: "payment.captured", payload: {} }],
    ["payment without order", { event: "payment.captured", payload: { payment: { entity: { ...paymentEntity, order_id: null } } } }],
    ["non-integer amount", { event: "payment.captured", payload: { payment: { entity: { ...paymentEntity, amount: 2999.0 + 0.5 } } } }],
    ["unknown payment status", { event: "payment.captured", payload: { payment: { entity: { ...paymentEntity, status: "weird" } } } }],
  ])("rejects malformed input: %s", (_label, input) => {
    expect(parseRazorpayWebhook(input).success).toBe(false);
  });

  it("round-trips through the stored minimal payload for crash recovery", () => {
    const first = parseRazorpayWebhook({ event: "payment.failed", payload: { payment: { entity: { ...paymentEntity, status: "failed" } } } });
    if (!first.success) throw new Error("parse failed");
    const again = parseStoredRazorpayEvent(JSON.parse(JSON.stringify(first.data.minimalPayload)));
    expect(again.success && again.data.kind === "payment" && again.data.payment.status).toBe("failed");
  });
});

describe("toLedgerPaymentStatus", () => {
  it("only treats captured (or later refunded) payments as captured", () => {
    expect(toLedgerPaymentStatus("captured")).toBe("captured");
    expect(toLedgerPaymentStatus("refunded")).toBe("captured");
    expect(toLedgerPaymentStatus("authorized")).toBe("authorized");
    expect(toLedgerPaymentStatus("failed")).toBe("failed");
    expect(toLedgerPaymentStatus("created")).toBeNull();
  });
});
