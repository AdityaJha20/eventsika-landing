import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, MAX_WEBHOOK_SIZE } from "../route";
import { computeCashfreeWebhookSignature } from "@/lib/backend/security/webhook-signature-verifier";
import { paymentConfirmationService } from "@/lib/backend/services/payment-confirmation-service";
import { SupabaseWebhookEventRepository } from "@/lib/backend/repositories/supabase-webhook-event-repository";
import * as envConfigModule from "@/lib/backend/config/env";
import { WebhookEventRecord } from "@/lib/backend/types/payment-and-consultation";

describe("POST /api/cashfree/webhook Route Handler Suite (Step 6C)", () => {
  const TEST_SECRET = "test_cashfree_secret_key_1234567890abcdef";

  const getValidSuccessPayload = (orderId = "ord_12345", paymentId = "cf_pay_987654") => ({
    type: "PAYMENT_SUCCESS_WEBHOOK",
    event_time: "2026-10-07T12:00:00.000Z",
    data: {
      order: {
        order_id: orderId,
        order_amount: 2999.0,
        order_currency: "INR",
      },
      payment: {
        cf_payment_id: paymentId,
        payment_status: "SUCCESS",
        payment_amount: 2999.0,
        payment_currency: "INR",
        payment_group: "upi",
        bank_reference: "123456789012",
      },
    },
  });

  const createWebhookRequest = (
    body: string,
    options?: {
      timestamp?: string | number;
      signature?: string;
      secretKey?: string;
      contentLength?: string;
      headers?: Record<string, string>;
    }
  ): NextRequest => {
    const rawTimestamp =
      options?.timestamp !== undefined ? String(options.timestamp) : String(Date.now());
    const signature =
      options?.signature !== undefined
        ? options.signature
        : computeCashfreeWebhookSignature(body, rawTimestamp, options?.secretKey || TEST_SECRET);

    const headersInit: Record<string, string> = {
      "content-type": "application/json",
      ...(options?.headers || {}),
    };

    if (signature !== "") {
      headersInit["x-webhook-signature"] = signature;
    }
    if (rawTimestamp !== "") {
      headersInit["x-webhook-timestamp"] = rawTimestamp;
    }
    if (options?.contentLength !== undefined) {
      headersInit["content-length"] = options.contentLength;
    }

    return new NextRequest("http://localhost:3000/api/cashfree/webhook", {
      method: "POST",
      headers: headersInit,
      body,
    });
  };

  const createMockWebhookRecord = (overrides?: Partial<WebhookEventRecord>): WebhookEventRecord => ({
    id: "evt-uuid-0001",
    provider: "cashfree",
    eventId: "evt_ord_12345_cf_pay_987654_PAYMENT_SUCCESS_WEBHOOK",
    eventType: "PAYMENT_SUCCESS_WEBHOOK",
    payload: {},
    signature: "test_sig",
    status: "received",
    processingError: null,
    processedAt: null,
    createdAt: "2026-10-07T12:00:00.000Z",
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(envConfigModule, "getServerConfig").mockReturnValue({
      cashfree: {
        secretKey: TEST_SECRET,
        environment: "sandbox",
        baseUrl: "https://sandbox.cashfree.com/pg",
        isConfigured: true,
      },
      supabase: {
        url: "https://mock.supabase.co",
        publishableKey: "mock_pub",
      },
    } as unknown as envConfigModule.ServerConfig);

    vi.spyOn(SupabaseWebhookEventRepository.prototype, "getWebhookEvent").mockResolvedValue(null);
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "recordWebhookEvent").mockResolvedValue(
      createMockWebhookRecord()
    );
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "updateWebhookEventStatus").mockResolvedValue(
      createMockWebhookRecord({ status: "processed" })
    );

    vi.spyOn(paymentConfirmationService, "processPaymentWebhook").mockResolvedValue({
      success: true,
      outcome: "confirmed",
      orderId: "order-uuid-1",
      consultationId: "consultation-uuid-1",
      transactionId: "trans-uuid-1",
      slotId: "slot-uuid-1",
    });
  });

  // ============================================================================
  // 1. Success Outcomes (Tests 1 - 4)
  // ============================================================================

  it("1. processes valid signature + PAYMENT_SUCCESS_WEBHOOK, calls service, updates status to processed, returns 200", async () => {
    const rawBody = JSON.stringify(getValidSuccessPayload("ord_12345", "987654"));
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("processed");
    expect(data.outcome).toBe("confirmed");
    expect(data.orderId).toBe("order-uuid-1");

    expect(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "cashfree",
        eventId: "evt_ord_12345_987654_PAYMENT_SUCCESS_WEBHOOK",
        eventType: "PAYMENT_SUCCESS_WEBHOOK",
        status: "received",
      })
    );
    expect(paymentConfirmationService.processPaymentWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PAYMENT_SUCCESS_WEBHOOK",
        orderId: "ord_12345",
        gatewayPaymentId: "987654",
        amountInPaise: 299900,
        currency: "INR",
      })
    );
    expect(SupabaseWebhookEventRepository.prototype.updateWebhookEventStatus).toHaveBeenCalledWith(
      "evt-uuid-0001",
      "processed",
      expect.objectContaining({ processedAt: expect.any(String) })
    );
  });

  it("2. returns 200 with outcome slot_conflict when service detects slot conflict", async () => {
    vi.spyOn(paymentConfirmationService, "processPaymentWebhook").mockResolvedValueOnce({
      success: true,
      outcome: "slot_conflict",
      orderId: "order-uuid-1",
      consultationId: "consultation-uuid-1",
      message: "Slot conflict pending reschedule.",
    });

    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("processed");
    expect(data.outcome).toBe("slot_conflict");
    expect(SupabaseWebhookEventRepository.prototype.updateWebhookEventStatus).toHaveBeenCalledWith(
      "evt-uuid-0001",
      "processed",
      expect.any(Object)
    );
  });

  it("3. processes valid PAYMENT_FAILED_WEBHOOK, updates status, and returns 200 with outcome payment_failed", async () => {
    vi.spyOn(paymentConfirmationService, "processPaymentWebhook").mockResolvedValueOnce({
      success: true,
      outcome: "payment_failed",
      orderId: "order-uuid-1",
      consultationId: "consultation-uuid-1",
      message: "Payment failure recorded.",
    });

    const failedPayload = {
      type: "PAYMENT_FAILED_WEBHOOK",
      data: {
        order: { order_id: "ord_failed_1" },
        payment: { cf_payment_id: "cf_pay_failed_1", payment_status: "FAILED" },
        error_details: { error_code: "BANK_DECLINED", error_description: "Insufficient funds" },
      },
    };

    const rawBody = JSON.stringify(failedPayload);
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("processed");
    expect(data.outcome).toBe("payment_failed");
  });

  it("4. processes valid PAYMENT_USER_DROPPED_WEBHOOK, updates status, and returns 200 with outcome user_dropped", async () => {
    vi.spyOn(paymentConfirmationService, "processPaymentWebhook").mockResolvedValueOnce({
      success: true,
      outcome: "user_dropped",
      orderId: "order-uuid-1",
      consultationId: "consultation-uuid-1",
      message: "User dropped payment recorded.",
    });

    const droppedPayload = {
      type: "PAYMENT_USER_DROPPED_WEBHOOK",
      data: {
        order: { order_id: "ord_drop_1" },
        payment: { cf_payment_id: "cf_pay_drop_1", payment_status: "USER_DROPPED" },
      },
    };

    const rawBody = JSON.stringify(droppedPayload);
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("processed");
    expect(data.outcome).toBe("user_dropped");
  });

  // ============================================================================
  // 2. Cryptographic Security & Replay Attacks (Tests 5 - 10)
  // ============================================================================

  it("5. rejects invalid signature with HTTP 401 and invokes zero persistence or service logic", async () => {
    const rawBody = JSON.stringify(getValidSuccessPayload());
    const timestamp = String(Date.now());
    const validSig = computeCashfreeWebhookSignature(rawBody, timestamp, TEST_SECRET);
    // Flip characters in base64 signature
    const invalidSig = validSig.slice(0, -2) + (validSig.endsWith("A=") ? "B=" : "A=");

    const request = createWebhookRequest(rawBody, {
      timestamp,
      signature: invalidSig,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid webhook signature.");

    expect(paymentConfirmationService.processPaymentWebhook).not.toHaveBeenCalled();
    expect(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).not.toHaveBeenCalled();
  });

  it("6. rejects expired timestamp (> 5 min tolerance) with HTTP 401", async () => {
    const rawBody = JSON.stringify(getValidSuccessPayload());
    // 6 minutes in the past
    const expiredTimestamp = Date.now() - 6 * 60 * 1000;
    const request = createWebhookRequest(rawBody, { timestamp: expiredTimestamp });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain("replay tolerance window");
  });

  it("7. rejects future timestamp beyond tolerance (> 5 min) with HTTP 401", async () => {
    const rawBody = JSON.stringify(getValidSuccessPayload());
    // 6 minutes in the future
    const futureTimestamp = Date.now() + 6 * 60 * 1000;
    const request = createWebhookRequest(rawBody, { timestamp: futureTimestamp });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain("replay tolerance window");
  });

  it("8. rejects missing signature header with HTTP 400", async () => {
    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = new NextRequest("http://localhost:3000/api/cashfree/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-timestamp": String(Date.now()),
      },
      body: rawBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Missing x-webhook-signature header.");
  });

  it("9. rejects missing timestamp header with HTTP 400", async () => {
    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = new NextRequest("http://localhost:3000/api/cashfree/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": "some_sig",
      },
      body: rawBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Missing x-webhook-timestamp header.");
  });

  it("10. rejects malformed timestamp header with HTTP 400", async () => {
    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = new NextRequest("http://localhost:3000/api/cashfree/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": "some_sig",
        "x-webhook-timestamp": "not_a_valid_date_or_epoch",
      },
      body: rawBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Malformed or unparseable webhook timestamp.");
  });

  // ============================================================================
  // 3. Payload Integrity & Size Ceiling (Tests 11 - 13)
  // ============================================================================

  it("11. returns HTTP 400 for valid signature over malformed JSON and does not persist event", async () => {
    const malformedBody = "{ invalid json syntax: true, ";
    const request = createWebhookRequest(malformedBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Malformed JSON payload.");

    expect(paymentConfirmationService.processPaymentWebhook).not.toHaveBeenCalled();
    expect(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).not.toHaveBeenCalled();
  });

  it("12. returns HTTP 413 when payload exceeds 64 KB ceiling via Content-Length or actual bytes", async () => {
    // 12A. Pre-check via Content-Length
    const req1 = createWebhookRequest("short_body", {
      contentLength: String(MAX_WEBHOOK_SIZE + 100),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(413);

    // 12B. Actual body check (> 64 KB body)
    const largeBody = "x".repeat(MAX_WEBHOOK_SIZE + 1);
    const req2 = new NextRequest("http://localhost:3000/api/cashfree/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": "dummy",
        "x-webhook-timestamp": String(Date.now()),
      },
      body: largeBody,
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(413);

    // 12C. Multibyte UTF-8 characters exceeding 64 KB
    const multibyteChar = "₹"; // 3 bytes in UTF-8
    const numChars = Math.floor(MAX_WEBHOOK_SIZE / 3) + 10;
    const multibyteBody = multibyteChar.repeat(numChars);
    const req3 = new NextRequest("http://localhost:3000/api/cashfree/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": "dummy",
        "x-webhook-timestamp": String(Date.now()),
      },
      body: multibyteBody,
    });
    const res3 = await POST(req3);
    expect(res3.status).toBe(413);
  });

  it("13. persists valid signature + valid JSON with unsupported event type as 'ignored' and returns 200", async () => {
    const unsupportedPayload = {
      type: "REFUND_STATUS_WEBHOOK",
      data: {
        order: { order_id: "ord_refund_1" },
        refund_id: "ref_999",
      },
    };

    const rawBody = JSON.stringify(unsupportedPayload);
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("ignored");

    expect(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "cashfree",
        eventType: "REFUND_STATUS_WEBHOOK",
        status: "ignored",
      })
    );
    expect(paymentConfirmationService.processPaymentWebhook).not.toHaveBeenCalled();
  });

  // ============================================================================
  // 4. Idempotency & Deduplication (Tests 14 - 16)
  // ============================================================================

  it("14. acknowledges already processed event with 200 without invoking service", async () => {
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "getWebhookEvent").mockResolvedValueOnce(
      createMockWebhookRecord({ status: "processed" })
    );

    const rawBody = JSON.stringify(getValidSuccessPayload("ord_12345", "987654"));
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("already_processed");
    expect(data.orderId).toBe("ord_12345");

    expect(paymentConfirmationService.processPaymentWebhook).not.toHaveBeenCalled();
  });

  it("15. retries service processing when event was previously recorded as 'failed'", async () => {
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "getWebhookEvent").mockResolvedValueOnce(
      createMockWebhookRecord({ id: "evt-uuid-failed-prev", status: "failed" })
    );

    const rawBody = JSON.stringify(getValidSuccessPayload("ord_12345", "987654"));
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("processed");

    expect(paymentConfirmationService.processPaymentWebhook).toHaveBeenCalled();
    expect(SupabaseWebhookEventRepository.prototype.updateWebhookEventStatus).toHaveBeenCalledWith(
      "evt-uuid-failed-prev",
      "processed",
      expect.any(Object)
    );
  });

  it("16. handles concurrent insert collision (PostgreSQL 23505) and returns 200 duplicate_concurrent", async () => {
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "recordWebhookEvent").mockRejectedValueOnce({
      code: "23505",
      message: 'duplicate key value violates unique constraint "idx_webhook_provider_event"',
    });

    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("duplicate_concurrent");

    expect(paymentConfirmationService.processPaymentWebhook).not.toHaveBeenCalled();
  });

  // ============================================================================
  // 5. Business Failure & Transient Retry Semantics (Tests 17 - 18)
  // ============================================================================

  it("17. updates webhook event to 'failed' and returns 200 for permanent business failures (ORDER_NOT_FOUND, AMOUNT_MISMATCH)", async () => {
    vi.spyOn(paymentConfirmationService, "processPaymentWebhook").mockResolvedValueOnce({
      success: false,
      error: "ORDER_NOT_FOUND",
      message: 'Payment order "ord_12345" not found.',
      orderId: "ord_12345",
    });

    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("failed");
    expect(data.error).toBe("ORDER_NOT_FOUND");
    expect(data.orderId).toBe("ord_12345");

    expect(SupabaseWebhookEventRepository.prototype.updateWebhookEventStatus).toHaveBeenCalledWith(
      "evt-uuid-0001",
      "failed",
      expect.objectContaining({ processingError: 'Payment order "ord_12345" not found.' })
    );
  });

  it("18. updates webhook event to 'failed' and returns 500 for transient DATABASE_ERROR to trigger gateway retry", async () => {
    vi.spyOn(paymentConfirmationService, "processPaymentWebhook").mockResolvedValueOnce({
      success: false,
      error: "DATABASE_ERROR",
      message: "PostgREST connection pool timeout.",
      orderId: "ord_12345",
    });

    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Internal processing error.");

    expect(SupabaseWebhookEventRepository.prototype.updateWebhookEventStatus).toHaveBeenCalledWith(
      "evt-uuid-0001",
      "failed",
      expect.objectContaining({ processingError: "PostgREST connection pool timeout." })
    );
  });

  // ============================================================================
  // 6. Security Headers & Observability (Tests 19 - 24)
  // ============================================================================

  it("19. attaches mandatory security headers (Cache-Control, X-Content-Type-Options, X-Request-Id) to every response", async () => {
    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = createWebhookRequest(rawBody, {
      headers: { "x-request-id": "req-custom-client-trace-123" },
    });

    const response = await POST(request);

    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Request-Id")).toBe("req-custom-client-trace-123");
  });

  it("20. rejects when secret key is unconfigured on server with HTTP 500", async () => {
    vi.spyOn(envConfigModule, "getServerConfig").mockReturnValue({
      cashfree: {
        secretKey: undefined,
        environment: "sandbox",
        baseUrl: "https://sandbox.cashfree.com/pg",
        isConfigured: false,
      },
    } as unknown as envConfigModule.ServerConfig);

    const rawBody = JSON.stringify(getValidSuccessPayload());
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Server configuration error.");
  });

  it("21. treats in-flight event (status: 'received') as duplicate in flight and returns 200 without calling service", async () => {
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "getWebhookEvent").mockResolvedValueOnce(
      createMockWebhookRecord({ status: "received" })
    );

    const rawBody = JSON.stringify(getValidSuccessPayload("ord_12345", "987654"));
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("duplicate_in_flight");
    expect(paymentConfirmationService.processPaymentWebhook).not.toHaveBeenCalled();
  });

  it("22. treats previously ignored unsupported event as duplicate already_ignored and returns 200", async () => {
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "getWebhookEvent").mockResolvedValueOnce(
      createMockWebhookRecord({ status: "ignored" })
    );

    const unsupportedPayload = {
      type: "SUBSCRIPTION_RENEWAL",
      data: { order: { order_id: "ord_sub_1" } },
    };
    const rawBody = JSON.stringify(unsupportedPayload);
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe("already_ignored");
    expect(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).not.toHaveBeenCalled();
  });

  it("23. verifies that signature verification uses exact unparsed raw body byte-for-byte", async () => {
    // Spacing inside payload
    const unformattedJson = '{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"ord_12345","order_amount":2999},"payment":{"cf_payment_id":"987654"}}}';
    const timestamp = String(Date.now());
    // Sign the compact JSON
    const validSignature = computeCashfreeWebhookSignature(unformattedJson, timestamp, TEST_SECRET);

    // If caller sends formatted/indented JSON with the signature computed over the compact JSON, it must fail!
    const formattedJson = JSON.stringify(JSON.parse(unformattedJson), null, 2);

    const request = new NextRequest("http://localhost:3000/api/cashfree/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": validSignature,
        "x-webhook-timestamp": timestamp,
      },
      body: formattedJson,
    });

    const response = await POST(request);
    expect(response.status).toBe(401); // Mismatched raw body rejected!
  });

  it("24. supports explicit top-level event_id when provided in the envelope", async () => {
    const payloadWithEventId = {
      event_id: "cf_explicit_event_id_xyz",
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order: { order_id: "ord_custom_id" },
        payment: { cf_payment_id: "pay_custom_id", payment_status: "SUCCESS", payment_amount: 2999 },
      },
    };

    const rawBody = JSON.stringify(payloadWithEventId);
    const request = createWebhookRequest(rawBody);

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "cf_explicit_event_id_xyz",
      })
    );
  });
});
