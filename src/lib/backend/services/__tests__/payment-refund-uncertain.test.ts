import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { PaymentNotificationService } from "../payment-notification-service";
import { PaymentRefundService } from "../payment-refund-service";
import { GatewayError } from "../../integrations/payment-gateway.interface";
import { mapRazorpayRefund } from "../../integrations/razorpay-payment-gateway";
import {
  aConsultation,
  aRefund,
  aSlot,
  mockConsultationRepo,
  mockGateway,
  mockLedger,
  mockOrderRepo,
  mockRefundRepo,
  mockSlotRepo,
  mockTransactionRepo,
  ORDER_ID,
} from "./payment-test-doubles";

/**
 * F1 regression: an uncertain refund outcome must never be recorded as a definitive
 * failure (which would release its balance and allow a second, real refund).
 * No real Razorpay requests: the gateway is a test double throughout.
 */
describe("PaymentRefundService — uncertain refund outcomes (double-refund regression)", () => {
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
  const acceptedRemote = (status: "pending" | "processed" | "failed" = "pending") => ({
    id: "rfnd_TestRefund01",
    paymentId: "pay_TestPayment01",
    amountInPaise: 299900,
    status,
    localRefundId: aRefund().id,
  });

  const build = (refundRows: ReturnType<typeof aRefund>[] = []) => {
    refunds = mockRefundRepo(refundRows);
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
  };

  beforeEach(() => {
    ledger = mockLedger();
    gateway = mockGateway();
    notifications = { dispatch: vi.fn<PaymentNotificationService["dispatch"]>().mockResolvedValue("sent") };
    build();
  });

  it("1. provider accepted but the response is malformed: stays pending (never failed) and opens a review issue", async () => {
    vi.mocked(gateway.createRefund).mockRejectedValueOnce(
      new GatewayError("Razorpay refund does not match the request", { code: "MALFORMED_RESPONSE" })
    );
    const result = await service.requestRefund(input);

    expect(result).toMatchObject({ success: true, providerState: "pending_retry" });
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(aRefund().id, "pending", { lastError: "MALFORMED_RESPONSE" });
    expect(refunds.updateRefundStatus).not.toHaveBeenCalledWith(expect.anything(), "failed", expect.anything());
    expect(ledger.recordIssue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "refund_manual_review", gatewayReference: aRefund().id })
    );
  });

  it("2. network timeout after acceptance: the next attempt finds the original refund instead of sending again", async () => {
    vi.mocked(gateway.createRefund).mockRejectedValueOnce(new GatewayError("network", { code: "NETWORK_ERROR" }));
    expect(await service.requestRefund(input)).toMatchObject({ success: true, providerState: "pending_retry" });
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(aRefund().id, "pending", { lastError: "NETWORK_ERROR" });

    vi.mocked(gateway.fetchPaymentRefunds).mockResolvedValueOnce([acceptedRemote("processed")]);
    const retry = await service.submitToProvider(aRefund({ lastError: "NETWORK_ERROR" }));

    expect(gateway.fetchPaymentRefunds).toHaveBeenCalledWith("pay_TestPayment01");
    expect(gateway.createRefund).toHaveBeenCalledTimes(1); // only the original attempt
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(
      aRefund().id,
      "succeeded",
      expect.objectContaining({ gatewayRefundId: "rfnd_TestRefund01" })
    );
    expect(retry.state).toBe("initiated");
  });

  it("3a. duplicate refund request while the first is uncertain: no second intent, no provider call", async () => {
    build([aRefund({ status: "pending", lastError: "MALFORMED_RESPONSE" })]);
    const result = await service.requestRefund({ ...input, clientRequestKey: "differentkey0123456" });

    expect(result).toMatchObject({ success: false, error: "REFUND_EXCEEDS_BALANCE" });
    expect(ledger.createRefundIntent).not.toHaveBeenCalled();
    expect(gateway.createRefund).not.toHaveBeenCalled();
  });

  it("3b. replay of the same request reuses the original intent and key, and verifies before any resend", async () => {
    vi.mocked(ledger.createRefundIntent).mockResolvedValueOnce(aRefund({ lastError: "GATEWAY_TIMEOUT" }));
    vi.mocked(gateway.fetchPaymentRefunds).mockResolvedValueOnce([acceptedRemote("pending")]);

    const result = await service.requestRefund(input);

    expect(gateway.createRefund).not.toHaveBeenCalled();
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(
      aRefund().id,
      "initiated",
      expect.objectContaining({ gatewayRefundId: "rfnd_TestRefund01" })
    );
    expect(result).toMatchObject({ success: true, providerState: "initiated" });
  });

  it("4. delayed webhook confirms the original refund via notes.refund_id with no gateway id stored", async () => {
    build([aRefund({ status: "pending", lastError: "MALFORMED_RESPONSE" })]);
    vi.mocked(refunds.getRefundsByOrderId).mockResolvedValue([]); // heuristic match unavailable

    const updated = await service.applyProviderRefund(acceptedRemote("processed"));

    expect(refunds.getRefundById).toHaveBeenCalledWith(aRefund().id);
    expect(updated).not.toBeNull();
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(
      aRefund().id,
      "succeeded",
      expect.objectContaining({ gatewayRefundId: "rfnd_TestRefund01", processedAt: expect.any(String) })
    );
    expect(notifications.dispatch).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_processed" }));
  });

  it("4b. a notes match with a different amount is never applied; it is flagged for review", async () => {
    build([aRefund({ status: "pending" })]);
    await service.applyProviderRefund({ ...acceptedRemote("processed"), amountInPaise: 100 });
    expect(refunds.updateRefundStatus).not.toHaveBeenCalled();
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_manual_review" }));
  });

  it("5a. reconciliation verifies with Razorpay and resends with the SAME key only if no refund exists", async () => {
    const uncertain = aRefund({ status: "pending", lastError: "MALFORMED_RESPONSE" });
    vi.mocked(refunds.listOpenRefunds).mockResolvedValueOnce([uncertain]);
    vi.mocked(gateway.fetchPaymentRefunds).mockResolvedValueOnce([]);

    const counts = await service.reconcileOpenRefunds();

    expect(gateway.fetchPaymentRefunds).toHaveBeenCalledWith("pay_TestPayment01");
    expect(gateway.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: uncertain.idempotencyKey,
        amountInPaise: uncertain.amountInPaise,
        notes: { refund_id: uncertain.id },
      })
    );
    expect(counts.errors).toBe(0);
  });

  it("5b. reconciliation never resends blind when Razorpay cannot be queried", async () => {
    vi.mocked(refunds.listOpenRefunds).mockResolvedValueOnce([aRefund({ status: "pending", lastError: "GATEWAY_TIMEOUT" })]);
    vi.mocked(gateway.fetchPaymentRefunds).mockRejectedValueOnce(new GatewayError("down", { code: "GATEWAY_ERROR" }));

    await service.reconcileOpenRefunds();

    expect(gateway.createRefund).not.toHaveBeenCalled();
    expect(refunds.updateRefundStatus).not.toHaveBeenCalledWith(expect.anything(), "failed", expect.anything());
  });

  it("5c. reconciliation resolves an uncertain refund to failed only on Razorpay's authoritative 'failed'", async () => {
    vi.mocked(refunds.listOpenRefunds).mockResolvedValueOnce([aRefund({ status: "pending", lastError: "MALFORMED_RESPONSE" })]);
    vi.mocked(gateway.fetchPaymentRefunds).mockResolvedValueOnce([acceptedRemote("failed")]);

    await service.reconcileOpenRefunds();

    expect(gateway.createRefund).not.toHaveBeenCalled();
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(
      aRefund().id,
      "failed",
      expect.objectContaining({ gatewayRefundId: "rfnd_TestRefund01" })
    );
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_failed" }));
  });

  it("6a. a confirmed rejection of the first attempt fails the intent and releases the balance", async () => {
    vi.mocked(gateway.createRefund).mockRejectedValueOnce(
      new GatewayError("rejected", {
        code: "GATEWAY_REJECTED",
        statusCode: 400,
        providerMessage: "The refund amount provided is greater than amount captured",
      })
    );
    const result = await service.requestRefund(input);
    expect(result).toMatchObject({ success: true, providerState: "manual_review" });
    expect(refunds.updateRefundStatus).toHaveBeenCalledWith(
      aRefund().id,
      "failed",
      expect.objectContaining({ lastError: expect.stringContaining("GATEWAY_REJECTED") })
    );
  });

  it("6b. a rejection of a RESUBMISSION is uncertain (could mean 'already refunded') and stays pending", async () => {
    vi.mocked(gateway.fetchPaymentRefunds).mockResolvedValueOnce([]);
    vi.mocked(gateway.createRefund).mockRejectedValueOnce(
      new GatewayError("rejected", {
        code: "GATEWAY_REJECTED",
        statusCode: 400,
        providerMessage: "The payment has been fully refunded already",
      })
    );
    const result = await service.submitToProvider(aRefund({ lastError: "GATEWAY_TIMEOUT" }));
    expect(result.state).toBe("pending_retry");
    expect(refunds.updateRefundStatus).not.toHaveBeenCalledWith(expect.anything(), "failed", expect.anything());
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_manual_review" }));
  });

  it("6c. auth/config failures never fail a refund (nothing was sent; retried once fixed)", async () => {
    vi.mocked(gateway.createRefund).mockRejectedValueOnce(
      new GatewayError("not configured", { code: "AUTHENTICATION_FAILED" })
    );
    const result = await service.requestRefund(input);
    expect(result).toMatchObject({ success: true, providerState: "pending_retry" });
    expect(refunds.updateRefundStatus).not.toHaveBeenCalledWith(expect.anything(), "failed", expect.anything());
  });
});

describe("mapRazorpayRefund — notes.refund_id link", () => {
  const base = { entity: "refund", id: "rfnd_TestRefund01", payment_id: "pay_TestPayment01", amount: 299900, status: "processed" };

  it("extracts our refund id from notes", () => {
    expect(mapRazorpayRefund({ ...base, notes: { refund_id: aRefund().id } }).localRefundId).toBe(aRefund().id);
  });

  it("ignores missing or non-UUID notes values", () => {
    expect(mapRazorpayRefund(base).localRefundId).toBeNull();
    expect(mapRazorpayRefund({ ...base, notes: { refund_id: "not-a-uuid" } }).localRefundId).toBeNull();
    expect(mapRazorpayRefund({ ...base, notes: [] }).localRefundId).toBeNull();
  });
});
