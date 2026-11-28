import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../order/route";
import { consultationPaymentService } from "@/lib/backend/services/consultation-payment-service";
import * as rateLimitModule from "@/lib/rate-limit";

describe("POST /api/consultations/payment/order Route Handler Suite", () => {
  const validConsultationId = "c7c88b90-d461-4fa3-a75d-f152d113ba4c";
  const validReservationToken =
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  const getValidPayload = () => ({
    consultationId: validConsultationId,
    reservationToken: validReservationToken,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rateLimitModule, "checkRateLimit").mockResolvedValue({
      isAllowed: true,
      remaining: 4,
      resetTime: Date.now() + 60000,
      retryAfterSeconds: 0,
    });
    // Fake, test-only Razorpay configuration so the readiness gate passes.
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_UnitTestKey000");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "unit-test-key-secret");
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "unit-test-webhook-secret");
    vi.stubEnv("RAZORPAY_MODE", "test");
    vi.stubEnv("PAYMENTS_KILL_SWITCH", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 without creating an order when the payments kill switch is active", async () => {
    vi.stubEnv("PAYMENTS_KILL_SWITCH", "on");
    const spy = vi.spyOn(consultationPaymentService, "createPaymentOrder");
    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "198.51.100.71" },
      body: JSON.stringify(getValidPayload()),
    });
    const response = await POST(request);
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("PAYMENTS_UNAVAILABLE");
    expect(spy).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when Razorpay configuration is incomplete", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    const spy = vi.spyOn(consultationPaymentService, "createPaymentOrder");
    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "198.51.100.72" },
      body: JSON.stringify(getValidPayload()),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(503);
    expect(JSON.stringify(data)).not.toContain("RAZORPAY");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns HTTP 200 with Razorpay checkout parameters (no secrets) on success", async () => {
    vi.spyOn(consultationPaymentService, "createPaymentOrder").mockResolvedValueOnce({
      success: true,
      data: {
        keyId: "rzp_test_UnitTestKey000",
        gatewayOrderId: "order_TestOrder0001",
        amountInPaise: 299900,
        currency: "INR",
        reservationExpiresInSeconds: 600,
        reference: "rcpt_c7c88b90d4614fa3a75df152d113ba4c",
        prefill: { name: "Asha Rao", email: "asha@example.com", contact: "9876543210" },
      },
    });

    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "198.51.100.25",
      },
      body: JSON.stringify(getValidPayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      keyId: "rzp_test_UnitTestKey000",
      orderId: "order_TestOrder0001",
      amount: 299900,
      currency: "INR",
      reference: "rcpt_c7c88b90d4614fa3a75df152d113ba4c",
      prefill: { name: "Asha Rao", email: "asha@example.com", contact: "9876543210" },
      reservationExpiresInSeconds: 600,
    });

    // Zero secret or internal leak
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("unit-test-key-secret");
    expect(serialized).not.toContain("unit-test-webhook-secret");
    expect(serialized).not.toContain(validReservationToken);

    // Security and correlation headers
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
  });

  it("rejects cross-origin requests with HTTP 403", async () => {
    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil-cross-site.com",
        "sec-fetch-site": "cross-site",
        "x-real-ip": "198.51.100.26",
      },
      body: JSON.stringify(getValidPayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.message).toContain("Cross-origin");
  });

  it("rejects oversized request bodies with HTTP 413", async () => {
    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "20000", // > 16 KB (16384 bytes)
        "x-real-ip": "198.51.100.27",
      },
      body: JSON.stringify(getValidPayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data.success).toBe(false);
    expect(data.message).toContain("16 KB");
  });

  it("rejects malformed JSON payloads with HTTP 400", async () => {
    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "198.51.100.28",
      },
      body: "invalid-json-string{",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.message).toContain("Invalid request payload format");
  });

  it("rejects invalid input schema (missing token) with HTTP 400", async () => {
    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "198.51.100.29",
      },
      body: JSON.stringify({ consultationId: validConsultationId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.message).toContain("reservation token");
  });

  it("returns HTTP 429 with Retry-After header when rate limit is exceeded", async () => {
    vi.spyOn(rateLimitModule, "checkRateLimit").mockResolvedValueOnce({
      isAllowed: false,
      remaining: 0,
      resetTime: Date.now() + 450000,
      retryAfterSeconds: 450,
    });

    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "198.51.100.30",
      },
      body: JSON.stringify(getValidPayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.message).toContain("Too many");
    expect(response.headers.get("Retry-After")).toBe("450");
  });

  it("returns HTTP 503 when rate limiter datastore is unavailable", async () => {
    vi.spyOn(rateLimitModule, "checkRateLimit").mockResolvedValueOnce({
      isAllowed: false,
      isUnavailable: true,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfterSeconds: 60,
    });

    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "198.51.100.31",
      },
      body: JSON.stringify(getValidPayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.message).toContain("unavailable");
  });

  describe("Service Error Code to HTTP Status Code Mappings", () => {
    const testCases: Array<{
      error: Parameters<typeof consultationPaymentService.createPaymentOrder>[0] extends never
        ? never
        : import("@/lib/backend/services/consultation-payment-service").PaymentServiceErrorCode;
      expectedStatus: number;
    }> = [
      { error: "CONSULTATION_NOT_FOUND", expectedStatus: 404 },
      { error: "SLOT_NOT_FOUND", expectedStatus: 404 },
      { error: "INVALID_CONSULTATION_STATUS", expectedStatus: 400 },
      { error: "CONSULTATION_CANCELLED", expectedStatus: 400 },
      { error: "CONSULTATION_HAS_NO_SLOT", expectedStatus: 400 },
      { error: "CONSULTATION_ALREADY_CONFIRMED", expectedStatus: 409 },
      { error: "SLOT_NOT_RESERVED", expectedStatus: 409 },
      { error: "PAYMENT_ALREADY_COMPLETED", expectedStatus: 409 },
      { error: "INVALID_RESERVATION_TOKEN", expectedStatus: 403 },
      { error: "RESERVATION_EXPIRING_SOON", expectedStatus: 410 },
      { error: "RESERVATION_EXPIRED", expectedStatus: 410 },
      { error: "PAYMENT_VERIFICATION_PENDING", expectedStatus: 409 },
      { error: "PAYMENTS_UNAVAILABLE", expectedStatus: 503 },
      { error: "GATEWAY_TIMEOUT", expectedStatus: 504 },
      { error: "GATEWAY_ERROR", expectedStatus: 502 },
      { error: "DATABASE_ERROR", expectedStatus: 500 },
    ];

    for (const { error, expectedStatus } of testCases) {
      it(`maps service error '${error}' to HTTP ${expectedStatus}`, async () => {
        vi.spyOn(consultationPaymentService, "createPaymentOrder").mockResolvedValueOnce({
          success: false,
          error,
          message: `Mock message for ${error}`,
        });

        const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-real-ip": `198.51.100.${expectedStatus}`,
          },
          body: JSON.stringify(getValidPayload()),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(expectedStatus);
        expect(data.success).toBe(false);
        expect(data.code).toBe(error);
        expect(data.message).toBe(`Mock message for ${error}`);
      });
    }
  });

  it("handles unexpected runtime exceptions with sanitized HTTP 500 response", async () => {
    vi.spyOn(consultationPaymentService, "createPaymentOrder").mockRejectedValueOnce(
      new Error("Unexpected critical runtime fault")
    );

    const request = new NextRequest("http://localhost:3000/api/consultations/payment/order", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "198.51.100.99",
      },
      body: JSON.stringify(getValidPayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toContain("issue preparing your payment order");
    // Ensure stack trace / exception details are never leaked
    expect(data.message).not.toContain("Unexpected critical runtime fault");
  });
});
