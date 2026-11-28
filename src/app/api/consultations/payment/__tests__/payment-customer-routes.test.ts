import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const afterMock = vi.hoisted(() => vi.fn());
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: afterMock };
});

import { POST as verifyPOST } from "../verify/route";
import { POST as statusPOST } from "../status/route";
import { POST as rebookPOST } from "../rebook/route";
import { POST as reservePOST } from "../../reserve/route";
import * as rateLimitModule from "@/lib/rate-limit";
import { paymentConfirmationService } from "@/lib/backend/services/payment-confirmation-service";
import { paymentStatusService } from "@/lib/backend/services/payment-status-service";
import { consultationBookingService } from "@/lib/backend/services/consultation-booking-service";

const CONSULTATION_ID = "c7c88b90-d461-4fa3-a75d-f152d113ba4c";
const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const SIGNATURE = "f".repeat(64);

const status = {
  payment: "paid" as const,
  booking: "confirmed" as const,
  slotStartTime: "2026-10-05T04:30:00.000Z",
  amountInPaise: 299900,
  reference: "rcpt_x",
  canRetryPayment: false,
};

function req(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "198.51.100.40", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const verifyBody = (o: Record<string, unknown> = {}) => ({
  consultationId: CONSULTATION_ID,
  reservationToken: TOKEN,
  razorpay_order_id: "order_TestOrder0001",
  razorpay_payment_id: "pay_TestPayment01",
  razorpay_signature: SIGNATURE,
  ...o,
});

beforeEach(() => {
  vi.restoreAllMocks();
  afterMock.mockReset();
  vi.unstubAllEnvs();
  vi.spyOn(rateLimitModule, "checkRateLimit").mockResolvedValue({ isAllowed: true, remaining: 10, resetTime: Date.now() + 60000, retryAfterSeconds: 0 });
});

describe("POST /api/consultations/payment/verify", () => {
  it("verifies server-side, schedules notifications after the response and returns authoritative status", async () => {
    vi.spyOn(paymentConfirmationService, "verifyCheckoutCallback").mockResolvedValueOnce({ success: true, outcome: "confirmed", orderId: "o1", consultationId: CONSULTATION_ID });
    vi.spyOn(paymentStatusService, "getStatus").mockResolvedValueOnce({ success: true, data: status });

    const res = await verifyPOST(req("/api/consultations/payment/verify", verifyBody()));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(status);
    expect(paymentConfirmationService.verifyCheckoutCallback).toHaveBeenCalledWith({
      consultationId: CONSULTATION_ID,
      reservationToken: TOKEN,
      razorpayOrderId: "order_TestOrder0001",
      razorpayPaymentId: "pay_TestPayment01",
      razorpaySignature: SIGNATURE,
    });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("rejects client attempts to set the amount or status", async () => {
    const spy = vi.spyOn(paymentConfirmationService, "verifyCheckoutCallback");
    for (const extra of [{ amount: 1 }, { status: "paid" }, { amountInPaise: 1 }]) {
      const res = await verifyPOST(req("/api/consultations/payment/verify", verifyBody(extra)));
      expect(res.status).toBe(400);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ["bad order id", { razorpay_order_id: "ord_123" }],
    ["bad payment id", { razorpay_payment_id: "../etc" }],
    ["bad signature", { razorpay_signature: "zz" }],
    ["bad token", { reservationToken: "short" }],
  ])("returns 400 for %s", async (_l, override) => {
    const res = await verifyPOST(req("/api/consultations/payment/verify", verifyBody(override)));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid signature and schedules nothing", async () => {
    vi.spyOn(paymentConfirmationService, "verifyCheckoutCallback").mockResolvedValueOnce({ success: false, error: "SIGNATURE_INVALID", message: "Payment verification failed." });
    const res = await verifyPOST(req("/api/consultations/payment/verify", verifyBody()));
    expect(res.status).toBe(400);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("answers 202 'still verifying' (never failure) when Razorpay is unreachable", async () => {
    vi.spyOn(paymentConfirmationService, "verifyCheckoutCallback").mockResolvedValueOnce({ success: false, error: "GATEWAY_ERROR", message: "Payment is being verified. Please do not pay again." });
    const res = await verifyPOST(req("/api/consultations/payment/verify", verifyBody()));
    expect(res.status).toBe(202);
    expect((await res.json()).message).toContain("do not pay again");
  });

  it("blocks cross-origin requests", async () => {
    const res = await verifyPOST(
      req("/api/consultations/payment/verify", verifyBody(), { origin: "https://evil.example", "sec-fetch-site": "cross-site", host: "localhost:3000" })
    );
    expect(res.status).toBe(403);
  });

  it("fails closed (503) when the rate limiter is unavailable", async () => {
    vi.mocked(rateLimitModule.checkRateLimit).mockResolvedValueOnce({ isAllowed: false, isUnavailable: true, remaining: 0, resetTime: 0, retryAfterSeconds: 0 } as never);
    const res = await verifyPOST(req("/api/consultations/payment/verify", verifyBody()));
    expect(res.status).toBe(503);
  });

  it("rejects oversized bodies even without Content-Length", async () => {
    const res = await verifyPOST(req("/api/consultations/payment/verify", JSON.stringify({ ...verifyBody(), pad: "x".repeat(5000) })));
    expect(res.status).toBe(413);
  });
});

describe("POST /api/consultations/payment/status", () => {
  it("returns status with provider sync enabled", async () => {
    const spy = vi.spyOn(paymentStatusService, "getStatus").mockResolvedValueOnce({ success: true, data: status });
    const res = await statusPOST(req("/api/consultations/payment/status", { consultationId: CONSULTATION_ID, reservationToken: TOKEN }));
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, syncWithProvider: true });
  });

  it("maps NOT_FOUND to 404 and DB problems to a reassuring 503", async () => {
    vi.spyOn(paymentStatusService, "getStatus").mockResolvedValueOnce({ success: false, error: "NOT_FOUND" });
    expect((await statusPOST(req("/api/consultations/payment/status", { consultationId: CONSULTATION_ID, reservationToken: TOKEN }))).status).toBe(404);
    vi.spyOn(paymentStatusService, "getStatus").mockResolvedValueOnce({ success: false, error: "DATABASE_ERROR" });
    const res = await statusPOST(req("/api/consultations/payment/status", { consultationId: CONSULTATION_ID, reservationToken: TOKEN }));
    expect(res.status).toBe(503);
    expect((await res.json()).message).toContain("payment is safe");
  });

  it("is rate limited", async () => {
    vi.mocked(rateLimitModule.checkRateLimit).mockResolvedValueOnce({ isAllowed: false, remaining: 0, resetTime: 0, retryAfterSeconds: 30 });
    const res = await statusPOST(req("/api/consultations/payment/status", { consultationId: CONSULTATION_ID, reservationToken: TOKEN }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});

describe("POST /api/consultations/payment/rebook", () => {
  const body = { consultationId: CONSULTATION_ID, reservationToken: TOKEN, slotId: "77777777-7777-4777-8777-777777777777" };

  it.each([
    ["REBOOKED", 200],
    ["SLOT_UNAVAILABLE", 409],
    ["NOT_FOUND", 404],
    ["NOT_IN_CONFLICT", 409],
    ["DATABASE_ERROR", 503],
  ] as const)("maps %s to HTTP %d", async (code, http) => {
    vi.spyOn(paymentStatusService, "rebookConflict").mockResolvedValueOnce(code);
    const res = await rebookPOST(req("/api/consultations/payment/rebook", body));
    expect(res.status).toBe(http);
  });

  it("validates the slot id", async () => {
    const res = await rebookPOST(req("/api/consultations/payment/rebook", { ...body, slotId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("keeps working while the payments kill switch is active (it takes no new money)", async () => {
    vi.stubEnv("PAYMENTS_KILL_SWITCH", "on");
    vi.spyOn(paymentStatusService, "rebookConflict").mockResolvedValueOnce("REBOOKED");
    expect((await rebookPOST(req("/api/consultations/payment/rebook", body))).status).toBe(200);
  });
});

describe("Payments kill switch on reservations", () => {
  it("blocks new slot holds with 503 when active", async () => {
    vi.stubEnv("PAYMENTS_KILL_SWITCH", "true");
    const spy = vi.spyOn(consultationBookingService, "reserveSlot");
    const res = await reservePOST(req("/api/consultations/reserve", { any: "body" }));
    expect(res.status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });

  it("never blocks status checks", async () => {
    vi.stubEnv("PAYMENTS_KILL_SWITCH", "true");
    vi.spyOn(paymentStatusService, "getStatus").mockResolvedValueOnce({ success: true, data: status });
    expect((await statusPOST(req("/api/consultations/payment/status", { consultationId: CONSULTATION_ID, reservationToken: TOKEN }))).status).toBe(200);
  });
});
