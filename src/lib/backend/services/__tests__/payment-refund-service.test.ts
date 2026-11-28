import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { PaymentNotificationService } from "../payment-notification-service";
import {
  PaymentRefundService,
  buildRefundIdempotencyKey,
  evaluateRefundEligibility,
} from "../payment-refund-service";
import { RefundIntentRejectedError } from "../../repositories/payment-ledger-repository";
import { GatewayError } from "../../integrations/payment-gateway.interface";
import {
  aConsultation,
  aRefund,
  aSlot,
  aTransaction,
  anOrder,
  mockConsultationRepo,
  mockGateway,
  mockLedger,
  mockOrderRepo,
  mockRefundRepo,
  mockSlotRepo,
  mockTransactionRepo,
  ORDER_ID,
} from "./payment-test-doubles";

describe("evaluateRefundEligibility (locked Eventsika policy)", () => {
  const start = "2026-10-05T10:00:00.000Z";

  it("allows a customer cancellation exactly 2 hours before the start", () => {
    expect(
      evaluateRefundEligibility({ reason: "customer_cancellation", consultationStatus: "confirmed", slotStartIso: start, cancellationRequestedAt: new Date("2026-10-05T08:00:00.000Z") })
    ).toEqual({ eligible: true });
  });

  it("refuses a customer cancellation inside the 2-hour cutoff", () => {
    const r = evaluateRefundEligibility({ reason: "customer_cancellation", consultationStatus: "confirmed", slotStartIso: start, cancellationRequestedAt: new Date("2026-10-05T08:00:01.000Z") });
    expect(r.eligible).toBe(false);
  });

  it("never refunds a no-show", () => {
    for (const reason of ["customer_cancellation", "goodwill", "eventsika_cancellation_alternative_rejected"] as const) {
      expect(evaluateRefundEligibility({ reason, consultationStatus: "no_show", slotStartIso: start, cancellationRequestedAt: new Date("2026-10-01T00:00:00.000Z") }).eligible).toBe(false);
    }
  });

  it("allows a full refund when Eventsika cancelled and the alternative was rejected, at any time", () => {
    expect(
      evaluateRefundEligibility({ reason: "eventsika_cancellation_alternative_rejected", consultationStatus: "cancelled_eventsika", slotStartIso: start, cancellationRequestedAt: new Date("2026-10-05T09:59:00.000Z") })
    ).toEqual({ eligible: true });
  });

  it("needs a slot to measure a customer cancellation against", () => {
    expect(evaluateRefundEligibility({ reason: "customer_cancellation", consultationStatus: "slot_conflict_pending_reschedule", slotStartIso: null, cancellationRequestedAt: new Date() }).eligible).toBe(false);
  });
});

describe("PaymentRefundService", () => {
  let ledger: ReturnType<typeof mockLedger>;
  let refunds: ReturnType<typeof mockRefundRepo>;
  let gateway: ReturnType<typeof mockGateway>;
  let notifications: { dispatch: Mock<PaymentNotificationService["dispatch"]> };
  let service: PaymentRefundService;

  const input = {
    paymentOrderId: ORDER_ID,
    reason: "eventsika_cancellation_alternative_rejected" as const,
    note: "Customer rejected the alternative slot",
    actorId: "admin-1",
    requestId: "req-1",
    clientRequestKey: "clientkey0123456789",
  };

  beforeEach(() => {
    ledger = mockLedger();
    refunds = mockRefundRepo();
    gateway = mockGateway();
    notifications = { dispatch: vi.fn<PaymentNotificationService["dispatch"]>().mockResolvedValue("sent") };
    service = new PaymentRefundService({
      ledger,
      refunds,
      orders: mockOrderRepo(),
      transactions: mockTransactionRepo(),
      consultations: mockConsultationRepo(aConsultation({ status: "cancelled_eventsika" })),
      slots: mockSlotRepo(aSlot()),
      gateway,
      notifications,
    });
  });

  it("derives a stable, Razorpay-compatible idempotency key per logical request", () => {
    const k1 = buildRefundIdempotencyKey(ORDER_ID, "clientkey0123456789");
    expect(k1).toBe(buildRefundIdempotencyKey(ORDER_ID, "clientkey0123456789"));
    expect(k1).not.toBe(buildRefundIdempotencyKey(ORDER_ID, "anotherkey012345678"));
    expect(k1).toMatch(/^[A-Za-z0-9_-]{10,64}$/);
  });

  it("persists the intent first, then calls Razorpay with the intent's key and amount, and stays 'processing'", async () => {
    const result = await service.requestRefund(input);

    expect(ledger.createRefundIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amountInPaise: 299900, initiatedBy: "admin", requestedBy: "admin-1", idempotencyKey: buildRefundIdempotencyKey(ORDER_ID, input.clientRequestKey) })
    );
    expect(gateway.createRefund).toHaveBeenCalledWith({
      paymentId: "pay_TestPayment01",
      amountInPaise: 299900,
      idempotencyKey: aRefund().idempotencyKey,
      notes: { refund_id: aRefund().id },
    });
    const intentOrder = vi.mocked(ledger.createRefundIntent).mock.invocationCallOrder[0];
    expect(intentOrder).toBeLessThan(vi.mocked(gateway.createRefund).mock.invocationCallOrder[0]);
    // API acceptance is NOT completion.
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(aRefund().id, "initiated", expect.objectContaining({ gatewayRefundId: "rfnd_TestRefund01" }));
    expect(refunds.updateRefundStatus).not.toHaveBeenCalledWith(expect.anything(), "succeeded", expect.anything());
    expect(result).toMatchObject({ success: true, providerState: "initiated" });
    expect(notifications.dispatch).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_processing" }));
  });

  it("refunds only the remaining balance by default (partial refunds already committed)", async () => {
    vi.mocked(refunds.getRefundsByOrderId).mockResolvedValueOnce([aRefund({ id: "r-old", amountInPaise: 100000, status: "succeeded" })]);
    await service.requestRefund(input);
    expect(vi.mocked(ledger.createRefundIntent).mock.calls[0][0].amountInPaise).toBe(199900);
  });

  it("surfaces the database balance guard (concurrent over-refund) as REFUND_EXCEEDS_BALANCE", async () => {
    vi.mocked(ledger.createRefundIntent).mockRejectedValueOnce(new RefundIntentRejectedError("REFUND_EXCEEDS_BALANCE"));
    const result = await service.requestRefund({ ...input, amountInPaise: 299900 });
    expect(result).toMatchObject({ success: false, error: "REFUND_EXCEEDS_BALANCE" });
    expect(gateway.createRefund).not.toHaveBeenCalled();
  });

  it("refuses ineligible refunds before touching money", async () => {
    service = new PaymentRefundService({
      ledger,
      refunds,
      orders: mockOrderRepo(),
      transactions: mockTransactionRepo(),
      consultations: mockConsultationRepo(aConsultation({ status: "no_show" })),
      slots: mockSlotRepo(),
      gateway,
      notifications,
    });
    const result = await service.requestRefund({ ...input, reason: "customer_cancellation" });
    expect(result).toMatchObject({ success: false, error: "NOT_ELIGIBLE" });
    expect(ledger.createRefundIntent).not.toHaveBeenCalled();
  });

  it("refuses unpaid orders", async () => {
    service = new PaymentRefundService({ ledger, refunds, orders: mockOrderRepo(anOrder({ status: "attempted" })), transactions: mockTransactionRepo(), consultations: mockConsultationRepo(), slots: mockSlotRepo(), gateway, notifications });
    expect(await service.requestRefund(input)).toMatchObject({ success: false, error: "ORDER_NOT_PAID" });
  });

  it("requires an explicit amount for goodwill refunds", async () => {
    expect(await service.requestRefund({ ...input, reason: "goodwill" })).toMatchObject({ success: false, error: "NOT_ELIGIBLE" });
  });

  it("keeps the intent pending with the same key when Razorpay times out (unknown outcome)", async () => {
    vi.mocked(gateway.createRefund).mockRejectedValueOnce(new GatewayError("timeout", { code: "GATEWAY_TIMEOUT" }));
    const result = await service.requestRefund(input);
    expect(result).toMatchObject({ success: true, providerState: "pending_retry" });
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(aRefund().id, "pending", { lastError: "GATEWAY_TIMEOUT" });
    expect(refunds.updateRefundStatus).not.toHaveBeenCalledWith(aRefund().id, "failed", expect.anything());
  });

  it("fails the intent and opens a manual-review issue when Razorpay definitively rejects it", async () => {
    vi.mocked(gateway.createRefund).mockRejectedValueOnce(
      new GatewayError("rejected", { code: "GATEWAY_REJECTED", statusCode: 400, providerMessage: "Partial refund is currently not supported for this payment method" })
    );
    const result = await service.requestRefund({ ...input, amountInPaise: 1000 });
    expect(result).toMatchObject({ success: true, providerState: "manual_review" });
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(aRefund().id, "failed", expect.objectContaining({ lastError: expect.stringContaining("Partial refund") }));
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_manual_review" }));
  });

  it("routes legacy Cashfree refunds to manual review without calling Razorpay", async () => {
    vi.mocked(ledger.createRefundIntent).mockResolvedValueOnce(aRefund({ provider: "cashfree" }));
    const result = await service.requestRefund(input);
    expect(result).toMatchObject({ success: true, providerState: "manual_review" });
    expect(gateway.createRefund).not.toHaveBeenCalled();
  });

  describe("applyProviderRefund (webhook / fetch)", () => {
    it("records completion only from authoritative 'processed' state and notifies once", async () => {
      vi.mocked(refunds.getRefundByGatewayId).mockResolvedValueOnce(aRefund({ status: "initiated", gatewayRefundId: "rfnd_TestRefund01" }));
      await service.applyProviderRefund({ id: "rfnd_TestRefund01", paymentId: "pay_TestPayment01", amountInPaise: 299900, status: "processed" });
      expect(refunds.updateRefundStatus).toHaveBeenCalledWith(aRefund().id, "succeeded", expect.objectContaining({ processedAt: expect.any(String) }));
      expect(ledger.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "refund_status_changed", newState: "succeeded" }));
      expect(notifications.dispatch).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_processed", dedupeKey: `refund_processed:${aRefund().id}` }));
    });

    it("ignores a duplicate 'processed' event for an already succeeded refund", async () => {
      vi.mocked(refunds.getRefundByGatewayId).mockResolvedValueOnce(aRefund({ status: "succeeded", gatewayRefundId: "rfnd_TestRefund01" }));
      await service.applyProviderRefund({ id: "rfnd_TestRefund01", paymentId: "pay_TestPayment01", amountInPaise: 299900, status: "processed" });
      expect(refunds.updateRefundStatus).not.toHaveBeenCalled();
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    it("never regresses a succeeded refund on a late 'pending' event", async () => {
      vi.mocked(refunds.getRefundByGatewayId).mockResolvedValueOnce(aRefund({ status: "succeeded", gatewayRefundId: "rfnd_TestRefund01" }));
      await service.applyProviderRefund({ id: "rfnd_TestRefund01", paymentId: "pay_TestPayment01", amountInPaise: 299900, status: "pending" });
      expect(refunds.updateRefundStatus).not.toHaveBeenCalled();
    });

    it("records a refund_failed issue on provider failure", async () => {
      vi.mocked(refunds.getRefundByGatewayId).mockResolvedValueOnce(aRefund({ status: "initiated", gatewayRefundId: "rfnd_TestRefund01" }));
      await service.applyProviderRefund({ id: "rfnd_TestRefund01", paymentId: "pay_TestPayment01", amountInPaise: 299900, status: "failed" });
      expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_failed" }));
    });

    it("links a refund whose creation response was lost (single pending intent on the same payment and amount)", async () => {
      vi.mocked(refunds.getRefundsByOrderId).mockResolvedValueOnce([aRefund()]);
      await service.applyProviderRefund({ id: "rfnd_TestRefund01", paymentId: "pay_TestPayment01", amountInPaise: 299900, status: "pending" });
      expect(refunds.updateRefundStatus).toHaveBeenCalledWith(aRefund().id, "initiated", expect.objectContaining({ gatewayRefundId: "rfnd_TestRefund01" }));
    });

    it("returns null for a refund Eventsika never requested", async () => {
      vi.mocked(refunds.getRefundsByOrderId).mockResolvedValueOnce([]);
      expect(await service.applyProviderRefund({ id: "rfnd_Unknown00001", paymentId: "pay_TestPayment01", amountInPaise: 5000, status: "processed" })).toBeNull();
    });
  });

  it("reconcileOpenRefunds resubmits pending intents and polls initiated refunds", async () => {
    vi.mocked(refunds.listOpenRefunds).mockResolvedValueOnce([aRefund(), aRefund({ id: "r2", status: "initiated", gatewayRefundId: "rfnd_TestRefund02" })]);
    vi.mocked(gateway.fetchRefund).mockResolvedValueOnce({ id: "rfnd_TestRefund02", paymentId: "pay_TestPayment01", amountInPaise: 299900, status: "processed" });
    const counts = await service.reconcileOpenRefunds();
    expect(gateway.createRefund).toHaveBeenCalledTimes(1);
    expect(gateway.fetchRefund).toHaveBeenCalledWith("rfnd_TestRefund02");
    expect(counts.resubmitted).toBe(1);
    expect(counts.errors).toBe(0);
  });

  it("uses only captured transactions", async () => {
    service = new PaymentRefundService({ ledger, refunds, orders: mockOrderRepo(), transactions: mockTransactionRepo([aTransaction({ status: "failed" })]), consultations: mockConsultationRepo(aConsultation({ status: "cancelled_eventsika" })), slots: mockSlotRepo(), gateway, notifications });
    expect(await service.requestRefund(input)).toMatchObject({ success: false, error: "TRANSACTION_NOT_REFUNDABLE" });
  });
});
