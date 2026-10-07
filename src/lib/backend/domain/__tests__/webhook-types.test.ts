import { describe, expect, it } from "vitest";
import {
  isCashfreePaymentEventType,
  parseCashfreeWebhookPayload,
  CASHFREE_PAYMENT_EVENT_TYPES,
  CASHFREE_ORDER_ID_REGEX,
} from "../webhook-types";

describe("Cashfree Webhook Domain Types & Runtime Parser (Step 6A)", () => {
  // ============================================================================
  // 1. Discriminator Type Guard Tests
  // ============================================================================

  it("identifies supported Cashfree event types correctly", () => {
    expect(CASHFREE_PAYMENT_EVENT_TYPES).toEqual([
      "PAYMENT_SUCCESS_WEBHOOK",
      "PAYMENT_FAILED_WEBHOOK",
      "PAYMENT_USER_DROPPED_WEBHOOK",
    ]);

    for (const valid of CASHFREE_PAYMENT_EVENT_TYPES) {
      expect(isCashfreePaymentEventType(valid)).toBe(true);
    }

    expect(isCashfreePaymentEventType("REFUND_SUCCESS_WEBHOOK")).toBe(false);
    expect(isCashfreePaymentEventType("SUBSCRIPTION_WEBHOOK")).toBe(false);
    expect(isCashfreePaymentEventType("")).toBe(false);
    expect(isCashfreePaymentEventType(null)).toBe(false);
    expect(isCashfreePaymentEventType(undefined)).toBe(false);
    expect(isCashfreePaymentEventType(12345)).toBe(false);
  });

  // ============================================================================
  // 2. Runtime Payload Parser Tests
  // ============================================================================

  it("test 1: accepts a standard PAYMENT_SUCCESS_WEBHOOK payload with nested structure", () => {
    const rawSuccessPayload = {
      data: {
        order: {
          order_id: "ord_c7c88b90d4614fa3a75df152d113ba4c",
          order_amount: 2999.0,
          order_currency: "INR",
        },
        payment: {
          cf_payment_id: "9876543210",
          payment_status: "SUCCESS",
          payment_amount: 2999.0,
          payment_currency: "INR",
          payment_message: "Transaction Successful",
          payment_time: "2026-10-06T12:00:00Z",
          bank_reference: "BANK_REF_998877",
          payment_group: "upi",
        },
        customer_details: {
          customer_name: "Rahul Verma",
          customer_email: "rahul@example.com",
        },
      },
      event_time: "2026-10-06T12:00:01Z",
      type: "PAYMENT_SUCCESS_WEBHOOK",
    };

    const result = parseCashfreeWebhookPayload(rawSuccessPayload);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.eventType).toBe("PAYMENT_SUCCESS_WEBHOOK");
    expect(result.data.orderId).toBe("ord_c7c88b90d4614fa3a75df152d113ba4c");
    expect(result.data.gatewayPaymentId).toBe("9876543210");
    expect(result.data.paymentStatus).toBe("SUCCESS");
    expect(result.data.amountInPaise).toBe(299900); // Converted ₹2999.00 to 299900 paise
    expect(result.data.currency).toBe("INR");
    expect(result.data.paymentMethod).toBe("upi");
    expect(result.data.bankReference).toBe("BANK_REF_998877");
    expect(result.data.eventTime).toBe("2026-10-06T12:00:01Z");
    expect(result.data.rawPayload).toBe(rawSuccessPayload);
  });

  it("test 2: accepts a PAYMENT_FAILED_WEBHOOK payload with error details", () => {
    const rawFailedPayload = {
      data: {
        order: {
          order_id: "ord_failed_123",
          order_amount: 1500.0,
        },
        payment: {
          cf_payment_id: "88776655",
          payment_status: "FAILED",
          payment_amount: 1500.0,
          payment_message: "Insufficient funds in customer account",
        },
        error_details: {
          error_code: "INSUFFICIENT_FUNDS",
          error_description: "Transaction declined by issuing bank",
        },
      },
      type: "PAYMENT_FAILED_WEBHOOK",
    };

    const result = parseCashfreeWebhookPayload(rawFailedPayload);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.eventType).toBe("PAYMENT_FAILED_WEBHOOK");
    expect(result.data.orderId).toBe("ord_failed_123");
    expect(result.data.gatewayPaymentId).toBe("88776655");
    expect(result.data.paymentStatus).toBe("FAILED");
    expect(result.data.amountInPaise).toBe(150000);
    expect(result.data.errorCode).toBe("INSUFFICIENT_FUNDS");
    expect(result.data.errorDescription).toBe("Transaction declined by issuing bank");
  });

  it("test 3: accepts a PAYMENT_USER_DROPPED_WEBHOOK payload without payment id", () => {
    const rawUserDroppedPayload = {
      data: {
        order: {
          order_id: "ord_dropped_456",
          order_amount: 2999.0,
        },
      },
      type: "PAYMENT_USER_DROPPED_WEBHOOK",
    };

    const result = parseCashfreeWebhookPayload(rawUserDroppedPayload);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.eventType).toBe("PAYMENT_USER_DROPPED_WEBHOOK");
    expect(result.data.orderId).toBe("ord_dropped_456");
    expect(result.data.gatewayPaymentId).toBeNull();
    expect(result.data.paymentStatus).toBe("USER_DROPPED");
    expect(result.data.amountInPaise).toBe(299900);
  });

  it("test 4: rejects payload missing required event discriminator", () => {
    const missingTypePayload = {
      data: {
        order: { order_id: "ord_test" },
      },
    };

    const result = parseCashfreeWebhookPayload(missingTypePayload);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe("UNSUPPORTED_OR_MISSING_EVENT_TYPE");
  });

  it("test 5: rejects malformed envelopes (null, undefined, arrays, primitive types)", () => {
    const malformedCases = [null, undefined, [], "string", 123, true];

    for (const malformed of malformedCases) {
      const result = parseCashfreeWebhookPayload(malformed);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe("MALFORMED_ENVELOPE");
    }
  });

  it("test 6: rejects payload when order_id is missing or whitespace", () => {
    const cases = [
      { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: {} } },
      { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order_id: "   " } },
      { type: "PAYMENT_SUCCESS_WEBHOOK", data: {} },
    ];

    for (const badPayload of cases) {
      const result = parseCashfreeWebhookPayload(badPayload);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe("MISSING_ORDER_ID");
    }
  });

  it("test 7: supports both audited order-id placement locations (nested vs flat)", () => {
    // Nested: data.order.order_id
    const nestedPayload = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order: { order_id: "ord_nested_placement", order_amount: 1000 },
        payment: { cf_payment_id: "111", payment_amount: 1000 },
      },
    };
    const nestedResult = parseCashfreeWebhookPayload(nestedPayload);
    expect(nestedResult.success).toBe(true);
    if (nestedResult.success) {
      expect(nestedResult.data.orderId).toBe("ord_nested_placement");
      expect(nestedResult.data.gatewayPaymentId).toBe("111");
      expect(nestedResult.data.amountInPaise).toBe(100000);
    }

    // Flat: data.order_id & data.cf_payment_id
    const flatPayload = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order_id: "ord_flat_placement",
        cf_payment_id: "222",
        payment_amount: 500,
      },
    };
    const flatResult = parseCashfreeWebhookPayload(flatPayload);
    expect(flatResult.success).toBe(true);
    if (flatResult.success) {
      expect(flatResult.data.orderId).toBe("ord_flat_placement");
      expect(flatResult.data.gatewayPaymentId).toBe("222");
      expect(flatResult.data.amountInPaise).toBe(50000);
    }
  });

  it("test 8: safely rejects unknown event types", () => {
    const unknownTypePayload = {
      type: "SUBSCRIPTION_NEW_EVENT",
      data: {
        order_id: "ord_sub",
      },
    };

    const result = parseCashfreeWebhookPayload(unknownTypePayload);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe("UNSUPPORTED_OR_MISSING_EVENT_TYPE");
  });

  it("test 9: converts numeric gateway payment IDs cleanly to strings", () => {
    const numericPaymentIdPayload = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order_id: "ord_num_test",
        payment: {
          cf_payment_id: 123456789, // number in JSON
          payment_amount: 2999,
        },
      },
    };

    const result = parseCashfreeWebhookPayload(numericPaymentIdPayload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.gatewayPaymentId).toBe("123456789");
  });

  it("test 10: rejects negative or invalid amount numbers", () => {
    const invalidAmountPayload = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order_id: "ord_bad_amount",
        payment: {
          payment_amount: -50,
        },
      },
    };

    const result = parseCashfreeWebhookPayload(invalidAmountPayload);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe("INVALID_AMOUNT");
  });

  it("test 11: rejects invalid order identifier shape (special characters, too short/long)", () => {
    expect(CASHFREE_ORDER_ID_REGEX.test("ab")).toBe(false); // too short (< 3)
    expect(CASHFREE_ORDER_ID_REGEX.test("a".repeat(46))).toBe(false); // too long (> 45)
    expect(CASHFREE_ORDER_ID_REGEX.test("ord 123")).toBe(false); // space
    expect(CASHFREE_ORDER_ID_REGEX.test("ord@123!")).toBe(false); // special chars

    const invalidShapePayloads = [
      { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order_id: "ab", payment_amount: 100 } },
      { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order_id: "ord 123", payment_amount: 100 } },
      { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order_id: "ord@bad!", payment_amount: 100 } },
      { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order_id: "x".repeat(46), payment_amount: 100 } },
    ];

    for (const badPayload of invalidShapePayloads) {
      const result = parseCashfreeWebhookPayload(badPayload);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe("INVALID_ORDER_ID");
      expect(result.error).toContain("Invalid order ID format");
    }
  });

  it("test 12: rejects boolean, empty string, and whitespace string amounts", () => {
    const invalidAmountCases = [
      { payment_amount: true },
      { payment_amount: false },
      { payment_amount: "" },
      { payment_amount: "   " },
      { payment_amount: "abc" },
      { payment_amount: null },
      { payment_amount: {} },
    ];

    for (const badAmount of invalidAmountCases) {
      const payload = {
        type: "PAYMENT_SUCCESS_WEBHOOK",
        data: {
          order_id: "ord_valid_123",
          payment: badAmount,
        },
      };

      const result = parseCashfreeWebhookPayload(payload);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe("INVALID_AMOUNT");
    }
  });

  it("test 13: rejects PAYMENT_SUCCESS_WEBHOOK with 0 or missing amount", () => {
    // 0 amount on success webhook is invalid
    const zeroAmountPayload = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order_id: "ord_zero_amount",
        payment: { payment_amount: 0 },
      },
    };
    const zeroResult = parseCashfreeWebhookPayload(zeroAmountPayload);
    expect(zeroResult.success).toBe(false);
    if (zeroResult.success) return;
    expect(zeroResult.code).toBe("INVALID_AMOUNT");
    expect(zeroResult.error).toContain("positive payment amount");

    // Missing amount on success webhook is invalid
    const missingAmountPayload = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order_id: "ord_missing_amount",
      },
    };
    const missingResult = parseCashfreeWebhookPayload(missingAmountPayload);
    expect(missingResult.success).toBe(false);
    if (missingResult.success) return;
    expect(missingResult.code).toBe("INVALID_AMOUNT");
  });

  it("test 14: parses valid string amounts into integer paise correctly", () => {
    const stringAmountPayload = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order_id: "ord_str_amount_123",
        payment: {
          payment_amount: "2999.50",
          cf_payment_id: "998877",
        },
      },
    };

    const result = parseCashfreeWebhookPayload(stringAmountPayload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.amountInPaise).toBe(299950);
  });

  it("test 15: accepts PAYMENT_USER_DROPPED_WEBHOOK or PAYMENT_FAILED_WEBHOOK without payment amount", () => {
    const droppedPayload = {
      type: "PAYMENT_USER_DROPPED_WEBHOOK",
      data: {
        order_id: "ord_dropped_no_amount",
      },
    };

    const result = parseCashfreeWebhookPayload(droppedPayload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.amountInPaise).toBe(0);
    expect(result.data.paymentStatus).toBe("USER_DROPPED");
  });
});
