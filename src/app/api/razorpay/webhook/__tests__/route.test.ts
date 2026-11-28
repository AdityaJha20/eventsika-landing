import crypto from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const afterMock = vi.hoisted(() => vi.fn());
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: afterMock };
});

import { POST } from "../route";
import * as envModule from "@/lib/backend/config/env";
import { SupabaseWebhookEventRepository } from "@/lib/backend/repositories/supabase-webhook-event-repository";
import { SupabasePaymentLedgerRepository } from "@/lib/backend/repositories/payment-ledger-repository";
import { razorpayWebhookProcessor } from "@/lib/backend/services/razorpay-webhook-processor";
import { WebhookEventRecord } from "@/lib/backend/types/payment-and-consultation";

const WEBHOOK_SECRET = "unit-test-webhook-secret";

const capturedEnvelope = {
  entity: "event",
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_TestPayment01",
        entity: "payment",
        amount: 299900,
        currency: "INR",
        status: "captured",
        order_id: "order_TestOrder0001",
        method: "upi",
        email: "customer@example.com",
      },
    },
  },
  created_at: 1790000200,
};

const record = (overrides: Partial<WebhookEventRecord> = {}): WebhookEventRecord => ({
  id: "evt-row-1",
  provider: "razorpay",
  eventId: "evt_Test0001",
  eventType: "payment.captured",
  payload: {},
  signature: "sig",
  status: "received",
  processingError: null,
  processedAt: null,
  attempts: 0,
  lockedUntil: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  ...overrides,
});

function request(body: string, opts: { signature?: string | null; eventId?: string | null; secret?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const signature =
    opts.signature === undefined
      ? crypto.createHmac("sha256", opts.secret ?? WEBHOOK_SECRET).update(body).digest("hex")
      : opts.signature;
  if (signature !== null) headers["x-razorpay-signature"] = signature;
  const eventId = opts.eventId === undefined ? "evt_Test0001" : opts.eventId;
  if (eventId !== null) headers["x-razorpay-event-id"] = eventId;
  return new NextRequest("http://localhost:3000/api/razorpay/webhook", { method: "POST", headers, body });
}

describe("POST /api/razorpay/webhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    afterMock.mockReset();
    vi.spyOn(envModule, "getServerConfig").mockReturnValue({
      razorpay: { webhookSecret: WEBHOOK_SECRET },
    } as unknown as envModule.ServerConfig);
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "recordWebhookEvent").mockResolvedValue(record());
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "getWebhookEvent").mockResolvedValue(record());
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "claimWebhookEvent").mockResolvedValue(record({ attempts: 1 }));
    vi.spyOn(SupabaseWebhookEventRepository.prototype, "updateWebhookEventStatus").mockResolvedValue(record({ status: "processed" }));
    vi.spyOn(SupabasePaymentLedgerRepository.prototype, "recordIssue").mockResolvedValue(undefined);
    vi.spyOn(razorpayWebhookProcessor, "process").mockResolvedValue({
      status: "processed",
      paymentOutcome: { outcome: "confirmed", orderId: "o1", consultationId: "c1" },
    });
  });

  it("verifies, durably records, leases, processes and acknowledges a valid event", async () => {
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, status: "processed" });

    const recorded = vi.mocked(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).mock.calls[0][0];
    expect(recorded).toMatchObject({ provider: "razorpay", eventId: "evt_Test0001", eventType: "payment.captured", status: "received" });
    expect(JSON.stringify(recorded.payload)).not.toContain("customer@example.com");
    expect(SupabaseWebhookEventRepository.prototype.claimWebhookEvent).toHaveBeenCalledWith("evt-row-1", 60, 10);
    expect(SupabaseWebhookEventRepository.prototype.updateWebhookEventStatus).toHaveBeenCalledWith(
      "evt-row-1",
      "processed",
      expect.objectContaining({ processingError: null })
    );
    // Emails go out after the response, never inside the acknowledgement path.
    expect(afterMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a forged signature with 401 and stores nothing", async () => {
    const res = await POST(request(JSON.stringify(capturedEnvelope), { secret: "attacker-secret" }));
    expect(res.status).toBe(401);
    expect(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).not.toHaveBeenCalled();
    expect(razorpayWebhookProcessor.process).not.toHaveBeenCalled();
  });

  it("rejects a body changed after signing", async () => {
    const body = JSON.stringify(capturedEnvelope);
    const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    const tampered = body.replace("299900", "100");
    const res = await POST(request(tampered, { signature: sig }));
    expect(res.status).toBe(401);
  });

  it("rejects a missing signature with 400", async () => {
    const res = await POST(request(JSON.stringify(capturedEnvelope), { signature: null }));
    expect(res.status).toBe(400);
  });

  it("returns 503 (retry later) when the webhook secret is not configured", async () => {
    vi.mocked(envModule.getServerConfig).mockReturnValue({ razorpay: { webhookSecret: undefined } } as unknown as envModule.ServerConfig);
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(503);
    expect(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).not.toHaveBeenCalled();
  });

  it("requires the x-razorpay-event-id header for deduplication", async () => {
    const res = await POST(request(JSON.stringify(capturedEnvelope), { eventId: null }));
    expect(res.status).toBe(400);
  });

  it("returns 413 for oversized payloads before verifying", async () => {
    const big = JSON.stringify({ ...capturedEnvelope, pad: "x".repeat(70_000) });
    const res = await POST(request(big));
    expect(res.status).toBe(413);
  });

  it("acknowledges a duplicate of an already processed event without reprocessing", async () => {
    vi.mocked(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).mockRejectedValueOnce(
      new Error("duplicate key value violates unique constraint (23505)")
    );
    vi.mocked(SupabaseWebhookEventRepository.prototype.getWebhookEvent).mockResolvedValueOnce(record({ status: "processed" }));
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(200);
    expect(razorpayWebhookProcessor.process).not.toHaveBeenCalled();
  });

  it("reprocesses a duplicate delivery of an event stuck after a crash once its lease expired", async () => {
    vi.mocked(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).mockRejectedValueOnce(new Error("duplicate key (23505)"));
    vi.mocked(SupabaseWebhookEventRepository.prototype.getWebhookEvent).mockResolvedValueOnce(
      record({ status: "received", attempts: 1, lockedUntil: "2026-10-01T09:00:00.000Z" })
    );
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(200);
    expect(razorpayWebhookProcessor.process).toHaveBeenCalledTimes(1);
  });

  it("answers 503 without processing while a concurrent delivery holds the lease", async () => {
    vi.mocked(SupabaseWebhookEventRepository.prototype.claimWebhookEvent).mockResolvedValueOnce(null);
    vi.mocked(SupabaseWebhookEventRepository.prototype.getWebhookEvent).mockResolvedValueOnce(
      record({ status: "received", attempts: 1, lockedUntil: "2999-01-01T00:00:00.000Z" })
    );
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(503);
    expect(razorpayWebhookProcessor.process).not.toHaveBeenCalled();
  });

  it("stops retrying and raises an issue once attempts are exhausted", async () => {
    vi.mocked(SupabaseWebhookEventRepository.prototype.claimWebhookEvent).mockResolvedValueOnce(null);
    vi.mocked(SupabaseWebhookEventRepository.prototype.getWebhookEvent).mockResolvedValueOnce(
      record({ status: "failed", attempts: 10, processingError: "DATABASE_ERROR" })
    );
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(200);
    expect(SupabasePaymentLedgerRepository.prototype.recordIssue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook_retries_exhausted", gatewayReference: "evt_Test0001" })
    );
  });

  it("returns 500 for a transient processing failure so Razorpay retries", async () => {
    vi.mocked(razorpayWebhookProcessor.process).mockResolvedValueOnce({ status: "failed", error: "DATABASE_ERROR" });
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(500);
    expect(SupabaseWebhookEventRepository.prototype.updateWebhookEventStatus).toHaveBeenCalledWith(
      "evt-row-1",
      "failed",
      expect.objectContaining({ processingError: "DATABASE_ERROR", processedAt: null })
    );
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("acknowledges a terminal business rejection (e.g. amount mismatch) with 200", async () => {
    vi.mocked(razorpayWebhookProcessor.process).mockResolvedValueOnce({ status: "rejected", error: "AMOUNT_MISMATCH" });
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("rejected");
  });

  it("returns 500 when the event cannot be durably stored (never acknowledges unstored events)", async () => {
    vi.mocked(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).mockRejectedValueOnce(new Error("connection refused"));
    const res = await POST(request(JSON.stringify(capturedEnvelope)));
    expect(res.status).toBe(500);
    expect(razorpayWebhookProcessor.process).not.toHaveBeenCalled();
  });

  it("stores unsupported events as ignored and acknowledges them", async () => {
    vi.mocked(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).mockResolvedValueOnce(record({ status: "ignored" }));
    const res = await POST(request(JSON.stringify({ event: "refund.speed_changed", payload: {} })));
    expect(res.status).toBe(200);
    expect(vi.mocked(SupabaseWebhookEventRepository.prototype.recordWebhookEvent).mock.calls[0][0].status).toBe("ignored");
    expect(razorpayWebhookProcessor.process).not.toHaveBeenCalled();
  });
});
